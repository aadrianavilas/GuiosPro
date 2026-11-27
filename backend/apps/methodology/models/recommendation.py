from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel


class Recommendation(BaseModel):
    class Code(models.TextChoices):
        A = "A", _("Categoría A - Favorable")
        B = "B", _("Categoría B - Con reservas")
        C = "C", _("Categoría C - Desfavorable / Recursos requeridos")

    code = models.CharField(
        max_length=1,
        choices=Code.choices,
        unique=True,
        verbose_name=_("Código de recomendación"),
    )
    title = models.CharField(
        max_length=120,
        verbose_name=_("Título"),
    )
    description = models.TextField(
        verbose_name=_("Descripción / Texto oficial de la metodología"),
    )
    order = models.PositiveIntegerField(
        default=1,
        verbose_name=_("Orden de visualización"),
    )

    def __str__(self):
        return f"Recomendación {self.code}: {self.title}"

    class Meta:
        verbose_name = _("Recomendación")
        verbose_name_plural = _("Recomendaciones")
        ordering = ["order", "code"]
        indexes = [
            models.Index(fields=["code"], name="idx_recommendation_code"),
        ]
