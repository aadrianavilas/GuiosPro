import uuid
import logging
from django.conf import settings
from django.utils.translation import gettext_lazy as _

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework.request import Request
from typing_extensions import Tuple


logger = logging.getLogger(__name__)

class TokenService:

    @staticmethod
    def generate_auth_tokens(user) -> dict:
        """
            Genera los tokens de acceso y refesh para un usuario
        """

        if not user:
            logger.error("No se está proporcionando un usuario para generar los tokens")
            return None

        sid = str(uuid.uuid4())
        
        refresh_token = RefreshToken.for_user(user)

        refresh_token['sid'] = sid
        refresh_token['email'] = user.email
        refresh_token['username'] = user.username
        refresh_token['first_name'] = user.first_name
        refresh_token['last_name'] = user.last_name

        return {
            "sid": sid,
            "refresh_token": refresh_token,
            "access_token": refresh_token.access_token,
        }

    @staticmethod
    def set_blacklist_token(refresh):
        """
            Invalida el refresh token al agregarlo a la blacklist
        """
        refresh_token = RefreshToken(refresh)
        refresh_token.blacklist()

class CookieService:

    @staticmethod
    def get_cookie(request: Request, cookie_name:str) -> str | None:
        """
        Obtiene el valor de una cookie de la solicitud HTTP.

        Args:
            request: Solicitud HTTP recibida.
            cookie_name: Nombre de la cookie que se desea obtener.

        Returns:
            str | None: Valor de la cookie o None si no existe.
        """
        return request.COOKIES.get(cookie_name)

    @staticmethod
    def set_cookie(response: Response, key:str, value:str, max_age:int, 
                   http_only:bool=True, same_site:str="Lax", path:str="/")->None:

        """
        Establece una cookie en la respuesta HTTP.

        Args:
            response: Respuesta HTTP donde se establecerá la cookie.
            key: Nombre de la cookie.
            value: Valor de la cookie.
            max_age: Tiempo de vida de la cookie en segundos.
        """

        is_secure = getattr(settings, 'JWT_COOKIE_SECURE', not settings.DEBUG)
        
        response.set_cookie(
                key=key,
                value=value,
                max_age=max_age,
                httponly=http_only,
                samesite=same_site,
                secure=is_secure,
                path = path
            )
    
    @staticmethod
    def delete_cookie(response: Response, cookie_name:str) -> None:
        """
            Elimina una cookie de la respuesta HTTP.

            Args:
                response: Respuesta HTTP.
                cookie_name: Nombre de la cookie que se eliminará.
        """
        response.delete_cookie(cookie_name)

class AuthService:
    
    @staticmethod
    def set_cookie_tokens(response: Response, tokens:tuple) -> None:
        """
            Establece varios tokens de autenticación en cookies HTTP.

            Args:
                response: Respuesta HTTP
                tokens: tupla con los tokens a guardar en las cookies
        """
        if not tokens:
            raise ValueError(_("No se ha proporcionado ningún token"))
            
        for token in tokens:
            token_type = token.token_type
            token_value = str(token)

            token_seconds = (
                settings.JWT_CUSTOM.get(f"{token_type.upper()}_TOKEN_LIFETIME")
                or settings.SIMPLE_JWT.get(f"{token_type.upper()}_TOKEN_LIFETIME")
            )

            if not token_seconds:
                raise ValueError(f"Token no válido")
            
            token_seconds = int(token_seconds.total_seconds())

            CookieService.set_cookie(response, token_type, token_value, token_seconds)
            


    @staticmethod
    def clear_auth_cookie(response: Response, cookies: Tuple = ('access', 'refresh', 'access_token', 'refresh_token', 'temp', 'temp_token')) -> None:
        """
            Elimina las cookies de autenticación al cerrar sesión
        """
        for cookie in cookies:
            CookieService.delete_cookie(response, cookie)
            response.delete_cookie(cookie, path="/")


        
    
