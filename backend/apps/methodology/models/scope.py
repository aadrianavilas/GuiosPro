from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel

class Scope(BaseModel):
    name = models.CharField(verbose_name=_("Nombre"), max_length=120, unique=True, default="")
    description = models.TextField(verbose_name=_("Descripción"), blank=True, null=True)

    def __str__(self):

        return f"{self.name}"

