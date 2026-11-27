from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel
from apps.methodology.models.factor import Factor


class Subfactor(BaseModel):
    name = models.CharField(max_length=255, verbose_name="Nombre", unique=True)
    description = models.TextField(null=True, blank=True, verbose_name=_("Descripción"))
    factor = models.ForeignKey(Factor, on_delete=models.CASCADE, related_name="subfactors") 
    order = models.PositiveIntegerField(verbose_name=_("Orden"))

    def __str__(self):
        return f"{self.order}) Subfactor: {self.name} - ({self.factor.name})"

    class Meta:
        verbose_name = _("Subfactor")
        verbose_name_plural = _("Subfactores")  
        ordering = ["order"]     
 
        indexes =  [
            models.Index(fields=["name"], name="idx_subfactor_name")
        ]
