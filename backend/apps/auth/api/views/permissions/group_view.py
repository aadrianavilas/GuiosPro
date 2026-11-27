from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.exceptions import ValidationError
from django.contrib.auth.models import Group, Permission
from django.db import transaction
from django.db.models import Count

from apps.auth.models.permissions.module import Module
from apps.auth.models.permissions.module_option import ModuleOption
from apps.auth.models.permissions.module_option_permission import ModuleOptionPermission
from apps.auth.components.permissions.permissions import HasModulePermission
from apps.auth.components.permissions.constant import PERMISSIONS


# Mapeo de nombres legibles en español para permisos comunes de GuiosPro
FRIENDLY_PERMISSION_LABELS = {
    'view_dashboard': 'Ver panel principal',
    'view_user': 'Ver usuarios / perfil',
    'add_user': 'Crear usuario',
    'change_user': 'Editar usuario / perfil',
    'delete_user': 'Eliminar usuario',
    'view_organization': 'Ver organización',
    'change_organization': 'Registrar y editar organización',
    'add_evaluation': 'Crear evaluación',
    'view_evaluation': 'Ver evaluaciones e historial',
    'view_dimension': 'Ver dimensiones',
    'add_dimension': 'Crear dimensión',
    'change_dimension': 'Gestionar dimensiones',
    'delete_dimension': 'Eliminar dimensión',
    'view_factor': 'Ver factores',
    'add_factor': 'Crear factor',
    'change_factor': 'Gestionar factores',
    'delete_factor': 'Eliminar factor',
    'view_subfactor': 'Ver subfactores',
    'add_subfactor': 'Crear subfactor',
    'change_subfactor': 'Gestionar subfactores',
    'delete_subfactor': 'Eliminar subfactor',
    'view_scale': 'Ver escala',
    'add_scale': 'Crear escala',
    'change_scale': 'Gestionar escala',
    'delete_scale': 'Eliminar escala',
    'view_scope': 'Ver alcance',
    'add_scope': 'Crear alcance',
    'change_scope': 'Gestionar alcance',
    'delete_scope': 'Eliminar alcance',
    'view_recommendation': 'Ver recomendaciones',
    'add_recommendation': 'Crear recomendación',
    'change_recommendation': 'Gestionar recomendaciones',
    'delete_recommendation': 'Eliminar recomendación',
    'view_module': 'Ver módulos',
    'add_module': 'Crear módulo',
    'change_module': 'Gestionar módulos',
    'delete_module': 'Eliminar módulo',
    'view_moduleoption': 'Ver opciones de módulo',
    'add_moduleoption': 'Crear opción de módulo',
    'change_moduleoption': 'Gestionar opciones de módulo',
    'delete_moduleoption': 'Eliminar opción de módulo',
    'view_group': 'Ver grupos',
    'add_group': 'Crear grupo',
    'change_group': 'Gestionar grupos',
    'delete_group': 'Eliminar grupo',
    'view_moduleoptionpermission': 'Ver permisos por opción',
    'add_moduleoptionpermission': 'Asociar permisos por opción',
    'change_moduleoptionpermission': 'Gestionar permisos por opción',
    'delete_moduleoptionpermission': 'Eliminar permisos por opción',
}


