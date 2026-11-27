import logging
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

from apps.auth.models.auth.user import User
from apps.auth.api.serializers.auth.auth import LoginSerializer, RegisterSerializer
from apps.auth.api.serializers.auth.user import UserSerializer
from apps.auth.services.auth import TokenService, AuthService, CookieService
from apps.auth.components.tokens.token_temp import TokenTemp
from apps.auth.components.mfa.email_mfa import EmailMFA
from apps.auth.services.mfa import EmailMFAService

logger = logging.getLogger(__name__)


class RegisterView(APIView):
    """
    Endpoint para el registro de nuevos usuarios en GuiosPro.
    Asigna automáticamente el rol de 'Decisor'.
    """
    permission_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response({
            "detail": "Usuario registrado exitosamente",
            "role": "Decisor",
            "user": UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = []

    def post(self, response):
        serializer = LoginSerializer(data=response.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        if not user:
            #Agregar más adelante el rate limiting

            return Response({
                "data": serializer.errors
            }, status=status.HTTP_401_UNAUTHORIZED)

        # Si el usuario es administrador exclusivo (sin rol de Decisor), no debe tener organización vinculada
        has_decisor = user.groups.filter(name="Decisor").exists()
        is_exclusive_admin = (user.is_superuser or user.is_staff or user.groups.filter(name="Administrador").exists()) and not has_decisor
        if is_exclusive_admin:
            from django.contrib.auth.models import Group
            admin_group = Group.objects.filter(name="Administrador").first()
            if admin_group and not user.groups.filter(name="Administrador").exists():
                user.groups.add(admin_group)
            if user.organization_id is not None:
                user.organization = None
                user.save(update_fields=["organization"])
        
        if not user.is_mfa_enabled:
            response = Response({
                "mfa_required": False,
                "user": UserSerializer(user).data, 
                "detail": "Inicio de sesión exitoso"
            }, status=status.HTTP_200_OK)

            return self._finalize_login_response(response, user)
        
        # Obtener los métodos MFA disponibles
        available_2fa_methods = self._get_available_mfa_methods(user)

        temp_token = TokenTemp.create_for_user(user)

        # Enviar automáticamente el código al email del usuario para agilizar el flujo
        if "email" in available_2fa_methods:
            try:
                code = EmailMFA.create_code(user.id)
                EmailMFAService.send_email_mfa(user.id, code)
            except Exception as e:
                logger.error(f"Error al enviar código MFA en login para {user.email}: {e}")

        masked_email = self._mask_email(user.email)
        code_length = getattr(settings, "VERIFICATION_CODE_LENGTH", 6)

        response = Response({
            "mfa_required": True,
            "available_mfa_methods": available_2fa_methods,
            "email": masked_email,
            "code_length": code_length,
            "temp_token": str(temp_token),
            "detail": "Debes completar el MFA para iniciar sesión"
        }, status=status.HTTP_200_OK)

        AuthService.set_cookie_tokens(response, (temp_token,))
        
        return response

    def _mask_email(self, email: str) -> str:
        if not email or "@" not in email:
            return email
        parts = email.split("@", 1)
        name, domain = parts[0], parts[1]
        if len(name) <= 2:
            masked_name = name[0] + "*"
        else:
            masked_name = name[0] + "*" * (len(name) - 2) + name[-1]
        return f"{masked_name}@{domain}"



    def _get_available_mfa_methods(self, user):
        """Devuelve los métodos MFA disponibles"""
        
        available_2fa_methods = ["email"]

        if user.webauthn_credentials.exists():
            available_2fa_methods.append("webauthn")

        return available_2fa_methods

    def _finalize_login_response(self, response, user):
        """
        Genera los tokens y los establece en las cookies.
        """
        tokens = TokenService.generate_auth_tokens(user)
        AuthService.set_cookie_tokens(response, (tokens.get("access_token"), tokens.get("refresh_token")))
        return response


class TokenRefreshView(APIView):
    """
    POST /api/v1/auth/token/refresh/
    Renueva el access token cuando caduca.
    Extrae el refresh token desde la cookie HTTP 'refresh' o desde el cuerpo de la petición.
    Genera un nuevo access token, rota el refresh token e invalida el anterior en blacklist.
    """
    permission_classes = []

    def post(self, request):
        refresh_str = (
            request.COOKIES.get("refresh")
            or request.COOKIES.get("refresh_token")
            or request.data.get("refresh")
            or request.data.get("refresh_token")
        )

        if not refresh_str:
            return Response(
                {"detail": "No se encontró el token de actualización (refresh token)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            old_refresh = RefreshToken(refresh_str)
            user_id = old_refresh.get(settings.SIMPLE_JWT.get("USER_ID_CLAIM", "user_id"))
            user = User.objects.filter(id=user_id, is_active=True).first()

            if not user:
                raise InvalidToken("Usuario no encontrado o inactivo.")

            # Generar nuevos tokens
            new_tokens = TokenService.generate_auth_tokens(user)

            # Agregar el refresh token previo a la blacklist
            try:
                old_refresh.blacklist()
            except Exception as bl_err:
                logger.info(f"El token ya estaba en blacklist o no se pudo registrar: {bl_err}")

            response = Response({
                "detail": "Token renovado exitosamente.",
                "access": str(new_tokens["access_token"]),
                "user": UserSerializer(user).data,
            }, status=status.HTTP_200_OK)

            # Actualizar cookies seguras con los nuevos tokens
            AuthService.set_cookie_tokens(
                response,
                (new_tokens["access_token"], new_tokens["refresh_token"])
            )
            return response

        except (TokenError, InvalidToken) as e:
            response = Response(
                {"detail": f"Token de actualización expirado o no válido: {str(e)}"},
                status=status.HTTP_401_UNAUTHORIZED
            )
            # Limpiar cookies de sesión caducadas
            AuthService.clear_auth_cookie(response)
            return response


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Cierra la sesión del usuario tanto por solicitud propia como por inactividad.
    Agrega el refresh token a la blacklist de SimpleJWT y elimina las cookies del navegador.
    """
    permission_classes = []

    def post(self, request):
        refresh_str = (
            request.COOKIES.get("refresh")
            or request.COOKIES.get("refresh_token")
            or request.data.get("refresh")
            or request.data.get("refresh_token")
        )

        if refresh_str:
            try:
                refresh = RefreshToken(refresh_str)
                refresh.blacklist()
            except Exception as e:
                logger.info(f"No se pudo añadir refresh token a blacklist o ya estaba revocado: {e}")

        response = Response(
            {"detail": "Sesión cerrada correctamente. Tokens revocados."},
            status=status.HTTP_200_OK
        )

        # Eliminar exhaustivamente todas las cookies asociadas
        AuthService.clear_auth_cookie(response)
        for cookie_name in ["access", "refresh", "access_token", "refresh_token", "temp", "temp_token", "sessionid", "csrftoken"]:
            CookieService.delete_cookie(response, cookie_name)
            response.delete_cookie(cookie_name, path="/")

        return response

        

    

        






        


