"""
===========================================================================
GUIOSPRO - Management Command: seed_roles_and_permissions
===========================================================================
Uso:
    python manage.py seed_roles_and_permissions

Crea y sincroniza en la base de datos:
  1. Grupos / Roles de negocio: 'Decisor' y 'Administrador'.
  2. Módulos de navegación (Module).
  3. Opciones de cada módulo (ModuleOption).
  4. Permisos granulares RBAC (ModuleOptionPermission) por rol.
===========================================================================
"""
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand
from django.core.management import call_command

from apps.auth.models.permissions.module import Module
from apps.auth.models.permissions.module_option import ModuleOption
from apps.auth.models.permissions.module_option_permission import ModuleOptionPermission


# ---------------------------------------------------------------------------
# Estructura de módulos, opciones y permisos por rol
# ---------------------------------------------------------------------------
ESTRUCTURA_MODULOS = {
    # ── DECISOR (Y ADMINISTRADOR) ──────────────────────────────────────────
    "Dashboard": {
        "order": 1,
        "icon": "HomeIcon",
        "opciones": [
            {
                "name": "Panel principal",
                "path": "/dashboard",
                "icon": "HomeIcon",
                "order": 1,
                "permisos": {
                    "Decisor": ["view_dashboard"],
                    "Administrador": ["view_dashboard"],
                },
                "descripcion": "Vista principal con resumen general y accesos rápidos.",
            }
        ],
    },
    "Organización": {
        "order": 2,
        "icon": "BuildingOfficeIcon",
        "opciones": [
            {
                "name": "Organización",
                "path": "/organization",
                "icon": "BuildingOfficeIcon",
                "order": 1,
                "permisos": {
                    "Decisor": ["view_organization", "change_organization"],
                },
                "descripcion": "Consulta y actualización de la información empresarial de la organización.",
            }
        ],
    },
    "Evaluación": {
        "order": 3,
        "icon": "ClipboardDocumentListIcon",
        "opciones": [
            {
                "name": "Crear evaluación",
                "path": "/evaluations/new",
                "icon": "PlusCircleIcon",
                "order": 1,
                "permisos": {
                    "Decisor": ["add_evaluation"],
                },
                "descripcion": "Inicio de una nueva evaluación de software libre para adopción.",
            },
            {
                "name": "Historial",
                "path": "/evaluations/history",
                "icon": "ClockIcon",
                "order": 2,
                "permisos": {
                    "Decisor": ["view_evaluation"],
                },
                "descripcion": "Consulta del historial de evaluaciones realizadas.",
            },
        ],
    },
    "Usuario": {
        "order": 4,
        "icon": "UserCircleIcon",
        "opciones": [
            {
                "name": "Perfil",
                "path": "/profile",
                "icon": "UserCircleIcon",
                "order": 1,
                "permisos": {
                    "Decisor": ["view_user", "change_user"],
                    "Administrador": ["view_user", "change_user"],
                },
                "descripcion": "Administración de los datos del perfil del usuario.",
            }
        ],
    },

    # ── ADMINISTRADOR ────────────────────────────────────────────────────
    "Metodología": {
        "order": 5,
        "icon": "AdjustmentsHorizontalIcon",
        "opciones": [
            {
                "name": "Dimensiones",
                "path": "/methodology/dimensions",
                "icon": "RectangleGroupIcon",
                "order": 1,
                "permisos": {
                    "Administrador": [
                        "view_dimension",
                        "add_dimension",
                        "change_dimension",
                        "delete_dimension",
                        "view_factor",
                        "add_factor",
                        "change_factor",
                        "delete_factor",
                        "view_subfactor",
                        "add_subfactor",
                        "change_subfactor",
                        "delete_subfactor",
                    ],
                },
                "descripcion": "Gestión jerárquica de dimensiones, factores técnicos y subfactores de software libre.",
            },
            {
                "name": "Escala",
                "path": "/methodology/scales",
                "icon": "ChartBarIcon",
                "order": 2,
                "permisos": {
                    "Administrador": [
                        "view_scale",
                        "add_scale",
                        "change_scale",
                        "delete_scale",
                        "view_scalelevel",
                        "add_scalelevel",
                        "change_scalelevel",
                        "delete_scalelevel",
                    ],
                },
                "descripcion": "Gestión de escalas de medición y niveles de ponderación de calidad.",
            },
            {
                "name": "Alcance",
                "path": "/methodology/scopes",
                "icon": "GlobeAltIcon",
                "order": 3,
                "permisos": {
                    "Administrador": [
                        "view_scope",
                        "add_scope",
                        "change_scope",
                        "delete_scope",
                    ],
                },
                "descripcion": "Definición del alcance y aplicabilidad de los criterios de software.",
            },
            {
                "name": "Recomendaciones",
                "path": "/methodology/recommendations",
                "icon": "DocumentCheckIcon",
                "order": 4,
                "permisos": {
                    "Administrador": [
                        "view_recommendation",
                        "add_recommendation",
                        "change_recommendation",
                        "delete_recommendation",
                    ],
                },
                "descripcion": "Gestión de las recomendaciones oficiales de adopción de la metodología GUIOS.",
            },
            {
                "name": "Total de citas con IA",
                "path": "/methodology/ai-citations",
                "icon": "SparklesIcon",
                "order": 5,
                "permisos": {
                    "Administrador": [
                        "view_aicitationquery",
                        "add_aicitationquery",
                        "change_aicitationquery",
                        "delete_aicitationquery",
                        "view_scientificdatabase",
                    ],
                },
                "descripcion": "Gestión histórica y restauración de versiones de citas bibliográficas de factores con IA.",
            },
        ],
    },
    "Configuración": {
        "order": 6,
        "icon": "CogIcon",
        "opciones": [
            {
                "name": "Módulo",
                "path": "/config/modules",
                "icon": "Squares2X2Icon",
                "order": 1,
                "permisos": {
                    "Administrador": [
                        "view_module",
                        "add_module",
                        "change_module",
                        "delete_module",
                        "view_moduleoption",
                        "add_moduleoption",
                        "change_moduleoption",
                        "delete_moduleoption",
                    ],
                },
                "descripcion": "Gestión de las categorías de módulos y de sus opciones de navegación.",
            },
            {
                "name": "Grupo",
                "path": "/config/groups",
                "icon": "ShieldCheckIcon",
                "order": 2,
                "permisos": {
                    "Administrador": [
                        "view_group",
                        "add_group",
                        "change_group",
                        "delete_group",
                        "view_moduleoptionpermission",
                        "add_moduleoptionpermission",
                        "change_moduleoptionpermission",
                        "delete_moduleoptionpermission",
                    ],
                },
                "descripcion": "Control de roles y asociación granular de permisos a opciones de módulo (RBAC).",
            },
            {
                "name": "Usuarios",
                "path": "/config/users",
                "icon": "UsersIcon",
                "order": 3,
                "permisos": {
                    "Administrador": [
                        "view_user",
                        "add_user",
                        "change_user",
                        "delete_user",
                    ],
                },
                "descripcion": "Gestión y administración de cuentas de usuario.",
            },
        ],
    },
}


