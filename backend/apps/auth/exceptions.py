from rest_framework.exceptions import APIException
from rest_framework import status


class EmailMFAError(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Error relacionado con MFA por correo."
    default_code = "email_mfa_error"