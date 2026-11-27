from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel

class Software(BaseModel):

    name = models.CharField(max_length=120, verbose_name=_("Nombre del software"))
    description = models.TextField(verbose_name=_("Descripción"), blank=True, null=True)
    version = models.CharField(max_length=50, verbose_name= _("Versión"), blank=True, null=True)

    def __str__(self):
        
        return f"{self.name} - {self.version}"

    class Meta:
        verbose_name = _("Software")
        verbose_name_plural = _("Softwares")   
