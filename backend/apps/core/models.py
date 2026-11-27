from django.db import models
from django.utils.translation import gettext_lazy as _

# Create your models here.

class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Fecha de creación"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Fecha de actualización"))
    is_active = models.BooleanField(default=True, verbose_name=_("¿Está activo?")) 

    class Meta:
        abstract = True
        ordering = ['-created_at']
