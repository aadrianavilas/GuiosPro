from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.core.models import BaseModel


class Dimension(BaseModel):
    name = models.CharField(max_length=100, verbose_name="Nombre",  unique=True)
    description = models.TextField(null=True, blank=True, verbose_name=_("Descripción"))
    order = models.PositiveIntegerField(verbose_name=_("Orden"))

    def __str__(self):
        return f"{self.order}) {self.name}"

    class Meta:
        verbose_name = _("Dimensión")
        verbose_name_plural = _("Dimensiones")
        ordering = ["order"]
        indexes = [
            models.Index(fields=["name"], name="idx_dimension_name")
        ] 
    
