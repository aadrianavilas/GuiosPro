import os
import csv
import math
from typing import Dict, List, Tuple
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import transaction
from django.conf import settings

from apps.methodology.models.dimension import Dimension
from apps.methodology.models.factor import Factor
from apps.methodology.models.subfactor import Subfactor
from apps.methodology.models.scale import Scale, ScaleLevel
from apps.methodology.models.scope import Scope


# Citas históricas y de literatura científica por factor (según tesis GuiosPro 2020-2025)
HISTORICAL_FACTOR_CITATIONS: Dict[str, int] = {
    "Compatibilidad": 10,
    "Personalización": 9,
    "Prueba": 7,
    "Fiabilidad": 9,
    "Reusabilidad": 2,
    "Reutilización": 2,
    "Usabilidad": 9,
    "Mantenibilidad": 15,
    "Portabilidad": 3,
    "Documentación": 6,
    "Formación": 8,
    "Tiempo de adopción": 7,
    "Casos de estudio de adopción FLOSS": 6,
    "Centralidad de la tecnología de la información": 3,
    "Centralidad de la TI": 3,
    "Apoyo de la alta dirección": 7,
    "Bloqueo de proveedores": 7,
    "Soporte": 14,
    "Actitud hacia el cambio": 7,
    "Coste total de propiedad": 11,
    "TCO": 11,
}

DIMENSION_ORDER: Dict[str, int] = {
    "Tecnológica": 1,
    "Organizacional": 2,
    "Económica": 3,
}


