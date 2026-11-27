import logging
import json
from django.conf import settings
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.db import transaction
from django.utils.translation import gettext_lazy as _
try:
    from webauthn.helpers.exceptions import WebAuthnException
    from webauthn import ( 
        generate_registration_options, 
        options_to_json, 
        verify_registration_response, 
        generate_authentication_options,
        verify_authentication_response
    )
    from webauthn.helpers.structs import (
        AuthenticatorSelectionCriteria,
        ResidentKeyRequirement,
        UserVerificationRequirement,
        PublicKeyCredentialDescriptor,
    )
    from webauthn.registration.verify_registration_response import VerifiedRegistration
    from webauthn.authentication.verify_authentication_response import VerifiedAuthentication
    from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
except ImportError:
    class WebAuthnException(Exception):
        pass
    generate_registration_options = None
    options_to_json = None
    verify_registration_response = None
    generate_authentication_options = None
    verify_authentication_response = None
    AuthenticatorSelectionCriteria = None
    ResidentKeyRequirement = None
    UserVerificationRequirement = None
    PublicKeyCredentialDescriptor = None
    VerifiedRegistration = None
    VerifiedAuthentication = None
    base64url_to_bytes = None
    bytes_to_base64url = None
from config.redis import RedisCache


from apps.auth.models.auth.user import User
from apps.auth.models.auth.webauthn import WebAuthnCredential



logger = logging.getLogger(__name__)

class EmailMFAService:
    template_name = "send_email_mfa.html"
    subject = "Código de verificación"
    from_email = settings.EMAIL_FROM

    year = timezone.now().year
    logo_url = f"{settings.DOMAIN_NAME}static/images/guios_logo.svg"
    lifetime = int(settings.EMAIL_CODE_LIFETIME.total_seconds() / 60) if settings.EMAIL_CODE_LIFETIME else 5

    @staticmethod
    @transaction.atomic
    def send_email_mfa(user_id:int, code:str) -> None:
        """
            Enviar el código de verificación al correo electrónico del usuario
        """
        user  = User.objects.select_for_update().get(pk=user_id)

        html_message = render_to_string(
            EmailMFAService.template_name,
            {
                "user_name": user.first_name,
                "code": code,
                "expires_minutes": EmailMFAService.lifetime,
                "year": EmailMFAService.year,
                "logo_url": EmailMFAService.logo_url
            }
        )

        email = EmailMultiAlternatives(
            subject=EmailMFAService.subject,
            body = f"Tu código MFA es: {code}",
            from_email=EmailMFAService.from_email,
            to=[user.email]
        )

        email.attach_alternative(html_message, "text/html")

        try:
            email.send()
            logger.info(f"Código MFA enviado exitosamente a {user.email}")

        except Exception as e:
            logger.error(f"Error al enviar código MFA a {user.email}: {e}")
            raise Exception(_("Ocurrió un error al enviar el código de verificación"))
            
    