def _obtener_o_crear_permiso(codename: str, nombre_legible: str) -> Permission:
    """Busca un permiso por codename o lo crea en un ContentType genérico."""
    permiso = Permission.objects.filter(codename=codename).first()
    if not permiso:
        ct, _ = ContentType.objects.get_or_create(
            app_label="authentication", model="custom_permission"
        )
        permiso, _ = Permission.objects.get_or_create(
            codename=codename,
            content_type=ct,
            defaults={"name": nombre_legible},
        )
    return permiso


class Command(BaseCommand):
    help = (
        "Inicializa roles (Decisor, Administrador), módulos, opciones de navegación "
        "y permisos RBAC de GuiosPro."
    )

    def handle(self, *args, **options):
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write("   GUIOSPRO — INICIALIZACIÓN DE ROLES, MÓDULOS Y PERMISOS")
        self.stdout.write("=" * 80)

        # 0. Migraciones
        self.stdout.write(self.style.MIGRATE_HEADING("\n[0] Verificando migraciones..."))
        call_command("migrate", verbosity=0)
        self.stdout.write(self.style.SUCCESS("    ✔ Esquema de base de datos actualizado."))

        # 1. Grupos / Roles
        self.stdout.write(self.style.MIGRATE_HEADING("\n[1] Creando grupos de usuarios..."))
        rol_decisor, _ = Group.objects.get_or_create(name="Decisor")
        rol_admin, _ = Group.objects.get_or_create(name="Administrador")
        self.stdout.write(self.style.SUCCESS(f"    ✔ '{rol_decisor.name}'"))
        self.stdout.write(self.style.SUCCESS(f"    ✔ '{rol_admin.name}'"))

        grupos_map = {"Decisor": rol_decisor, "Administrador": rol_admin}

        # 1.5 Organización predeterminada (exclusiva para Decisores, un Administrador no tiene organización asociada)
        from apps.evaluation.models.organization import Organization
        from apps.auth.models.auth.user import User
        org, _ = Organization.objects.get_or_create(
            business_name="Comercial Andina Cía. Ltda.",
            defaults={
                "commercial_name": "TecnoEmpresa",
                "organization_type": "private",
                "sector": "Tecnología",
                "city": "Guayaquil",
                "country": "Ecuador",
                "address": "Av. 9 de Octubre",
            },
        )
        # Desvincular cualquier organización de cuentas administradoras
        admin_user_ids = rol_admin.user_set.values_list("id", flat=True)
        User.objects.filter(id__in=admin_user_ids).update(organization=None)
        User.objects.filter(is_superuser=True).update(organization=None)

        # Vincular organización a decisores sin organización
        User.objects.exclude(id__in=admin_user_ids).filter(is_superuser=False, organization__isnull=True).update(organization=org)
        self.stdout.write(self.style.SUCCESS(f"    ✔ Organización predeterminada vinculada a decisores: '{org.business_name}'"))

        # Eliminar permisos obsoletos del Administrador en Organización y Evaluación
        ModuleOptionPermission.objects.filter(
            group=rol_admin,
            module_option__module__name__in=["Organización", "Evaluación"]
        ).delete()

        # 2. Módulos, opciones y permisos
        self.stdout.write(self.style.MIGRATE_HEADING("\n[2] Sincronizando módulos y permisos..."))
        total_opciones = 0
        total_permisos = 0

        # Módulos válidos actuales para limpieza de antiguos si fuera necesario
        nombres_modulos_nuevos = list(ESTRUCTURA_MODULOS.keys())
        Module.objects.exclude(name__in=nombres_modulos_nuevos).delete()
        # Limpieza de rutas antiguas que contengan prefijo /dashboard/ (salvo /dashboard únicamente)
        ModuleOption.objects.filter(path__startswith="/dashboard/").delete()

        for nombre_mod, datos_mod in ESTRUCTURA_MODULOS.items():
            modulo, _ = Module.objects.update_or_create(
                name=nombre_mod,
                defaults={"order": datos_mod["order"], "icon": datos_mod["icon"]},
            )
            self.stdout.write(f"\n  [Módulo] {modulo.name}  (orden {modulo.order})")

            # Opciones válidas de este módulo
            nombres_opciones = [opt["name"] for opt in datos_mod["opciones"]]
            ModuleOption.objects.filter(module=modulo).exclude(name__in=nombres_opciones).delete()

            for opt in datos_mod["opciones"]:
                opcion, _ = ModuleOption.objects.update_or_create(
                    module=modulo,
                    name=opt["name"],
                    defaults={
                        "path": opt["path"],
                        "icon": opt["icon"],
                        "order": opt["order"],
                        "is_active": True,
                    },
                )
                total_opciones += 1
                self.stdout.write(f"    └── {opcion.name}  →  {opcion.path}")

                for nombre_rol, lista_codenames in opt["permisos"].items():
                    grupo_obj = grupos_map.get(nombre_rol)
                    if not grupo_obj:
                        continue
                    for codename in lista_codenames:
                        perm_obj = _obtener_o_crear_permiso(
                            codename=codename,
                            nombre_legible=f"Can {codename} on {opcion.name}",
                        )
                        ModuleOptionPermission.objects.update_or_create(
                            group=grupo_obj,
                            module_option=opcion,
                            permission=perm_obj,
                            defaults={
                                "order": opt["order"],
                                "description": opt.get(
                                    "descripcion",
                                    f"Permiso {codename} en {opcion.name}",
                                ),
                            },
                        )
                        total_permisos += 1

        # Resumen
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write(self.style.SUCCESS("   RESUMEN"))
        self.stdout.write("=" * 80)
        self.stdout.write(f"  Grupos/Roles   : 2 (Decisor, Administrador)")
        self.stdout.write(f"  Módulos        : {len(ESTRUCTURA_MODULOS)}")
        self.stdout.write(f"  Opciones       : {total_opciones}")
        self.stdout.write(f"  Permisos RBAC  : {total_permisos}")
        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("\n>>> Seeder ejecutado con éxito. <<<\n"))
