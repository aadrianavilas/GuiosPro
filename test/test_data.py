"""
========================================================================================
GUIOSPRO - BANCO DE DATOS MAESTRO PARA PRUEBAS DE CALIDAD DE SOFTWARE
========================================================================================
Módulo: test_data.py
Propósito:
    Contiene los conjuntos de datos maestros a nivel empresarial para ejecutar
    los Casos de Prueba (CP-01 al CP-09) descritos en la matriz de calidad.
    
    Todos los datos reflejan información fidedigna de negocio (nombres corporativos,
    cuentas de correo institucionales, configuraciones de seguridad, taxonomía de módulos
    y esquemas de permisos) correspondientes al entorno operativo de GuiosPro.
========================================================================================
"""

from datetime import datetime, timedelta

# ======================================================================================
# CP-01 / HU-01: REGISTRO DE USUARIO
# ======================================================================================
DATA_CP01_REGISTRO = {
    "usuario_valido": {
        "first_name": "Santiago Alejandro",
        "last_name": "Morales Cárdenas",
        "email": "santiago.morales@novatech-solutions.ec",
        "password": "Password#2026.Secure",
        "job_title": "Director de Calidad y Procesos",
        "phone": "+593998741258",
    },
    "usuario_duplicado": {
        "first_name": "Santiago Alejandro",
        "last_name": "Morales Cárdenas",
        "email": "santiago.morales@novatech-solutions.ec",
        "password": "Password#2026.Secure",
        "job_title": "Director de Calidad",
        "phone": "+593998741258",
    },
    "casos_invalidos": [
        {
            "descripcion": "Nombre y apellido faltantes",
            "payload": {
                "first_name": "",
                "last_name": "",
                "email": "contacto.empresa@novatech-solutions.ec",
                "password": "Password#2026.Secure",
            },
            "campo_afectado": "first_name / last_name",
            "mensaje_esperado": "Los nombres y apellidos son campos obligatorios.",
        },
        {
            "descripcion": "Formato de correo electrónico no válido",
            "payload": {
                "first_name": "Carlos",
                "last_name": "Villacís",
                "email": "carlos.villacis.novatech-solutions.ec",
                "password": "Password#2026.Secure",
            },
            "campo_afectado": "email",
            "mensaje_esperado": "El correo electrónico no cuenta con un formato válido.",
        },
        {
            "descripcion": "Contraseña inferior a 8 caracteres",
            "payload": {
                "first_name": "Carla",
                "last_name": "Gómez",
                "email": "carla.gomez@novatech-solutions.ec",
                "password": "Pass1#",
            },
            "campo_afectado": "password",
            "mensaje_esperado": "La contraseña debe tener al menos 8 caracteres.",
        },
    ],
}

# ======================================================================================
# CP-02 / HU-02: VERIFICACIÓN DEL CORREO MEDIANTE CÓDIGO TEMPORAL (MFA EMAIL)
# ======================================================================================
DATA_CP02_VERIFICACION = {
    "usuario": {
        "email": "valeria.rios@andesinnovacion.com",
        "full_name": "Valeria Cristina Ríos Andrade",
        "cuenta_activa_inicial": False,
    },
    "sesion_codigo": {
        "codigo_secreto": "582914",
        "tiempo_vigencia_minutos": 5,
        "limite_intentos": 3,
        "fecha_generacion": datetime.now(),
        "fecha_expiracion": datetime.now() + timedelta(minutes=5),
    },
    "intentos_incorrectos": ["184920", "930214", "472851"],
    "codigo_expirado": {
        "codigo_secreto": "391740",
        "fecha_generacion": datetime.now() - timedelta(minutes=12),
        "fecha_expiracion": datetime.now() - timedelta(minutes=7),
    },
    "nuevo_codigo_solicitado": {
        "codigo_secreto": "839201",
        "fecha_generacion": datetime.now(),
        "fecha_expiracion": datetime.now() + timedelta(minutes=5),
    },
}

# ======================================================================================
# CP-03 / HU-03: INICIO DE SESIÓN Y GOBERNANZA DE ESTADOS DE CUENTA
# ======================================================================================
DATA_CP03_LOGIN = {
    "credenciales_validas": {
        "email": "gabriela.salazar@cloudlatam.com",
        "password": "Cl@udLatam#2026Secure!",
        "is_active": True,
        "is_email_verified": True,
        "rol_principal": "Decisor",
    },
    "cuenta_no_verificada": {
        "email": "rodrigo.alvarez@cloudlatam.com",
        "password": "Rodrigo#2026Secure!",
        "is_active": False,
        "is_email_verified": False,
        "mensaje_esperado": "Debe verificar su correo institucional antes de iniciar sesión.",
    },
    "credenciales_incorrectas": {
        "email": "gabriela.salazar@cloudlatam.com",
        "password": "Cl@udPasswordInvalida2026",
        "mensaje_esperado": "Credenciales incorrectas. Verifique su correo o contraseña.",
    },
    "usuario_inexistente": {
        "email": "director.seguridad@empresainexistente.org",
        "password": "CredencialInvalida#2026",
        "mensaje_esperado": "Credenciales incorrectas. Verifique su correo o contraseña.",
    },
    "campos_incompletos": [
        {"email": "", "password": "Password#2026.Secure", "campo_vacio": "email"},
        {"email": "gabriela.salazar@cloudlatam.com", "password": "", "campo_vacio": "password"},
    ],
}

