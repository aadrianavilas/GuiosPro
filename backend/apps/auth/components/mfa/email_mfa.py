from abc import abstractmethod
import logging
import secrets
from django.conf import settings
from django.utils import timezone
import hmac
import hashlib
from django.utils.translation import gettext_lazy as _
from django.db import transaction

from apps.auth.models.auth.user import User
from apps.auth.exceptions import EmailMFAError
from apps.auth.models.auth.emailmfa import EmailMFACode
from apps.auth.selectors.mfa import select_email_code


logger = logging.getLogger(__name__)

class EmailMFABase:
    max_attemps = None
    lifetime = None

    def __init__(self, code:str = None) -> None:

        if self.max_attemps is None or self.lifetime is None:
            raise EmailMFAError(_("No se ha proporcionado el número de intentos o el tiempo de vida del código"))

        self.code = None
        self.code_unhash = None

        if code is not None:
            self.code = self._hash_secret_code(code)
            
    @staticmethod
    def _generate_secret_code() -> str:
        """
            Genera un código secreto aleatorio de de n dígitos
            Returns:
                str: código secreto de n dígitos     
        """
        dig =  settings.VERIFICATION_CODE_LENGTH
        return f"{secrets.randbelow(10**dig):0{dig}d}"
            
    def _hash_secret_code(self, code:str) -> str:
        """
            Genera un hash HMAC-SHA256 del código secreto.
            Args:
                code (str): Código secreto que se desea procesar.

            Returns:
                str: Hash hexadecimal del código secreto.
        """
        
        return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()

    def _check_code_db(self, code_db:str)-> bool:
        """
        Compara el código con el código de la base de datos
        Args:
            code_db: Hash del código almacenado en la base de datos
        
        Returns:
            bool: True si ambos valores coinciden; False en caso contrario

        """
        return hmac.compare_digest(self.code, code_db)

    def generate_code(self) -> None:
        """
            Genera el código de 6 dígitos y utiliza un hash 
        """
        self.code_unhash = self._generate_secret_code()
        self.code = self._hash_secret_code(self.code_unhash)
        
    @abstractmethod
    def create_code(self, user_id:int):
        """
        Crea un código para el usuario
        Args:
            user_id: id del usuario al que se asocia el código
        """
        pass
    
    @abstractmethod
    def verify_code(self, user_id:int):
        """
        Verifica el código
        Args:
            user_id: id del usuario al que se asocia el código
        """
        pass

    
class EmailMFA(EmailMFABase):

    max_attemps = settings.EMAIL_CODE_MAX_ATTEMPTS
    lifetime = settings.EMAIL_CODE_LIFETIME


    @classmethod
    @transaction.atomic
    def create_code(cls, user_id:int) -> str:
        """
            Crea un código de 6 dígitos y lo guarda en la base de datos
            user_id: id del usuario al que se asocia el código
        """
        try: 
            user  = User.objects.select_for_update().get(pk=user_id)
        except User.DoesNotExist:
            raise EmailMFAError(_("El usuario no existe"))

        now = timezone.now()

        latest_code = select_email_code(user=user, status=EmailMFACode.Status.ACTIVE).first()
        

        if latest_code:
            # Expiramos el código activo previo para emitir un nuevo código de verificación
            latest_code.status = EmailMFACode.Status.EXPIRED
            latest_code.save(update_fields=["status"])
                

        code_secrect = cls()
        code_secrect.generate_code()

        EmailMFACode.objects.create(
            user=user,
            number_secret=code_secrect.code,
            expired_at=now + cls.lifetime,
            attemps = settings.EMAIL_CODE_MIN_ATTEMPTS
        )

        return code_secrect.code_unhash

    
    def verify_code(self, user_id:int)->None:
        """
            Verifica que el código de verificación sea válido
            user_id: id del usuario al que se asocia el código
        """

        if self.code is None:
            raise EmailMFAError(_("No se ha proporcionado un código"))

        try: 
            with transaction.atomic():
                user  = User.objects.select_for_update().get(pk=user_id)
                
        except User.DoesNotExist:
            raise EmailMFAError(_("El usuario no existe"))
            
        now = timezone.now()

        latest_code = select_email_code(user=user, status=EmailMFACode.Status.ACTIVE).first()

        if latest_code is None:
            raise EmailMFAError(_("No se ha encontrado un código activo para este usuario"))

        if latest_code.expired_at <= now:
            latest_code.status = EmailMFACode.Status.EXPIRED
            latest_code.save(update_fields=["status"])
            raise EmailMFAError(_("El código ha expirado"))
        
        if latest_code.attemps >= self.max_attemps:
            latest_code.status = EmailMFACode.Status.MAX_ATTEMPTS
            latest_code.save(update_fields=["status"])
            raise EmailMFAError(_("El código ha superado el número máximo de intentos"))

        if not self._check_code_db(latest_code.number_secret):
            latest_code.attemps += 1
            latest_code.save(update_fields=["attemps"])
            raise EmailMFAError(_("El código es incorrecto"))

        latest_code.status = EmailMFACode.Status.USED
        latest_code.save(update_fields=["status"])
        



     
# EmailMFA.create_code(user)
