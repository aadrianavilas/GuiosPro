from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

from apps.auth.models.auth.user import User

class EmailMFACode(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", _("Activo")
        EXPIRED = "EXPIRED", _("Caducado")
        USED = "USED", _("Usado")
        MAX_ATTEMPTS = "MAX_ATTEMPTS", _("Máximo de intentos")

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="email_mfa")
    number_secret = models.CharField(_("Número Secreto"), max_length=64)
    expired_at = models.DateTimeField(_("Fecha de expiración"))
    attemps = models.IntegerField(_("Intentos"), default=0)
    status = models.CharField(_("Estado"), max_length=25, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(_("Fecha de creación"), auto_now_add=True)

    class Meta:
        verbose_name = _("Código MFA de Correo")
        verbose_name_plural = _("Códigos MFA de Correo")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} - {self.number_secret}"

    @property
    def is_expired(self):
        return self.expired_at > timezone.now()

