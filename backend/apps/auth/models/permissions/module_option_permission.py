from django.db import models
from django.contrib.auth.models import Group, Permission
from django.utils.translation import gettext_lazy as _
from django.db.models import UniqueConstraint

from .module_option import ModuleOption


class ModuleOptionPermission(models.Model):
    module_option = models.ForeignKey(
        ModuleOption,
        on_delete=models.CASCADE,
        related_name='module_option_module_option_permissions',
        verbose_name=_('Opción del módulo'),
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='group_module_option_permissions',
        verbose_name=_('Rol con acceso'),
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name='permission_module_option_permissions',
        verbose_name=_('Permiso asociado'),
    )
    order = models.PositiveSmallIntegerField(
        default=0,
        verbose_name=_('Orden'),
    )
    
    description = models.TextField(
        blank=True,
        verbose_name=_('Descripción'),
        help_text=_('Explicación de qué permite hacer este permiso.'),
    )

    class Meta:
        verbose_name = _('Permiso de opción del módulo')
        verbose_name_plural = _('Permisos de las opciones del módulo')
        ordering = [
            'module_option__module__order',
            'module_option__order',
            'order',
        ]
        constraints = [
            UniqueConstraint(
                fields=['group', 'module_option', 'permission'],
                name='uq_group_module_option_permission'
            )
        ]

    def __str__(self):
        return f"[{self.group.name}] {self.module_option.name} -> {self.permission.name}"