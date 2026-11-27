from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel
from apps.auth.models.auth.user import User


class Organization(BaseModel):

    class OrganizationType(models.TextChoices):
        PUBLIC      = 'public',      _('Pública')
        PRIVATE     = 'private',     _('Privada')
        EDUCATIONAL = 'educational', _('Educativa')
        NGO         = 'ngo',         _('ONG')
        OTHER       = 'other',       _('Otra')

    # ── Campos obligatorios ────────────────────────────────────────────
    business_name = models.CharField(
        verbose_name=_("Razón social"),
        max_length=120,
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name=_("Usuario"),
        related_name="user_organizations",
    )
    organization_type = models.CharField(
        verbose_name=_("Tipo de organización"),
        max_length=20,
        choices=OrganizationType.choices,
        default=OrganizationType.OTHER,
    )
    city = models.CharField(
        verbose_name=_("Ciudad"),
        max_length=100,
        default="",
    )
    country = models.CharField(
        verbose_name=_("País"),
        max_length=100,
        default="",
    )

    # ── Campos opcionales ──────────────────────────────────────────────
    commercial_name = models.CharField(
        verbose_name=_("Nombre comercial"),
        max_length=120,
        blank=True,
        null=True,
    )
    sector = models.CharField(
        verbose_name=_("Sector"),
        max_length=100,
        blank=True,
        null=True,
    )
    address = models.CharField(
        verbose_name=_("Dirección"),
        max_length=200,
        blank=True,
        null=True,
    )

    def __str__(self):
        return self.business_name

    class Meta:
        verbose_name = _("Organización")
        verbose_name_plural = _("Organizaciones")
        indexes = [
            models.Index(fields=["business_name"], name="idx_org_business_name"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["business_name", "user"],
                name="uq_organization_business_name_user",
            ),
        ]
