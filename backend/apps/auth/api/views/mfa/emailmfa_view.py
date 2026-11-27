from django.conf import settings

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView

from apps.auth.services.auth import AuthService, TokenService, CookieService
from apps.auth.services.mfa import EmailMFAService
from apps.auth.components.mfa.email_mfa import EmailMFA
from apps.auth.components.tokens.token_temp import TokenTemp, TempTokenAuthentication
from apps.auth.api.serializers.auth.user import UserSerializer


class EmailMFAView(APIView):
    authentication_classes = [TempTokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request):

        user_id = request.user.id      

        self._preparate_send_email_mfa(user_id)

        return Response({
            "detail": "Código de verificación enviado correctamente"
        }, status=status.HTTP_200_OK)

    def _preparate_send_email_mfa(self, user_id):
        code = EmailMFA.create_code(user_id)
        EmailMFAService.send_email_mfa(user_id, code)
    
    
class EmailMFAVerifyView(APIView):
    authentication_classes = [TempTokenAuthentication]
    permission_classes = [IsAuthenticated]
    length_code = settings.VERIFICATION_CODE_LENGTH
    
    def post(self, request):

        code = request.data.get("code")

        if not code or len(code) != self.length_code or not code.isdigit():
            return Response({
                "data": "Código no válido"
            }, status=status.HTTP_400_BAD_REQUEST)

        try: 
            email_mfa = EmailMFA(code)
            email_mfa.verify_code(request.user.id)

            user = request.user

            tokens = TokenService.generate_auth_tokens(user)

            response = Response({
                "detail": "Inicio de sesión completado correctamente",
                "user": UserSerializer(user).data
            }, status=status.HTTP_200_OK)

            AuthService.set_cookie_tokens(response, (tokens.get("access_token"), tokens.get("refresh_token")))

            CookieService.delete_cookie(response, "temp")

            return response
        
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        