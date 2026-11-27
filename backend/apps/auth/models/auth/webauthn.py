from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.auth.models.auth.user import User

class WebAuthnCredential(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="webauthn_credentials")
    credential_id = models.CharField(_("ID de Credencial"), max_length=255, unique=True)
    public_key = models.CharField(_("Clave Pública"), max_length=1000)
    sign_count = models.IntegerField(_("Conteo de Firma"), default=0)
    created_at = models.DateTimeField(_("Fecha de creación"), auto_now_add=True)
    
    class Meta:
        verbose_name = _("Credencial WebAuthn")
        verbose_name_plural = _("Credenciales WebAuthn")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} - {self.credential_id}"

    
