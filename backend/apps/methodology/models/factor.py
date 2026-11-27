from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel
from apps.methodology.models.dimension import Dimension
from apps.methodology.models.scale import ScaleLevel


class Factor(BaseModel):
    name = models.CharField(max_length=100, verbose_name="Nombre", unique=True)
    description = models.TextField(null=True, blank=True, verbose_name=_("Descripción"))
    dimension = models.ForeignKey(Dimension, on_delete=models.CASCADE, related_name="factors") 
    total_citations = models.IntegerField(default=0, verbose_name=_("Total de citas"))
    expert_importance = models.IntegerField(default=0, verbose_name=_("Importancia del experto"))
    suggested_importance = models.ForeignKey(ScaleLevel, on_delete=models.SET_NULL, null=True, blank=True, related_name="suggested_factors", verbose_name=_("Importancia sugerida"))
    literature_importance = models.ForeignKey(ScaleLevel, on_delete=models.SET_NULL, null=True, blank=True, related_name="literature_factors", verbose_name=_("Importancia de la literatura"))
    order = models.PositiveIntegerField(verbose_name=_("Orden"))

    def __str__(self):
        return f"{self.order}) Factor: {self.name} - ({self.dimension.name})"

    class Meta:
        verbose_name = _("Factor")
        verbose_name_plural = _("Factores") 
        ordering = ["order"]     
        indexes = [
            models.Index(fields=["name"], name="idx_factor_name")
        ]
