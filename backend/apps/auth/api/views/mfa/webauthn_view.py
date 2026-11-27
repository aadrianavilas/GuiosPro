from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
try:
    from webauthn.helpers.exceptions import WebAuthnException
except ImportError:
    class WebAuthnException(Exception):
        pass

from apps.auth.components.tokens.token_temp import TempTokenAuthentication
from apps.auth.services.mfa import WebAuthnService
from apps.auth.services.auth import CookieService
from apps.auth.api.serializers.auth.user import UserSerializer
from apps.auth.services.auth import AuthService
from apps.auth.services.auth import TokenService




class WebAuthnAuthenticateView(APIView):
    authentication_classes = [TempTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        try:
            options_data = WebAuthnService.authenticate_option_for_user(user)
            return Response(options_data, status=status.HTTP_200_OK)     
        except WebAuthnException as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class WebAuthnVerifyAuthenticateView(APIView):
    authentication_classes = [TempTokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        auth_response = request.data.get("authentication_response")

        if not auth_response:
            return Response({
                "detail": "No se ha proporcionado la credencial de autenticación"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user

        try:
            WebAuthnService.verify_credential_authentication(user, auth_response)

            tokens = TokenService.generate_auth_tokens(user)

            response = Response({
                "detail": "Inicio de sesión compeltado correctamente",
                "user": UserSerializer(user).data
            })

            AuthService.set_cookie_tokens(response, (tokens.get("access_token"), tokens.get("refresh_token")))

            CookieService.delete_cookie(response, "temp")

            return response
        
        except WebAuthnException as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class WebAuthnRegisterOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        try: 
            options_data = WebAuthnService.register_option_for_user(user) 

            return Response(options_data, status=status.HTTP_200_OK)
            
        except WebAuthnException as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class WebAuthnVerifyView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        registration_response = request.data.get("registration_response")

        if not registration_response:
            return Response({
                "detail": "No se ha proporcionado la credencial del registro de autenticación"
            }, status=status.HTTP_400_BAD_REQUEST)

        user = request.user

        try: 

            credential_verified = WebAuthnService.verify_credential_registration(user,registration_response)

            WebAuthnService.create_webauthn_credential(user,credential_verified)

            return Response({
                "detail": "Credencial de autenticación creada correctamente"
            }, status=status.HTTP_201_CREATED)

        except WebAuthnException as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


        










        