def calculate_quartiles(r_values: List[float]) -> Tuple[float, float, float, float]:
    """
    Método de 'mediana de mitades' exigido por la metodología GuiosPro:
    1. Ordenar r_i (n valores).
    2. rq2 = mediana del conjunto completo.
    3. Mitad inferior = primeros floor(n/2) valores. Mitad superior = últimos floor(n/2) valores.
    4. rq1 = mediana de mitad inferior; rq3 = mediana de mitad superior.
    5. rq4 = valor máximo.
    """
    sorted_r = sorted(r_values)
    n = len(sorted_r)

    def median(lst: List[float]) -> float:
        m = len(lst)
        if m % 2 == 1:
            return lst[m // 2]
        return (lst[m // 2 - 1] + lst[m // 2]) / 2.0

    rq2 = median(sorted_r)
    half = n // 2
    lower_half = sorted_r[:half]
    upper_half = sorted_r[-half:]
    rq1 = median(lower_half)
    rq3 = median(upper_half)
    rq4 = sorted_r[-1]
    return rq1, rq2, rq3, rq4


def get_il(r: float, rq1: float, rq2: float, rq3: float) -> int:
    """Calcula el Índice de Literatura (IL) 1 a 4 según cuartiles."""
    if r <= rq1:
        return 1
    elif r <= rq2:
        return 2
    elif r <= rq3:
        return 3
    else:
        return 4


def get_is(ie: int, il: int) -> int:
    """Matriz de combinación GuiosPro: floor((IE + IL) / 2)."""
    return math.floor((ie + il) / 2)


EMBEDDED_METHODOLOGY_DATA: List[Tuple[str, str, str]] = [
    # Tecnológica (9 factores, 40 subfactores)
    ("Tecnológica", "Compatibilidad", "Una empresa proporciona una infraestructura de nube lista para usar para este software"),
    ("Tecnológica", "Compatibilidad", "Los programas informáticos pueden exportar formatos propietarios"),
    ("Tecnológica", "Compatibilidad", "El software interactúa y se integra con el software propietario existente"),
    ("Tecnológica", "Compatibilidad", "El software está certificado para operar en su nicho de mercado"),
    ("Tecnológica", "Compatibilidad", "El software es compatible con los casos de uso y las funcionalidades más comunes"),
    ("Tecnológica", "Compatibilidad", "El software es compatible con múltiples componentes de hardware"),
    ("Tecnológica", "Compatibilidad", "El software utiliza formatos estándar"),
    ("Tecnológica", "Compatibilidad", "El software es compatible con varios sistemas operativos diferentes (el software es multiplataforma)"),
    ("Tecnológica", "Personalización", "El acceso al código fuente es un incentivo para la organización"),
    ("Tecnológica", "Personalización", "El software se puede ampliar fácilmente para satisfacer las necesidades de la organización modificando el código fuente"),
    ("Tecnológica", "Personalización", "Las innovaciones se introducen en el software a un ritmo rápido"),
    ("Tecnológica", "Personalización", "El software es fácil de personalizar sin necesidad de modificar el códigofuente"),
    ("Tecnológica", "Personalización", "El software soporta nuevas funciones a través de módulos (el software es modular)"),
    ("Tecnológica", "Personalización", "Hay un repositorio público de extensiones para este software"),
    ("Tecnológica", "Prueba", "El software es fácil de desplegar y de probar"),
    ("Tecnológica", "Fiabilidad", "El software es fiable y estable"),
    ("Tecnológica", "Fiabilidad", "El software tiene un buen historial en cuanto a errores de seguridad (el software es seguro)"),
    ("Tecnológica", "Fiabilidad", "El software es más flexible que la solución propietaria"),
    ("Tecnológica", "Fiabilidad", "El software es más confiable que la solución propietaria"),
    ("Tecnológica", "Fiabilidad", "El programa proporciona una amplia variedad de funciones de control de acceso"),
    ("Tecnológica", "Reusabilidad", "La licencia permite extensiones propietarias"),
    ("Tecnológica", "Reusabilidad", "El software se ofrece como una biblioteca / marco de trabajo"),
    ("Tecnológica", "Usabilidad", "El software proporciona una interfaz gráfica de usuario (GUI)"),
    ("Tecnológica", "Usabilidad", "El software es más fácil de usar que la alternativa propietaria"),
    ("Tecnológica", "Usabilidad", "El software es fácil de aprender"),
    ("Tecnológica", "Usabilidad", "El usuario está descontento con el software propietario"),
    ("Tecnológica", "Mantenibilidad", "El software es mantenido activamente por los desarrolladores"),
    ("Tecnológica", "Portabilidad", "Una versión de aplicación móvil de este software está disponible"),
    ("Tecnológica", "Portabilidad", "El software es una sistemas de administración de base de datos independiente"),
    ("Tecnológica", "Documentación", "El software está bien documentado"),
    ("Tecnológica", "Documentación", "La documentación de desarrollo cubre todas las características"),
    ("Tecnológica", "Documentación", "La documentación está disponible en múltiples formatos"),
    ("Tecnológica", "Documentación", "La documentación es fácil de entender"),
    ("Tecnológica", "Documentación", "La documentación está actualizada"),
    ("Tecnológica", "Documentación", "La documentación está escrita por escritores especializados (no desarrolladores)"),
    ("Tecnológica", "Documentación", "La documentación del software es de alta calidad"),
    ("Tecnológica", "Documentación", "El software viene con documentación de desarrollo"),
    ("Tecnológica", "Documentación", "El software viene con documentación de usuario"),
    ("Tecnológica", "Documentación", "La documentación del usuario cubre todas las características"),
    ("Tecnológica", "Documentación", "Los formatos de datos están bien documentados"),
    # Organizacional (8 factores, 19 subfactores)
    ("Organizacional", "Formación", "La adopción de este software permite a los usuarios mejorar las habilidades técnicas de TI"),
    ("Organizacional", "Formación", "El personal de la organización puede aprender fácilmente por sí mismo a utilizar este software"),
    ("Organizacional", "Formación", "El personal de la organización está capacitado para resolver problemas tecnológicos"),
    ("Organizacional", "Formación", "Los planes de entrenamiento de este software están disponibles"),
    ("Organizacional", "Tiempo de adopción", "Los requisitos de instalación y despliegue del software son fáciles de cumplir"),
    ("Organizacional", "Tiempo de adopción", "El tiempo requerido para adoptar este software es bajo"),
    ("Organizacional", "Casos de estudio de adopción FLOSS", "Hay informes públicos disponibles en Internet que describen el éxito de la adopción de este software"),
    ("Organizacional", "Centralidad de la tecnología de la información", "La adopción de este software mejora el entorno de trabajo de los usuarios"),
    ("Organizacional", "Centralidad de la tecnología de la información", "Centralizar la infraestructura de TI ayuda a acelerar la adopción de este software"),
    ("Organizacional", "Apoyo de la alta dirección", "La alta dirección apoya la adopción exitosa de este software"),
    ("Organizacional", "Bloqueo de proveedores", "El software reduce las dependencias de los proveedores en su entorno"),
    ("Organizacional", "Soporte", "El soporte de la comunidad para este software está disponible"),
    ("Organizacional", "Soporte", "Soporte de expertos y consultores externos para consultas específicas está disponible"),
    ("Organizacional", "Soporte", "El soporte comercial de este software está disponible 24/7/365"),
    ("Organizacional", "Soporte", "Hay desarrolladores en su organización que saben cómo desarrollar este software"),
    ("Organizacional", "Soporte", "Soporte comercial para la personalización de software está disponible"),
    ("Organizacional", "Soporte", "Es fácil contratar personal informático en la comunidad que conozca este software"),
    ("Organizacional", "Actitud hacia el cambio", "El personal de la organización muestra poca resistencia al cambio tecnológico"),
    ("Organizacional", "Actitud hacia el cambio", "El personal técnico encargado del despliegue y soporte en la organización respalda la adopción de este software"),
    # Económica (1 factor, 2 subfactores)
    ("Económica", "Coste total de propiedad", "Es poco probable que haya costos ocultos al adoptar este software"),
    ("Económica", "Coste total de propiedad", "La adopción de este software es menos costosa que la alternativa patentada"),
]


class Command(BaseCommand):
    help = "Carga automáticamente las Dimensiones, Factores y Subfactores desde un archivo Excel (.xlsx) o CSV"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            help="Ruta al archivo Excel (.xlsx, .xls) o CSV con columnas Dimensión, Factor, Subfactor",
        )
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Elimina las dimensiones, factores y subfactores existentes antes de importar",
        )

    def handle(self, *args, **options):
        specified_file = options.get("file")
        clean = options.get("clean", False)
        file_path = None

        # Si se especificó una ruta con --file, probar todas las combinaciones relativas
        if specified_file:
            candidates_specified = [
                specified_file,
                os.path.abspath(specified_file),
                os.path.join(os.getcwd(), specified_file),
                os.path.join(str(settings.BASE_DIR), specified_file),
                os.path.join(str(settings.BASE_DIR), "..", specified_file),
            ]
            for cand in candidates_specified:
                if os.path.exists(cand):
                    file_path = os.path.abspath(cand)
                    break

        # Si no se especificó o no se encontró, buscar automáticamente en ubicaciones estándar
        if not file_path:
            candidates = [
                os.path.join(str(settings.BASE_DIR), "guiosad_data.csv"),
                os.path.join(str(settings.BASE_DIR), "..", "guiosad_data.csv"),
                os.path.join(os.getcwd(), "guiosad_data.csv"),
                os.path.join(os.getcwd(), "backend", "guiosad_data.csv"),
                os.path.join(str(settings.BASE_DIR), "Dimensiones_Factores_Subfactores.xlsx"),
                os.path.join(str(settings.BASE_DIR), "..", "Dimensiones_Factores_Subfactores.xlsx"),
                os.path.join(os.getcwd(), "Dimensiones_Factores_Subfactores.xlsx"),
            ]
            for cand in candidates:
                cand_abs = os.path.abspath(cand)
                if os.path.exists(cand_abs):
                    file_path = cand_abs
                    break

        # 1. Leer registros del archivo o usar datos integrados por defecto
        records: List[Tuple[str, str, str]] = []
        if file_path and os.path.exists(file_path):
            self.stdout.write(self.style.MIGRATE_HEADING(f"==> Iniciando carga desde archivo: {file_path}"))
            try:
                records = self._read_file(file_path)
            except Exception as e:
                self.stderr.write(self.style.WARNING(f"Aviso al leer archivo ({e}). Se usarán los datos metodológicos estándar."))
                records = []

        if not records:
            self.stdout.write(
                self.style.NOTICE("==> Usando catálogo metodológico estándar integrado de GuiosPro (3 dimensiones, 18 factores, 61 subfactores)...")
            )
            records = list(EMBEDDED_METHODOLOGY_DATA)

        self.stdout.write(f"Se procesarán {len(records)} registros metodológicos.")

        with transaction.atomic():
            if clean:
                self.stdout.write(self.style.WARNING("Limpiando datos metodológicos previos..."))
                Subfactor.objects.all().delete()
                Factor.objects.all().delete()
                Dimension.objects.all().delete()

            # 2. Asegurar escalas metodológicas
            scale_levels_imp = self._seed_scales()

            # 3. Estructurar datos: Dimension -> Factor -> [Subfactores]
            hierarchy: Dict[str, Dict[str, List[str]]] = {}
            for dim_name, factor_name, subfactor_name in records:
                dim_name = dim_name.strip()
                factor_name = factor_name.strip()
                subfactor_name = subfactor_name.strip()

                if not dim_name or not factor_name or not subfactor_name:
                    continue

                if dim_name not in hierarchy:
                    hierarchy[dim_name] = {}
                if factor_name not in hierarchy[dim_name]:
                    hierarchy[dim_name][factor_name] = []
                if subfactor_name not in hierarchy[dim_name][factor_name]:
                    hierarchy[dim_name][factor_name].append(subfactor_name)

            # 4. Crear o actualizar Dimensiones
            dimensions_created = 0
            dim_map: Dict[str, Dimension] = {}
            for dim_idx, dim_name in enumerate(hierarchy.keys(), start=1):
                order = DIMENSION_ORDER.get(dim_name, dim_idx)
                dim_obj, created = Dimension.objects.update_or_create(
                    name=dim_name,
                    defaults={
                        "order": order,
                        "description": f"Dimensión {dim_name} del modelo de adopción FLOSS",
                        "is_active": True,
                    },
                )
                dim_map[dim_name] = dim_obj
                if created:
                    dimensions_created += 1

            # 5. Pre-calcular citas y r_i para todos los factores
            factor_ns_map: Dict[str, int] = {}
            factor_tc_map: Dict[str, int] = {}
            factor_r_map: Dict[str, float] = {}

            for dim_name, factors in hierarchy.items():
                for factor_name, sublist in factors.items():
                    ns = len(sublist)
                    tc = HISTORICAL_FACTOR_CITATIONS.get(factor_name, max(ns, 5))
                    factor_ns_map[factor_name] = ns
                    factor_tc_map[factor_name] = tc
                    factor_r_map[factor_name] = tc / ns if ns > 0 else 1.0

            # 6. Calcular cuartiles metodológicos
            r_all = list(factor_r_map.values())
            rq1, rq2, rq3, rq4 = calculate_quartiles(r_all)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Cuartiles calculados: rq1={rq1:.3f}, rq2={rq2:.3f}, rq3={rq3:.3f}, rq4={rq4:.3f}"
                )
            )

            # 7. Crear Factores y Subfactores
            factors_count = 0
            subfactors_count = 0
            global_factor_order = 1

            for dim_name, factors in hierarchy.items():
                dim_obj = dim_map[dim_name]
                for factor_name, sublist in factors.items():
                    tc = factor_tc_map[factor_name]
                    ie = 3  # Importancia del experto estándar en GuiosPro (3 = Importante)
                    r_val = factor_r_map[factor_name]
                    il_val = get_il(r_val, rq1, rq2, rq3)
                    is_val = get_is(ie, il_val)

                    factor_obj, created = Factor.objects.update_or_create(
                        name=factor_name,
                        defaults={
                            "dimension": dim_obj,
                            "order": global_factor_order,
                            "total_citations": tc,
                            "expert_importance": ie,
                            "literature_importance": scale_levels_imp.get(il_val),
                            "suggested_importance": scale_levels_imp.get(is_val),
                            "description": f"Factor {factor_name} de la dimensión {dim_name}",
                            "is_active": True,
                        },
                    )
                    global_factor_order += 1
                    factors_count += 1

                    # Subfactores
                    for sub_idx, sub_name in enumerate(sublist, start=1):
                        Subfactor.objects.update_or_create(
                            name=sub_name,
                            defaults={
                                "factor": factor_obj,
                                "order": sub_idx,
                                "description": sub_name,
                                "is_active": True,
                            },
                        )
                        subfactors_count += 1

            # 8. Cargar recomendaciones
            call_command("seed_recommendations")

        self.stdout.write(self.style.SUCCESS("\n" + "=" * 65))
        self.stdout.write(self.style.SUCCESS("  CARGA METODOLÓGICA COMPLETADA CON ÉXITO"))
        self.stdout.write(self.style.SUCCESS("=" * 65))
        self.stdout.write(f"  • Dimensiones:  {len(dim_map)}")
        self.stdout.write(f"  • Factores:     {factors_count}")
        self.stdout.write(f"  • Subfactores:  {subfactors_count}")
        self.stdout.write(self.style.SUCCESS("=" * 65 + "\n"))

    def _seed_scales(self) -> Dict[int, ScaleLevel]:
        """Crea las escalas metodológicas 'Factor' y 'Subfactor', y los alcances 'Scope' (Interno y Externo)."""
        # 1. Escala de Factor
        scale_imp, _ = Scale.objects.update_or_create(
            name="Factor",
            defaults={
                "description": "Escala de importancia para el Factor (1: Irrelevante, 2: Opcional, 3: Importante, 4: Fundamental)",
                "is_active": True,
            },
        )

        imp_levels_def = [
            (1, "Irrelevante", 1),
            (2, "Opcional", 2),
            (3, "Importante", 3),
            (4, "Fundamental", 4),
        ]
        levels_map: Dict[int, ScaleLevel] = {}
        for val, label, order in imp_levels_def:
            lvl_obj, _ = ScaleLevel.objects.update_or_create(
                scale=scale_imp,
                label=label,
                defaults={"value": val, "order": order, "is_active": True},
            )
            levels_map[val] = lvl_obj

        # 2. Escala de Subfactor
        scale_val, _ = Scale.objects.update_or_create(
            name="Subfactor",
            defaults={
                "description": "Valoración de subfactor elegida por el decisor (1: No cumple, 2: Desconozco, 3: Cumple parcialmente, 4: Cumple)",
                "is_active": True,
            },
        )
        val_levels_def = [
            (1, "No cumple el requisito", 1),
            (2, "Desconozco si cumple el requisito", 2),
            (3, "Cumple parcialmente el requisito", 3),
            (4, "Cumple el requisito", 4),
        ]
        for val, label, order in val_levels_def:
            ScaleLevel.objects.update_or_create(
                scale=scale_val,
                label=label,
                defaults={"value": val, "order": order, "is_active": True},
            )

        # 3. Alcances de Factor en tabla Scope
        Scope.objects.update_or_create(
            name="Interno",
            defaults={"description": "Alcance interno del factor en la organización", "is_active": True},
        )
        Scope.objects.update_or_create(
            name="Externo",
            defaults={"description": "Alcance externo del factor en el entorno / mercado", "is_active": True},
        )

        return levels_map

        return levels_map

    def _read_file(self, file_path: str) -> List[Tuple[str, str, str]]:
        """Lee un archivo Excel (.xlsx, .xls) o CSV (.csv) y retorna tuplas (Dimensión, Factor, Subfactor)."""
        ext = os.path.splitext(file_path)[1].lower()

        if ext in [".xlsx", ".xls"]:
            return self._read_excel(file_path)
        else:
            return self._read_csv(file_path)

    def _read_excel(self, file_path: str) -> List[Tuple[str, str, str]]:
        import openpyxl

        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheet = wb.active
        records: List[Tuple[str, str, str]] = []

        headers = [str(cell.value).strip().lower() if cell.value else "" for cell in sheet[1]]
        dim_col, factor_col, sub_col = -1, -1, -1

        for idx, h in enumerate(headers):
            if "dimen" in h:
                dim_col = idx
            elif "factor" in h and "sub" not in h:
                factor_col = idx
            elif "subfactor" in h or "criterio" in h or "item" in h:
                sub_col = idx

        if dim_col == -1: dim_col = 0
        if factor_col == -1: factor_col = 1
        if sub_col == -1: sub_col = 2

        for row in sheet.iter_rows(min_row=2, values_only=True):
            if not row or len(row) <= max(dim_col, factor_col, sub_col):
                continue
            dim = str(row[dim_col]).strip() if row[dim_col] else ""
            fac = str(row[factor_col]).strip() if row[factor_col] else ""
            sub = str(row[sub_col]).strip() if row[sub_col] else ""

            if dim and fac and sub:
                records.append((dim, fac, sub))

        return records

    def _read_csv(self, file_path: str) -> List[Tuple[str, str, str]]:
        records: List[Tuple[str, str, str]] = []
        with open(file_path, mode="r", encoding="utf-8-sig") as f:
            first_line = f.readline()
            delimiter = "\t" if "\t" in first_line else (";" if ";" in first_line else ",")
            f.seek(0)

            reader = csv.reader(f, delimiter=delimiter)
            header = next(reader, None)

            dim_col, factor_col, sub_col = 0, 1, 2
            if header:
                lower_header = [h.strip().lower() for h in header]
                for idx, h in enumerate(lower_header):
                    if "dimen" in h:
                        dim_col = idx
                    elif "factor" in h and "sub" not in h:
                        factor_col = idx
                    elif "subfactor" in h or "criterio" in h:
                        sub_col = idx

            for row in reader:
                if len(row) > max(dim_col, factor_col, sub_col):
                    dim = row[dim_col].strip()
                    fac = row[factor_col].strip()
                    sub = row[sub_col].strip()
                    if dim and fac and sub:
                        records.append((dim, fac, sub))

        return records
