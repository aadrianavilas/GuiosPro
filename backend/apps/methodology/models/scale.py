from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel


class Scale(BaseModel):
    name = models.CharField(max_length=100, verbose_name=_("Nombre"), unique=True)
    description = models.TextField(verbose_name=_("Descripción"))

    def __str__(self):
        
        return f"{self.name}"


class ScaleLevel(BaseModel):
    scale = models.ForeignKey(Scale, on_delete=models.CASCADE, related_name="scale_levels", verbose_name=_("Escala"))
    value = models.PositiveSmallIntegerField(verbose_name=_("Valor"))
    label = models.CharField(max_length=100, verbose_name=_("Label"))
    order = models.PositiveIntegerField(verbose_name=_("Orden"))

    def __str__(self):
        return f"{self.label} ({self.value})"


    class Meta:
        ordering = ["order"]
        verbose_name = _("Nivel de escala")
        verbose_name_plural = _("Niveles de escala")

        indexes = [
            models.Index(fields=["value", "label"], name="idx_scale_value_label"),
            models.Index(fields=["scale", "value", "label"], name="idx_scale_scale_value_label")
        ]

        constraints = [
            models.UniqueConstraint(fields=["scale","label"], name="uq_scale_scale_lavel")
        ]
    
