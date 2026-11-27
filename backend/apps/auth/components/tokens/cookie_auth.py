from typing_extensions import Tuple
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.utils.translation import gettext_lazy as _

from apps.auth.models.auth.user import User
from apps.auth.services.auth import CookieService


class CookieJWTAuthentication(JWTAuthentication):
    """
    Extiende JWTAuthentication para extraer el token JWT desde:
    1. Cabecera 'Authorization: Bearer <token>' (estándar DRF / Swagger / Postman)
    2. O la cookie 'access' (manejada por AuthService / CookieService de GuiosPro)
    """

    def authenticate(self, request) -> Tuple[User, any] | None:
        # 1. Intentar primero con la cabecera estándar
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                try:
                    validated_token = self.get_validated_token(raw_token)
                    return self.get_user(validated_token), validated_token
                except (InvalidToken, AuthenticationFailed):
                    return None

        # 2. Si no hay cabecera, intentar con la cookie 'access'
        raw_token = CookieService.get_cookie(request, "access")
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token
        except (InvalidToken, AuthenticationFailed):
            # Si el token de la cookie expiró o es inválido, devolver None
            # para no romper endpoints públicos (AllowAny) y permitir que vistas protegidas
            # devuelvan el 401 apropiado a través de sus permission_classes.
            return None
