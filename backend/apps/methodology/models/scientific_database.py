from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.core.models import BaseModel


class ScientificDatabase(BaseModel):
    """
    Modelo para registrar las bases de datos científicas disponibles
    para la investigación y consulta bibliográfica automatizada.
    """
    name = models.CharField(
        max_length=150,
        unique=True,
        verbose_name=_("Nombre"),
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name=_("Descripción"),
    )

    class Meta:
        verbose_name = _("Base de datos científica")
        verbose_name_plural = _("Bases de datos científicas")
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"], name="idx_scidb_name"),
            models.Index(fields=["is_active"], name="idx_scidb_is_active"),
        ]

    def __str__(self) -> str:
        return self.name
