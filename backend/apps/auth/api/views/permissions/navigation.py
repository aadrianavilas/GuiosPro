from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.contrib.auth.models import Group

from apps.auth.models.permissions.module import Module
from apps.auth.models.permissions.module_option import ModuleOption
from apps.auth.api.serializers.permissions.module_option import ModuleOptionSerializer


class UserNavigationModulesView(APIView):
    """
    GET /api/v1/navigation/modules/
    Retorna los módulos y las opciones de navegación consultadas directamente desde la base de datos
    según los roles/grupos del usuario (RBAC).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from django.core.management import call_command

        # Auto-seed de rescate si los módulos o sus opciones aún no han sido cargados en la BD
        if (
            not Module.objects.exists()
            or not ModuleOption.objects.exists()
            or ModuleOption.objects.count() < 4
        ):
            try:
                call_command('seed_roles_and_permissions')
            except Exception:
                pass

        # Sanitización de rutas existentes en la BD:
        # Solo el panel principal debe usar /dashboard; las demás deben usar rutas directas
        for mo in ModuleOption.objects.filter(path__startswith='/dashboard/'):
            if mo.path != '/dashboard':
                mo.path = mo.path.replace('/dashboard/', '/', 1)
                mo.save(update_fields=['path'])

        user = request.user
        active_group_param = request.headers.get('X-Active-Group') or request.query_params.get('active_group')

        if user and user.is_authenticated:
            user_groups = user.groups.all()
            group_names = [g.name for g in user_groups]

            # Auto-asignación de rescate si no tiene grupos
            if not user_groups.exists():
                decisor_group = Group.objects.filter(name='Decisor').first()
                if decisor_group:
                    user.groups.add(decisor_group)
                    user_groups = user.groups.all()
                    group_names = [g.name for g in user_groups]

            # Determinar rol activo (si el usuario eligió uno en frontend entre sus grupos disponibles)
            active_role = None
            if active_group_param:
                clean_param = str(active_group_param).strip()
                matched = user_groups.filter(name__iexact=clean_param).first()
                if matched:
                    active_role = matched.name
                elif user.is_superuser or user.is_staff:
                    active_role = clean_param

            if not active_role:
                if user.is_superuser or user.is_staff or ('Administrador' in group_names):
                    active_role = 'Administrador'
                elif group_names:
                    active_role = group_names[0]
                else:
                    active_role = 'Decisor'

            if active_role.lower() == 'administrador':
                # El Administrador ve todas las opciones de sus módulos administrativos
                options_qs = ModuleOption.objects.filter(is_active=True).exclude(
                    module__name__in=['Organización', 'Evaluación']
                ).exclude(
                    path__in=['/organization', '/evaluations/new', '/evaluations/history']
                )
            else:
                # Opciones según el grupo específico activo
                target_group = user_groups.filter(name__iexact=active_role).first()
                if target_group:
                    options_qs = ModuleOption.objects.filter(
                        is_active=True,
                        module_option_module_option_permissions__group=target_group
                    ).distinct()
                else:
                    options_qs = ModuleOption.objects.filter(
                        is_active=True,
                        module_option_module_option_permissions__group__in=user_groups
                    ).distinct()
        else:
            # Para solicitudes no autenticadas, consultar las opciones de Decisor desde la BD
            decisor_group = Group.objects.filter(name='Decisor').first()
            if decisor_group:
                options_qs = ModuleOption.objects.filter(
                    is_active=True,
                    module_option_module_option_permissions__group=decisor_group
                ).distinct()
            else:
                options_qs = ModuleOption.objects.filter(is_active=True).exclude(
                    module__name__in=['Metodología', 'Configuración']
                )

        # Fallback de seguridad: si options_qs quedó vacío por roles incompletos,
        # asegurar que nunca se expongan Organización ni Evaluación a un Administrador
        if not options_qs.exists():
            options_qs = ModuleOption.objects.filter(is_active=True)
            if user and user.is_authenticated and (user.is_superuser or 'Administrador' in [g.name for g in user.groups.all()]):
                options_qs = options_qs.exclude(
                    module__name__in=['Organización', 'Evaluación']
                ).exclude(
                    path__in=['/organization', '/evaluations/new', '/evaluations/history']
                )

        module_ids = options_qs.values_list('module_id', flat=True).distinct()
        modules = Module.objects.filter(id__in=module_ids).order_by('order', 'name')

        result = []
        for module in modules:
            module_options = options_qs.filter(module=module).order_by('order', 'name')
            result.append({
                "id": module.id,
                "name": module.name,
                "icon": module.icon,
                "order": module.order,
                "options": ModuleOptionSerializer(module_options, many=True).data
            })

        return Response(result, status=status.HTTP_200_OK)

