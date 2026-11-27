import logging
import secrets
from django.conf import settings
from django.core.cache import cache
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from apps.auth.models.auth.user import User
from apps.auth.utils.password_validator import validate_password_rules

logger = logging.getLogger(__name__)


class PasswordResetRequestView(APIView):
    """
    POST /api/v1/auth/password-reset/request/
    Solicita el restablecimiento de contraseña para un correo electrónico.
    Regla de seguridad: Se evita la enumeración de usuarios respondiendo con el mismo
    mensaje independientemente de si el correo existe o no en el sistema.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email_raw = request.data.get("email") or ""
        clean_email = email_raw.strip().lower()
        code_length = getattr(settings, "VERIFICATION_CODE_LENGTH", 6)

        generic_response = {
            "detail": "Si el correo está registrado en el sistema, recibirás un código de verificación.",
            "code_length": code_length,
            "email": clean_email,
        }

        if not clean_email or "@" not in clean_email:
            return Response(generic_response, status=status.HTTP_200_OK)

        user = User.objects.filter(email__iexact=clean_email, is_active=True).first()
        if user:
            # Generar código de longitud configurada
            code = f"{secrets.randbelow(10**code_length):0{code_length}d}"

            # Guardar código temporal en caché por 10 minutos
            cache_key = f"guios_pwd_reset_{clean_email}"
            cache.set(cache_key, {
                "code": code,
                "user_id": user.id,
                "attempts": 0,
            }, timeout=600)

            # Enviar correo con plantilla institucional GuiosPro
            try:
                html_message = render_to_string(
                    "send_password_reset_email.html",
                    {
                        "user_name": user.first_name,
                        "code": code,
                        "expires_minutes": 10,
                        "year": timezone.now().year,
                        "support_email": getattr(settings, "SUPPORT_EMAIL", "soporte@guiospro.local"),
                    }
                )

                email_msg = EmailMultiAlternatives(
                    subject="Código para restablecer tu contraseña — GuiosPro",
                    body=f"Tu código de verificación para restablecer contraseña en GuiosPro es: {code}",
                    from_email=getattr(settings, "EMAIL_FROM", "noreply@guiospro.local"),
                    to=[user.email],
                )
                email_msg.attach_alternative(html_message, "text/html")
                email_msg.send()
                logger.info(f"Código de restablecimiento de contraseña enviado a {user.email}")
            except Exception as e:
                logger.error(f"Error al enviar correo de restablecimiento a {user.email}: {e}")

        return Response(generic_response, status=status.HTTP_200_OK)


class PasswordResetVerifyView(APIView):
    """
    POST /api/v1/auth/password-reset/verify/
    Verifica el código de seguridad recibido por correo.
    Si es válido, emite un token temporal de un solo uso para autorizar la creación de la nueva contraseña.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email_raw = request.data.get("email") or ""
        code_raw = request.data.get("code") or ""
        clean_email = email_raw.strip().lower()
        code = str(code_raw).strip()

        if not clean_email or not code:
            return Response(
                {"detail": "Debes proporcionar tu correo y el código de verificación."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cache_key = f"guios_pwd_reset_{clean_email}"
        data = cache.get(cache_key)

        if not data:
            return Response(
                {"detail": "El código ha expirado o no es válido. Solicita un nuevo código."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if data.get("attempts", 0) >= 5:
            cache.delete(cache_key)
            return Response(
                {"detail": "Has superado el número máximo de intentos permitidos. Solicita un nuevo código."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if data.get("code") != code:
            data["attempts"] = data.get("attempts", 0) + 1
            cache.set(cache_key, data, timeout=600)
            return Response(
                {"detail": "El código ingresado es incorrecto."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Código correcto: generar token temporal de restablecimiento (válido 15 minutos)
        reset_token = secrets.token_urlsafe(32)
        token_key = f"guios_pwd_reset_token_{reset_token}"
        cache.set(token_key, {
            "user_id": data["user_id"],
            "email": clean_email,
        }, timeout=900)

        # Eliminar el código para evitar reutilización
        cache.delete(cache_key)

        return Response({
            "detail": "Código verificado exitosamente.",
            "reset_token": reset_token,
        }, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """
    POST /api/v1/auth/password-reset/confirm/
    Establece la nueva contraseña del usuario usando el reset_token previamente emitido.
    Aplica las 4 reglas de seguridad de contraseñas de GuiosPro.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        reset_token = (request.data.get("reset_token") or "").strip()
        password = request.data.get("password") or ""
        confirm_password = request.data.get("confirm_password") or ""

        if not reset_token:
            return Response(
                {"detail": "Token de restablecimiento no proporcionado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token_key = f"guios_pwd_reset_token_{reset_token}"
        token_data = cache.get(token_key)

        if not token_data:
            return Response(
                {"detail": "El enlace o token de restablecimiento es inválido o ha expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(pk=token_data["user_id"])
        except User.DoesNotExist:
            return Response(
                {"detail": "El usuario asociado a este restablecimiento ya no existe."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password_rules(
                password=password,
                confirm_password=confirm_password,
                first_name=user.first_name,
                last_name=user.last_name,
                username=user.username,
                email=user.email,
            )
        except ValidationError as e:
            detail_dict = e.detail if hasattr(e, "detail") else str(e)
            return Response(detail_dict, status=status.HTTP_400_BAD_REQUEST)

        # Actualizar contraseña
        user.set_password(password)
        user.save(update_fields=["password"])

        # Eliminar token para que no vuelva a ser usado
        cache.delete(token_key)

        logger.info(f"Contraseña restablecida exitosamente para el usuario {user.email}")

        return Response({
            "detail": "Tu contraseña ha sido restablecida exitosamente.",
        }, status=status.HTTP_200_OK)
