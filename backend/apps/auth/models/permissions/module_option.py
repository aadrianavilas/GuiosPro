from django.db import models
from django.utils.translation import gettext_lazy as _
from .module import Module


class ModuleOption(models.Model):

    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='module_options', verbose_name=_('Categoría Módulo'))
    name = models.CharField(max_length=100, verbose_name=_('Etiqueta (Botón)'))
    icon = models.CharField(max_length=50, verbose_name=_('Nombre del Ícono (React)'))
    path = models.CharField(max_length=255, verbose_name=_('Ruta Relativa (/organization, /evaluations/new, ...)'))
    order = models.PositiveIntegerField(default=0, verbose_name=_('Orden de Aparición'))
    is_active = models.BooleanField(default=True, verbose_name=_('Visible / Activo'))

    class Meta:
        verbose_name = _('Opción de módulo')
        verbose_name_plural = _('Opciones de módules')
        ordering = ['module__order', 'order']
        

    def __str__(self):
        return f"[{self.module.name}] {self.name}"