# ======================================================================================
# CP-04 / HU-26: GESTIÓN DE INFORMACIÓN DE ORGANIZACIÓN Y AISLAMIENTO MULTI-TENANT
# ======================================================================================
DATA_CP04_ORGANIZACION = {
    "decisor_titular": {
        "id": 101,
        "full_name": "Marcelo Fernando Viteri Salazar",
        "email": "marcelo.viteri@ecuatech-corp.com",
        "role": "Decisor",
    },
    "organizacion_titular": {
        "id": 1,
        "business_name": "Corporación Tecnológica EcuaTech S.A.",
        "email": "contacto@ecuatech-corp.com",
        "address": "Av. Rodrigo Pachano y Miraflores, Ambato, Tungurahua",
        "description": "Consultora de software y modernización de arquitecturas empresariales",
        "sector": "Tecnología de la Información y Telecomunicaciones",
        "company_size": "Mediana Empresa (50 a 199 colaboradores)",
        "tax_identifier": "1890145892001",
    },
    "organizacion_actualizada": {
        "address": "Av. Rodrigo Pachano 14-25 y Guaytambos, Edificio Miraflores Piso 4, Ambato",
        "email": "gerencia.operaciones@ecuatech-corp.com",
        "description": "Consultora de software, modernización de arquitecturas y auditoría ISO/IEC",
    },
    "decisor_externo": {
        "id": 102,
        "full_name": "Lorena Elizabeth Duque Morales",
        "email": "lorena.duque@agrovalle-export.com",
        "role": "Decisor",
    },
    "organizacion_externa": {
        "id": 2,
        "business_name": "AgroValle Exportadora & Logística Cía. Ltda.",
        "email": "info@agrovalle-export.com",
        "address": "Km 12.5 Vía a Daule, Parque Industrial Las Iguanas, Guayaquil",
        "description": "Cadena de suministro y comercialización internacional de productos agrícolas",
        "sector": "Agroindustria y Exportación",
        "company_size": "Gran Empresa (200+ colaboradores)",
        "tax_identifier": "0992384751001",
    },
}

# ======================================================================================
# CP-05 / HU-04: CIERRE DE SESIÓN E INTENTO DE REINGRESO A PANTALLAS PROTEGIDAS
# ======================================================================================
DATA_CP05_SESION = {
    "usuario": {
        "full_name": "Esteban Gabriel Paredes Núñez",
        "email": "esteban.paredes@finanzascorp.com.ec",
        "role": "Auditor Financiero",
    },
    "token_sesion": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMDkyMyIsIm5hbWUiOiJFc3RlYmFuIFBhcmVkZXMiLCJpYXQiOjE3MzE3NDQwMDB9.d7c1a82f...",
    "rutas_privadas": [
        "/api/v1/evaluation/projects/",
        "/api/v1/auth/users/me/",
        "/api/v1/methodology/factors/",
    ],
    "observacion_no_aprobado": (
        "El backend mantiene el token JWT válido en cliente durante su tiempo nominal de vida (TTL) "
        "sin incorporar una lista de revocación (Blacklist en Redis/BD); al invocar logout y reintentar "
        "con el token previo, la API no retorna 401 Unauthorized inmediatamente en todos los micro-servicios."
    ),
}

