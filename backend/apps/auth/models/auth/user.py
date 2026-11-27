from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from django.db import models


class User(AbstractUser):

    email = models.EmailField(_("email address"), unique=True)
    avatar = models.FileField(_("Avatar"), upload_to="avatars/", blank=True, null=True)
    is_mfa_enabled = models.BooleanField(_("MFA Habilitado"), default=False)
    organization = models.ForeignKey(
        "evaluation.Organization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
        verbose_name=_("Organización"),
    )
    created_at = models.DateTimeField(_("Fecha de creación"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Fecha de actualización"), auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "first_name", "last_name"]

    class Meta:
        verbose_name = _("Usuario")
        verbose_name_plural = _("Usuarios")
        ordering = ["-created_at"]
        

    def __str__(self):
        return f"{self.email} - {self.first_name} {self.last_name}"
