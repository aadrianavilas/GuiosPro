from django.db import models
from django.utils.translation import gettext_lazy as _

class Module(models.Model):

    name = models.CharField(max_length=100, verbose_name=_('Nombre de la Categoría'))
    order = models.PositiveIntegerField(default=0, verbose_name=_('Orden de Aparición'))
    icon = models.CharField(max_length=50, blank=True, null=True, verbose_name=_('Ícono (Opcional)'))

    class Meta:

        verbose_name = _('Categoría de Módulo')
        verbose_name_plural = _('Categorías de Módulos')
        ordering = ['order', 'name']

    def __str__(self):
        return self.name