# ======================================================================================
# CP-06 / HU-08: GESTIÓN DE GRUPOS Y PROTECCIÓN DEL GRUPO SISTEMA 'DECISOR'
# ======================================================================================
DATA_CP06_GRUPOS = {
    "grupos_existentes": [
        {
            "id": 1,
            "name": "Decisor",
            "description": "Grupo base de gobernanza y toma de decisión de adopción de software",
            "is_protected": True,
        },
        {
            "id": 2,
            "name": "Auditor de Calidad",
            "description": "Responsable de evaluar los criterios y factores metodológicos",
            "is_protected": False,
        },
        {
            "id": 3,
            "name": "Consultor de Arquitectura",
            "description": "Evaluador técnico externo para diagnóstico de infraestructura",
            "is_protected": False,
        },
    ],
    "nuevo_grupo": {
        "name": "Comité de Aseguramiento de Software",
        "description": "Cuerpo colegiado encargado de certificar los entregables del ciclo de vida",
    },
    "grupo_edicion": {
        "id": 2,
        "name": "Auditor Líder de Aseguramiento",
        "description": "Líder principal de auditoría de procesos de software y estándares ISO/IEC",
    },
    "casos_invalidos": [
        {"name": "", "description": "Nombre en blanco", "error_esperado": "El nombre no puede estar vacío."},
        {"name": "Decisor", "description": "Nombre existente", "error_esperado": "Ya existe un grupo con ese nombre."},
    ],
    "observacion_no_aprobado": (
        "Al enviar solicitud de eliminación sobre el grupo predeterminado 'Decisor', el backend no bloqueó la acción "
        "con regla de negocio (HTTP 400 Bad Request / 403 Forbidden), sino que intentó ejecutar la instrucción contra la base "
        "de datos arrojando un error interno de restricción de clave foránea no manejado adecuadamente."
    ),
}

# ======================================================================================
# CP-07 / HU-09: CREACIÓN DE MÓDULOS Y OPCIONES DE NAVEGACIÓN
# ======================================================================================
DATA_CP07_MODULOS = {
    "modulo_principal": {
        "id": 10,
        "name": "Evaluación Metodológica",
        "order": 1,
        "icon": "LayersIcon",
    },
    "opciones_asociadas": [
        {
            "id": 101,
            "module_id": 10,
            "name": "Diagnóstico de Madurez",
            "icon": "ClipboardCheckIcon",
            "path": "/evaluations/diagnostic",
            "order": 1,
            "is_active": True,
        },
        {
            "id": 102,
            "module_id": 10,
            "name": "Matriz de Factores y Subfactores",
            "icon": "TableCellsIcon",
            "path": "/evaluations/matrix",
            "order": 2,
            "is_active": True,
        },
        {
            "id": 103,
            "module_id": 10,
            "name": "Informe Ejecutivo y Recomendación IA",
            "icon": "SparklesIcon",
            "path": "/evaluations/ai-report",
            "order": 3,
            "is_active": True,
        },
    ],
    "modulo_invalido": {
        "name": "",
        "order": 0,
        "icon": "",
        "error_esperado": "El nombre del módulo es obligatorio.",
    },
    "opcion_invalida": {
        "name": "Opción sin Destino",
        "path": "",
        "icon": "",
        "error_esperado": "La ruta de navegación relativa es obligatoria.",
    },
}

# ======================================================================================
# CP-08 / HU-10: CONFIGURACIÓN Y ASIGNACIÓN DE MÓDULOS Y OPCIONES POR GRUPO
# ======================================================================================
DATA_CP08_ASIGNACION = {
    "grupo_evaluado": {
        "id": 2,
        "name": "Auditor de Calidad",
    },
    "catalogo_modulos": [
        {
            "id": 10,
            "name": "Evaluación Metodológica",
            "opciones": ["Diagnóstico de Madurez", "Matriz de Factores", "Informe Ejecutivo"],
        },
        {
            "id": 20,
            "name": "Administración de Seguridad",
            "opciones": ["Gestión de Usuarios", "Políticas MFA", "Registro de Auditoría"],
        },
        {
            "id": 30,
            "name": "Métricas y Gobernanza",
            "opciones": ["Indicadores de Cobertura", "Trazabilidad de Requisitos"],
        },
    ],
    "modulos_habilitados_grupo": ["Evaluación Metodológica", "Métricas y Gobernanza"],
    "modulos_restringidos_grupo": ["Administración de Seguridad"],
}

# ======================================================================================
# CP-09 / HU-11: GESTIÓN DE PERMISOS POR ACCIÓN Y CONTROL DE ACCESO
# ======================================================================================
DATA_CP09_PERMISOS = {
    "grupo": "Auditor de Calidad",
    "modulo": "Evaluación Metodológica",
    "matriz_permisos_asignados": {
        "view": True,
        "add": True,
        "change": True,
        "delete": False,  # Restricción deliberada: el auditor no debe borrar proyectos
    },
    "operacion_permitida": {
        "action": "view",
        "description": "Consultar detalles de la evaluación técnica de software",
        "codigo_esperado": 200,
    },
    "operacion_no_autorizada": {
        "action": "delete",
        "description": "Eliminar registro definitivo de evaluación de software",
        "codigo_esperado": 403,
    },
    "observacion_no_aprobado": (
        "El controlador API para la acción 'destroy' en la vista de evaluaciones no verificó "
        "la bandera 'delete' de la entidad ModuleOptionPermission; la solicitud retornó 204 No Content "
        "en lugar de bloquearse con 403 Forbidden."
    ),
}