class WebAuthnService:

    rp_id = settings.WEBAUTHN.get("RP_ID")
    rp_name = settings.WEBAUTHN.get("RP_NAME")
    origin = settings.WEBAUTHN.get("WEBAUTHN_ORIGIN")

    @staticmethod
    def authenticate_option_for_user(user):
        """
            Genera las opciones de autenticación para que el navegador sepa qué passkey
            del usuario debe solicitar y firmar.

            Args:
                user: instancia del usurio al que se asocia la credencial
        """
        user_credentials = user.webauthn_credentials.all()

        if not user_credentials.exists():
            raise WebAuthnCredential(_("El usuario no tiene credenciales WebAuthn registradas"))
        
        allow_credentials = [
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(cred.credential_id))
            for cred in user_credentials    
        ]

        options = generate_authentication_options(
            rp_id=WebAuthnService.rp_id,
            allow_credentials=allow_credentials,
            user_verification=UserVerificationRequirement.REQUIRED
        )

        challenge_b64 = bytes_to_base64url(options.challenge)
        cache_key = f"webauthn_auth_challenge_{user.id}"
        RedisCache.set(cache_key, challenge_b64)

        return json.loads(options_to_json(options))
    
    @staticmethod
    def verfify_credential_authentication(user:User, authentication_response:dict) -> VerifiedAuthentication:
        """
            Verifica la respuesta de autenticación firmada por la Passkey.

            Args:
                user: instancia del usuario asociado a la credencial WebAuthn
                authentication_response: Datos de la respuesta de autenticación
                enviados por el cliente.

            Returns:
                El resultado de la verificación de la autenticación, con los datos
                de la credencial verificada.
        """
        cache_key = f"webauthn_auth_challenge_{user.id}"
        challenge_b64 = RedisCache.get(cache_key)

        if not challenge_b64:
            raise WebAuthnException(_("El challenge de autenticación ha expirado o no existe."))
        
        credential_id_used = authentication_response.get("id")
        credential = user.webauthn_credentials.filter(credential_id=credential_id_used).first()

        if not credential:
            raise WebAuthnException(_("La credencial utilizada no pertenece a este usuario."))
        
        # Validar con la librería de webauthn
        try:

            verified_auth = verify_authentication_response(
                credential=authentication_response,
                expected_challenge=base64url_to_bytes(challenge_b64),
                expected_origin=WebAuthnService.origin,
                expected_rp_id=WebAuthnService.rp_id,
                credential_public_key=base64url_to_bytes(credential.public_key),
                credential_current_sign_count=credential.sign_count,
                require_user_verification=True
            )

            credential.sign_count = verified_auth.new_sign_count
            credential.save(update_fields=["sign_count"])

            RedisCache.delete(cache_key)

            return verified_auth

        except WebAuthnException as e:
            logger.error(f"Error en la verificación de autenticación WebAuthn: {e}")
            raise WebAuthnException(_("No se pudo verificar la autenticación WebAuthn."))



    @staticmethod
    def register_option_for_user(user:User) -> dict:
        """
            Genera las opciones de registro de WebAuthn, definiendo los parámetros
            y requisitos que debe cumplir el autenticador al crear una credencial.

           Args:
                rp_id: Identificador del relying party (aplicación o servicio),
                generalmente el dominio donde se utiliza WebAuthn.
                rp_name: Nombre legible del relying party que se mostrará al usuario.
                resident_key: Indica la preferencia sobre el uso de credenciales
                descubribles en el autenticador.
                user_verification: Define si se requiere, se prefiere o se evita
        """
        existing_credentials = user.webauthn_credentials.all()

        exclude_credentials = [
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(cred.credential_id))
            for cred in existing_credentials
        ]

        options = generate_registration_options(
            rp_id=WebAuthnService.rp_id,      
            rp_name=WebAuthnService.rp_name,
            user_id=str(user.id).encode("utf-8"), # El id del usuario debe ir en bytes
            user_name=user.username,
            user_display_name=user.get_full_name() or user.username,
            exclude_credentials=exclude_credentials,
            authenticator_selection=AuthenticatorSelectionCriteria(
               resident_key=ResidentKeyRequirement.PREFERRED,
               user_verification=UserVerificationRequirement.REQUIRED,
            ),
        )

        challenge_b64 = bytes_to_base64url(options.challenge)
        cache_key = f"webauthn_reg_challenge_{user.id}"
        RedisCache.set(cache_key, challenge_b64)


        return json.loads(options_to_json(options))
    

    def verify_credential_registration(user, registration_response:dict) -> VerifiedRegistration:
        """
           Verifica la respuesta de registro de una credencial WebAuthn.
           Recupera el challenge asociado al usuario desde Redis y verifica
           la respuesta de registro mediante la biblioteca WebAuthn.

            Args:
                user: Usuario al que se asociará la credencial WebAuthn.
                registration_response: Datos de la respuesta de registro
                enviados por el cliente.

            Returns:
                El resultado de la verificación del registro, con los datos
                de la credencial verificada.
        """ 
        cache_key = f"webauthn_reg_challenge_{user.id}"
        challenge_b64 = RedisCache.get(cache_key)

        if not challenge_b64:
           raise WebAuthnException(_("El challenge de registro ha expirado o no existe."))
        
        try: 
            verified_register = verify_registration_response(
                credential=registration_response,
                expected_challenge=base64url_to_bytes(challenge_b64),
                expected_origin=WebAuthnService.origin,
                expected_rp_id=WebAuthnService.rp_id,
                require_user_verification=True,
            )
            
            RedisCache.delete(cache_key)

            return verified_register

        except WebAuthnException as e: 
            logger.error(f"Error en la verificación del registro de WebAuthn:  {e}")
            raise WebAuthnException(_("No se pudo verificar el registro de WebAuthn."))


    def create_webauthn_credential(self, user:User, credential_verified:object) -> None:
        """
            Crea una nueva credencial de WebAuthn en la base de datos  
            args:
                user: usuario asociado a la credencial
                credential_verified:  objeto de la credencial webauthn verificada
        """
        
        try: 
            with transaction.atomic(): 
                WebAuthnCredential.objects.create(
                    user=user,
                    credential_id=bytes_to_base64url(credential_verified.credential_id),
                    public_key=bytes_to_base64url(credential_verified.credential_public_key),
                    sign_count=credential_verified.sign_count
                )
        
        except Exception as e:
            logger.error(f"Error al guardar la credencial en la base de datos: {e}")
            raise Exception(_("No se pudo guardar la credencial"))

        RedisCache.delete(f"webauthn_reg_challenge_{user.id}")








