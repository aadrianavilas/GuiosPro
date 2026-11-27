"""
Constantes de permisos granulares RBAC para GuiosPro.
Estructura de clave en base de datos: 'Módulo.Opción.acción'
"""

PERMISSIONS = {
    # ── Módulo Dashboard ──
    "DASHBOARD_VIEW": "Dashboard.Panel principal.view_dashboard",

    # ── Módulo Organización ──
    "ORGANIZATION_VIEW": "Organización.Organización.view_organization",
    "ORGANIZATION_CHANGE": "Organización.Organización.change_organization",

    # ── Módulo Evaluación (Exclusivo Decisor) ──
    "EVALUATION_CREATE": "Evaluación.Crear evaluación.add_evaluation",
    "EVALUATION_VIEW": "Evaluación.Historial.view_evaluation",
    "EVALUATION_CHANGE": "Evaluación.Crear evaluación.add_evaluation",
    "EVALUATION_DELETE": "Evaluación.Historial.view_evaluation",

    # ── Módulo Usuario ──
    "USER_VIEW": "Usuario.Perfil.view_user",
    "USER_CHANGE": "Usuario.Perfil.change_user",

    # ── Módulo Metodología (Administrador) ──
    "DIMENSION_VIEW": "Metodología.Dimensiones.view_dimension",
    "DIMENSION_ADD": "Metodología.Dimensiones.add_dimension",
    "DIMENSION_CHANGE": "Metodología.Dimensiones.change_dimension",
    "DIMENSION_DELETE": "Metodología.Dimensiones.delete_dimension",

    "FACTOR_VIEW": "Metodología.Dimensiones.view_factor",
    "FACTOR_ADD": "Metodología.Dimensiones.add_factor",
    "FACTOR_CHANGE": "Metodología.Dimensiones.change_factor",
    "FACTOR_DELETE": "Metodología.Dimensiones.delete_factor",

    "SUBFACTOR_VIEW": "Metodología.Dimensiones.view_subfactor",
    "SUBFACTOR_ADD": "Metodología.Dimensiones.add_subfactor",
    "SUBFACTOR_CHANGE": "Metodología.Dimensiones.change_subfactor",
    "SUBFACTOR_DELETE": "Metodología.Dimensiones.delete_subfactor",

    "SCALE_VIEW": "Metodología.Escala.view_scale",
    "SCALE_ADD": "Metodología.Escala.add_scale",
    "SCALE_CHANGE": "Metodología.Escala.change_scale",
    "SCALE_DELETE": "Metodología.Escala.delete_scale",
    "SCALE_LEVEL_VIEW": "Metodología.Escala.view_scalelevel",
    "SCALE_LEVEL_ADD": "Metodología.Escala.add_scalelevel",
    "SCALE_LEVEL_CHANGE": "Metodología.Escala.change_scalelevel",
    "SCALE_LEVEL_DELETE": "Metodología.Escala.delete_scalelevel",

    "SCOPE_VIEW": "Metodología.Alcance.view_scope",
    "SCOPE_ADD": "Metodología.Alcance.add_scope",
    "SCOPE_CHANGE": "Metodología.Alcance.change_scope",
    "SCOPE_DELETE": "Metodología.Alcance.delete_scope",

    "RECOMMENDATION_VIEW": "Metodología.Recomendaciones.view_recommendation",
    "RECOMMENDATION_ADD": "Metodología.Recomendaciones.add_recommendation",
    "RECOMMENDATION_CHANGE": "Metodología.Recomendaciones.change_recommendation",
    "RECOMMENDATION_DELETE": "Metodología.Recomendaciones.delete_recommendation",

    # ── Módulo Configuración (Administrador) ──
    "MODULE_VIEW": "Configuración.Módulo.view_module",
    "MODULE_ADD": "Configuración.Módulo.add_module",
    "MODULE_CHANGE": "Configuración.Módulo.change_module",
    "MODULE_DELETE": "Configuración.Módulo.delete_module",

    "MODULE_OPTION_VIEW": "Configuración.Módulo.view_moduleoption",
    "MODULE_OPTION_ADD": "Configuración.Módulo.add_moduleoption",
    "MODULE_OPTION_CHANGE": "Configuración.Módulo.change_moduleoption",
    "MODULE_OPTION_DELETE": "Configuración.Módulo.delete_moduleoption",

    "GROUP_VIEW": "Configuración.Grupo.view_group",
    "GROUP_ADD": "Configuración.Grupo.add_group",
    "GROUP_CHANGE": "Configuración.Grupo.change_group",
    "GROUP_DELETE": "Configuración.Grupo.delete_group",

    "PERMISSION_VIEW": "Configuración.Grupo.view_moduleoptionpermission",
    "PERMISSION_ADD": "Configuración.Grupo.add_moduleoptionpermission",
    "PERMISSION_CHANGE": "Configuración.Grupo.change_moduleoptionpermission",
    "PERMISSION_DELETE": "Configuración.Grupo.delete_moduleoptionpermission",

    "CONFIG_USER_VIEW": "Configuración.Usuarios.view_user",
    "CONFIG_USER_ADD": "Configuración.Usuarios.add_user",
    "CONFIG_USER_CHANGE": "Configuración.Usuarios.change_user",
    "CONFIG_USER_DELETE": "Configuración.Usuarios.delete_user",
}