class GroupViewSet(ModelViewSet):
    """
    ViewSet para la administración de grupos (roles) y matriz de permisos en GuiosPro.
    Permite listar, crear, editar grupos y sincronizar la asignación de permisos por opción de módulo.
    """
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    queryset = Group.objects.all().order_by('name')
    permission_classes = [HasModulePermission]
    required_permissions = {
        'list': [PERMISSIONS['GROUP_VIEW'], PERMISSIONS['GROUP_CHANGE']],
        'retrieve': [PERMISSIONS['GROUP_VIEW'], PERMISSIONS['GROUP_CHANGE']],
        'create': PERMISSIONS['GROUP_ADD'],
        'update': PERMISSIONS['GROUP_CHANGE'],
        'partial_update': PERMISSIONS['GROUP_CHANGE'],
        'destroy': PERMISSIONS['GROUP_DELETE'],
        'permissions_matrix': [
            PERMISSIONS['GROUP_VIEW'],
            PERMISSIONS['GROUP_CHANGE'],
            PERMISSIONS['PERMISSION_VIEW'],
            PERMISSIONS['PERMISSION_CHANGE'],
        ],
        'sync_permissions': [PERMISSIONS['GROUP_CHANGE'], PERMISSIONS['PERMISSION_CHANGE']],
        'assign_permission': [PERMISSIONS['GROUP_CHANGE'], PERMISSIONS['PERMISSION_CHANGE']],
        'remove_permission': [PERMISSIONS['GROUP_CHANGE'], PERMISSIONS['PERMISSION_CHANGE']],
    }

    def list(self, request, *args, **kwargs):
        """Retorna la lista de grupos con métricas de usuarios y permisos asignados."""
        groups = self.get_queryset()
        data = []
        for grp in groups:
            users_count = grp.user_set.count()
            permissions_count = grp.group_module_option_permissions.count()
            options_count = (
                grp.group_module_option_permissions.values('module_option_id').distinct().count()
            )
            data.append({
                'id': grp.id,
                'name': grp.name,
                'users_count': users_count,
                'permissions_count': permissions_count,
                'options_count': options_count,
            })
        return Response(data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        """Crea un nuevo grupo en el sistema."""
        name = request.data.get('name')
        if not name or not str(name).strip():
            raise ValidationError({'name': 'El nombre del grupo es obligatorio.'})

        clean_name = str(name).strip()
        if Group.objects.filter(name__iexact=clean_name).exists():
            raise ValidationError({'name': 'Ya existe un grupo con ese nombre.'})

        group = Group.objects.create(name=clean_name)
        return Response({
            'id': group.id,
            'name': group.name,
            'users_count': 0,
            'permissions_count': 0,
            'options_count': 0,
        }, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        """Actualiza el nombre de un grupo existente."""
        group = self.get_object()
        name = request.data.get('name')
        if name is not None:
            clean_name = str(name).strip()
            if not clean_name:
                raise ValidationError({'name': 'El nombre del grupo no puede estar vacío.'})
            if Group.objects.filter(name__iexact=clean_name).exclude(id=group.id).exists():
                raise ValidationError({'name': 'Ya existe otro grupo con ese nombre.'})
            group.name = clean_name
            group.save(update_fields=['name'])

        return Response({
            'id': group.id,
            'name': group.name,
            'users_count': group.user_set.count(),
            'permissions_count': group.group_module_option_permissions.count(),
            'options_count': group.group_module_option_permissions.values('module_option_id').distinct().count(),
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """Elimina un grupo, protegiendo los roles esenciales del sistema."""
        group = self.get_object()
        if group.name in ['Administrador', 'Decisor']:
            return Response(
                {'detail': f'El grupo "{group.name}" es un rol esencial del sistema y no puede eliminarse.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='permissions-matrix')
    def permissions_matrix(self, request):
        """
        Retorna la matriz completa de datos para la pestaña de 'Asociar permisos':
        - groups: Lista de grupos
        - available_permissions: Permisos relevantes del sistema con nombres amigables
        - modules: Módulos y sus opciones ordenadas
        - assignments: Asignaciones actuales de ModuleOptionPermission agrupadas por rol y opción
        """
        # 1. Grupos
        groups_data = [
            {
                'id': grp.id,
                'name': grp.name,
                'users_count': grp.user_set.count(),
                'permissions_count': grp.group_module_option_permissions.count(),
            }
            for grp in Group.objects.all().order_by('name')
        ]

        # 2. Permisos disponibles relevantes en GuiosPro
        # Tomamos los permisos que ya están en ModuleOptionPermission o corresponden a modelos del core
        relevant_codenames = list(
            ModuleOptionPermission.objects.values_list('permission__codename', flat=True).distinct()
        )
        if not relevant_codenames:
            relevant_codenames = list(FRIENDLY_PERMISSION_LABELS.keys())

        perms_qs = Permission.objects.filter(codename__in=relevant_codenames).order_by('codename')
        available_permissions = []
        for p in perms_qs:
            label = FRIENDLY_PERMISSION_LABELS.get(p.codename, p.name)
            available_permissions.append({
                'id': p.id,
                'codename': p.codename,
                'name': label,
                'raw_name': p.name,
            })

        # 3. Módulos y sus opciones de menú ordenadas
        modules_qs = Module.objects.all().prefetch_related('module_options').order_by('order', 'id')
        modules_data = []
        for mod in modules_qs:
            options_data = [
                {
                    'id': opt.id,
                    'name': opt.name,
                    'icon': opt.icon,
                    'path': opt.path,
                    'order': opt.order,
                    'is_active': opt.is_active,
                    'slug': opt.name.lower().replace(' ', '_'),
                }
                for opt in mod.module_options.all().order_by('order', 'id')
            ]
            modules_data.append({
                'id': mod.id,
                'name': mod.name,
                'icon': mod.icon,
                'order': mod.order,
                'options': options_data,
            })

        # 4. Asignaciones actuales (ModuleOptionPermission)
        assignments_qs = ModuleOptionPermission.objects.select_related(
            'group', 'module_option', 'permission'
        ).all()

        assignments_data = [
            {
                'id': mop.id,
                'group_id': mop.group_id,
                'module_option_id': mop.module_option_id,
                'permission_id': mop.permission_id,
                'permission_name': FRIENDLY_PERMISSION_LABELS.get(
                    mop.permission.codename, mop.permission.name
                ),
                'permission_codename': mop.permission.codename,
            }
            for mop in assignments_qs
        ]

        return Response({
            'groups': groups_data,
            'available_permissions': available_permissions,
            'modules': modules_data,
            'assignments': assignments_data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='sync-permissions')
    def sync_permissions(self, request, pk=None):
        """
        Sincroniza en lote todas las asignaciones de permisos de un grupo.
        Payload esperado:
        {
            "associations": [
                { "module_option_id": 1, "permission_ids": [101, 102] },
                ...
            ]
        }
        """
        group = self.get_object()
        associations = request.data.get('associations', [])

        if not isinstance(associations, list):
            return Response(
                {'detail': 'El formato de asociaciones debe ser una lista.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Eliminamos las asignaciones actuales del grupo
            ModuleOptionPermission.objects.filter(group=group).delete()

            # Insertamos las nuevas asignaciones
            new_objects = []
            for item in associations:
                module_option_id = item.get('module_option_id')
                permission_ids = item.get('permission_ids', [])

                if not module_option_id or not isinstance(permission_ids, list):
                    continue

                for perm_id in set(permission_ids):
                    new_objects.append(
                        ModuleOptionPermission(
                            group=group,
                            module_option_id=module_option_id,
                            permission_id=perm_id,
                        )
                    )

            if new_objects:
                ModuleOptionPermission.objects.bulk_create(new_objects, ignore_conflicts=True)

        return Response({
            'detail': f'Permisos del grupo "{group.name}" actualizados exitosamente.',
            'total_assigned': len(new_objects),
        }, status=status.HTTP_200_OK)
