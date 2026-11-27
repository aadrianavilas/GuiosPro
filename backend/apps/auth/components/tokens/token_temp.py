from typing_extensions import Tuple
from datetime import timedelta
from rest_framework_simplejwt.tokens import Token
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils.translation import gettext_lazy as _

from apps.auth.models.auth.user import User
from apps.auth.services.auth import CookieService


from django.conf import settings

import logging

logger = logging.getLogger(__name__)

class TokenTemp(Token):
    token_type = "temp"
    lifetime = settings.JWT_CUSTOM.get("TEMP_TOKEN_LIFETIME", timedelta(minutes=5))
    scope = "mfa_pending"

    @classmethod
    def create_for_user(cls, user:User)-> Token | None:
        """
            Genera un token temporal para el usuario
            
            Args:
                user: instancia del usuario al que se asocia el token
            Returns: 
                Token: token temporal generado para la autenticación MFA   
        """
        if not user:
            logger.error("No se está proporcionando un usuario")
            raise TokenError(_("Se requiere un usuario para generar el token"))

        token = cls.for_user(user)
        token["scope"] = cls.scope
        token["email"] = user.email

        return token
    
    @classmethod
    def verify_token(cls, token_str:str)->Token | None:
        """
            Verifica que el token temporal sea válido
            Args:
                token_str: token temporal
            Returns: 
                Token | None: token temporal verificado         

        """
        if not token_str:
            logger.error("No se está proporcionando un token")
            return None
        
        try:
            token = cls(token_str)
            if token.get('scope') != "mfa_pending":
                logger.error(f"Token sin scope de mfa_pending: {token_str}")
                raise TokenError(_("Token inválido"))

            return token
            
        except TokenError as e:
            logger.error(f"Error al verificar el token temporal: {e}")
            return None



class TempTokenAuthentication(BaseAuthentication):
    """
        Verifica que el token temporal asignado a un usuario sea válido
    """
    
    def authenticate(self, request) -> Tuple[User,TokenTemp] | None:

        token_temp = CookieService.get_cookie(request, "temp")

        if not token_temp:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token_temp = auth_header.split(" ", 1)[1].strip()
            elif request.headers.get("X-Temp-Token"):
                token_temp = request.headers.get("X-Temp-Token").strip()

        if not token_temp:
            return None
        
        verified_token = TokenTemp.verify_token(token_temp)

        if not verified_token:
            raise AuthenticationFailed(_("El token temporal es inválido o ha expirado"))
        
        try:
            user = User.objects.get(id=verified_token['user_id'])
        
        except User.DoesNotExist:
            raise AuthenticationFailed(_("El usuario asociado al token no existe"))
        
        return (user, verified_token)