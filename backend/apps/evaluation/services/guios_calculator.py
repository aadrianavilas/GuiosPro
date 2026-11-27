"""
Módulo de cálculos del sistema GUIOS (evaluación de adopción de software FLOSS).
Basado estrictamente en la metodología GUIOS (Tesis de Rea Sánchez y prototipo guiosad.html).

Este módulo contiene funciones puras, tipadas y sin dependencias externas (ni UI ni numpy).
Implementa las cuatro fases:
- FASE A: Relación de citas (r), cuartiles (mediana de mitades), importancia de literatura (IL) e importancia sugerida (IS).
- FASE B: Importancia del decisor, matriz de combinación, importancia relativa y condición de relevancia.
- FASE C: Ponderación media del factor sobre sus subfactores valorados.
- FASE D: Clasificación FODA (umbral 3.0 y alcance) y Recomendación global (Categorías A, B y C).
"""

import math
from typing import List, Tuple, Dict, Any, Union, Optional


# ==============================================================================
# 2. ESCALAS Y CONSTANTES
# ==============================================================================

IMPORTANCIA_LABELS: Dict[int, str] = {
    1: "Irrelevante",
    2: "Opcional",
    3: "Importante",
    4: "Fundamental",
}

SUBFACTOR_LABELS: Dict[int, str] = {
    1: "No cumple el requisito",
    2: "Desconozco si cumple el requisito",
    3: "Cumple parcialmente el requisito",
    4: "Cumple el requisito",
}

ALCANCES_VALIDOS = {"Interno", "Externo"}

FODA_VALIDOS = {"Fortaleza", "Oportunidad", "Debilidad", "Amenaza"}

TEXTO_RECOMENDACION_A = (
    "Adoptar. Todos los factores han sido identificados como Oportunidades y/o "
    "Fortalezas. Esto quiere decir que la organización cumple satisfactoriamente "
    "con la mayoría de requisitos para adoptar la solución FLOSS."
)

TEXTO_RECOMENDACION_B = (
    "Es posible adoptar. A pesar que se han detectado amenazas y/o debilidades en "
    "factores cuya importancia relativa es opcional, por lo tanto, se sugiere "
    "revisar los criterios que no cumplen con lo mínimo requerido para adoptar."
)

TEXTO_RECOMENDACION_C = (
    "La organización debe de proporcionar los recursos necesarios que garanticen "
    "una adopción satisfactoria. Si se trata de factores internos deben de ser aspectos "
    "a mejorar dentro de la organización y si son factores externos, dedicar recursos "
    "de ingeniería para mejorar el software."
)


# ==============================================================================
# MATRIZ DE COMBINACIÓN (Sección 4.4 y 5)
# ==============================================================================

def matriz(a: int, b: int) -> int:
    """
    Matriz de combinación de importancias (Tabla 4 de la tesis GUIOS).
    Equivalencia exacta: floor((a + b) / 2) con a, b en {1, 2, 3, 4}.

    Reproduce las 16 celdas de la tabla para IS = Matriz(IE, IL)
    y Relativa = Matriz(IS, Decisor).
    """
    if not isinstance(a, int) or not isinstance(b, int):
        raise TypeError(f"Los valores deben ser enteros, recibido: a={type(a)}, b={type(b)}")
    if a < 1 or a > 4 or b < 1 or b > 4:
        raise ValueError(f"Los valores deben estar en el rango [1, 4]. Recibido a={a}, b={b}")

    return (a + b) // 2


# ==============================================================================
# FASE A: CÁLCULOS DEL SISTEMA / ADMINISTRADOR (Sección 4)
# ==============================================================================

def calcular_r(tc: int, ns: int) -> float:
    """
    Calcula la relación de citas por subfactor: r_i = TC_i / NS_i.
    - tc: Total de citas (TC >= 0).
    - ns: Número de subfactores (NS > 0).
    """
    if ns <= 0:
        raise ValueError("Un factor debe tener al menos 1 subfactor para calcularse (NS > 0).")
    if tc < 0:
        raise ValueError("El total de citas no puede ser negativo (TC >= 0).")

    return float(tc) / float(ns)


def _mediana(arr: List[float]) -> float:
    """Calcula la mediana de una lista ordenada de flotantes."""
    n = len(arr)
    if n == 0:
        raise ValueError("No se puede calcular la mediana de una lista vacía.")
    mid = n // 2
    if n % 2 == 1:
        return float(arr[mid])
    else:
        return (float(arr[mid - 1]) + float(arr[mid])) / 2.0


def cuartiles(valores: List[float]) -> Tuple[float, float, float, float]:
    """
    Calcula los cuartiles (rq1, rq2, rq3, rq4) mediante el método de 'mediana de mitades'.
    IMPORTANTE: No usa percentiles de librería (como numpy o Excel CUARTIL.INC), ya que
    generan valores distintos con los datos de literatura.

    Reglas:
    1. Ordenar r_i ascendente (n valores).
    2. rq2 = mediana de todo el conjunto.
    3. Si n es impar, excluir el valor central de ambas mitades.
       Mitad inferior = primeros floor(n/2) valores.
       Mitad superior = últimos floor(n/2) valores.
    4. rq1 = mediana de la mitad inferior.
    5. rq3 = mediana de la mitad superior.
    6. rq4 = máximo del conjunto.
    """
    if not valores:
        raise ValueError("La lista de valores para calcular cuartiles no puede estar vacía.")

    sorted_vals = sorted(valores)
    n = len(sorted_vals)

    if n == 1:
        v = float(sorted_vals[0])
        return v, v, v, v

    rq2 = _mediana(sorted_vals)

    k = n // 2
    mitad_inferior = sorted_vals[:k]
    mitad_superior = sorted_vals[-k:]

    rq1 = _mediana(mitad_inferior)
    rq3 = _mediana(mitad_superior)
    rq4 = float(sorted_vals[-1])

    return rq1, rq2, rq3, rq4


def calcular_il(r: float, c: Tuple[float, float, float, float]) -> int:
    """
    Calcula la Importancia de la Literatura (IL) a partir del ratio r y los 4 cuartiles:
    IL(r) = 1 si r <= rq1
            2 si rq1 < r <= rq2
            3 si rq2 < r <= rq3
            4 si rq3 < r <= rq4 (o r > rq3)

    Compara con los valores exactos (sin redondear cuartiles).
    """
    rq1, rq2, rq3, rq4 = c
    if r <= rq1:
        return 1
    elif r <= rq2:
        return 2
    elif r <= rq3:
        return 3
    else:
        return 4


def calcular_is(ie: int, il: int) -> int:
    """
    Calcula la Importancia Sugerida (IS):
    IS_i = Matriz(IE_i, IL_i)
    """
    return matriz(ie, il)


def recalcular_importancia_sugerida(factores: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Orquestador de la FASE A completa para una lista de factores.
    Cada factor en 'factores' debe ser un diccionario con al menos:
      - 'tc' o 'total_citas': int
      - 'ns' o 'num_subfactores': int
      - 'ie' o 'importancia_experto': int (por defecto 3 si no se especifica)
      - Opcional: 'id', 'name', etc.

    Retorna un diccionario con:
      - 'cuartiles': (rq1, rq2, rq3, rq4)
      - 'factores': lista de factores enriquecidos con 'r', 'il' e 'is'.
    """
    if not factores:
        raise ValueError("La lista de factores no puede estar vacía.")

    # 1. Validar y calcular r_i para cada factor
    r_list: List[float] = []
    processed_factors: List[Dict[str, Any]] = []

    for f in factores:
        tc = f.get("tc", f.get("total_citas"))
        ns = f.get("ns", f.get("num_subfactores"))
        ie = f.get("ie", f.get("importancia_experto", 3))

        if tc is None or ns is None:
            factor_name = f.get("name", f.get("nombre", "Desconocido"))
            raise ValueError(f"El factor '{factor_name}' debe incluir total de citas (tc) y subfactores (ns).")

        r = calcular_r(tc, ns)
        r_list.append(r)

        factor_copy = dict(f)
        factor_copy["r"] = r
        factor_copy["tc"] = tc
        factor_copy["ns"] = ns
        factor_copy["ie"] = ie
        processed_factors.append(factor_copy)

    # 2. Cuartiles globales sobre todos los r_i
    c = cuartiles(r_list)

    # 3. Asignar IL e IS a cada factor
    for f in processed_factors:
        il = calcular_il(f["r"], c)
        is_val = calcular_is(f["ie"], il)
        f["il"] = il
        f["is"] = is_val

    return {
        "cuartiles": {
            "rq1": c[0],
            "rq2": c[1],
            "rq3": c[2],
            "rq4": c[3],
        },
        "factores": processed_factors,
    }


# ==============================================================================
# FASE B: IMPORTANCIA DEL DECISOR Y RELATIVA (Sección 5)
# ==============================================================================

def calcular_relativa(is_val: int, decisor_val: int) -> int:
    """
    Calcula la Importancia Relativa:
    Relativa_i = Matriz(IS_i, D_i) = floor((IS_i + D_i) / 2)
    """
    return matriz(is_val, decisor_val)


def es_relevante(relativa: int) -> bool:
    """
    Determina si un factor es relevante para la evaluación:
    relevante_i <=> Relativa_i > 1 (es decir, 2: Opcional, 3: Importante, 4: Fundamental).
    Si Relativa_i == 1 (Irrelevante), el factor no es relevante.
    """
    if not isinstance(relativa, int):
        raise TypeError(f"La importancia relativa debe ser un entero, recibido: {type(relativa)}")
    if relativa < 1 or relativa > 4:
        raise ValueError(f"La importancia relativa debe estar entre 1 y 4, recibido: {relativa}")

    return relativa > 1


# ==============================================================================
# FASE C: PONDERACIÓN MEDIA DEL FACTOR (Sección 6)
# ==============================================================================

def calcular_ponderacion_media(valoraciones: List[int]) -> float:
    """
    Calcula la ponderación media de un factor sobre las valoraciones de sus subfactores:
    ponderacion_media_i = ( Σ valoracion_subfactor_j ) / NS_i

    - Requiere que todas las valoraciones estén en {1, 2, 3, 4}.
    - Si no hay valoraciones, lanza ValueError.
    - Se retorna el valor flotante exacto (sin redondear).
    """
    if not valoraciones:
        raise ValueError("La lista de valoraciones de subfactores no puede estar vacía.")

    for v in valoraciones:
        if not isinstance(v, int):
            raise TypeError(f"La valoración del subfactor debe ser un entero, recibido: {type(v)}")
        if v < 1 or v > 4:
            raise ValueError(f"Las valoraciones de subfactor deben estar entre 1 y 4, recibido: {v}")

    return float(sum(valoraciones)) / float(len(valoraciones))


# ==============================================================================
# FASE D: CLASIFICACIÓN FODA (Sección 7)
# ==============================================================================

def clasificar_foda(media: float, alcance: str) -> str:
    """
    Clasifica el factor en la matriz FODA según su alcance y ponderación media:

    | Alcance | Media >= 3.0 | Media < 3.0 |
    | Interno | Fortaleza    | Debilidad   |
    | Externo | Oportunidad  | Amenaza     |

    - Alcance: 'Interno' o 'Externo' (no sensible a mayúsculas/minúsculas).
    - Umbral exacto: 3.0 (sin redondear; 2.999 es < 3.0).
    """
    if not isinstance(media, (int, float)):
        raise TypeError(f"La media debe ser un número, recibido: {type(media)}")
    if media < 1.0 or media > 4.0:
        raise ValueError(f"La ponderación media debe estar en el rango [1.0, 4.0], recibido: {media}")

    alcance_norm = alcance.strip().capitalize()
    if alcance_norm not in ALCANCES_VALIDOS:
        raise ValueError(f"Alcance inválido: '{alcance}'. Debe ser 'Interno' o 'Externo'.")

    if media >= 3.0:
        return "Fortaleza" if alcance_norm == "Interno" else "Oportunidad"
    else:
        return "Debilidad" if alcance_norm == "Interno" else "Amenaza"


def explicar_foda(
    valoraciones: List[int],
    media: float,
    alcance: str,
    foda: Optional[str] = None,
) -> str:
    """
    Genera el texto de explicación del resultado FODA para el decisor (RF-17).
    Ejemplo: 'Cálculo: (4 + 3) / 2 = 3.5 | Regla: externo y ponderación ≥ 3 → Oportunidad'
    """
    alcance_norm = alcance.strip().capitalize()
    if foda is None:
        foda = clasificar_foda(media, alcance_norm)

    n = len(valoraciones)
    vals_str = " + ".join(str(v) for v in valoraciones)
    cond_str = "≥ 3" if media >= 3.0 else "< 3"

    # Redondeo amigable para el display del string pero basado en la media exacta
    media_display = f"{media:.3f}".rstrip("0").rstrip(".")

    return f"Cálculo: ({vals_str}) / {n} = {media_display} | Regla: {alcance_norm.lower()} y ponderación {cond_str} → {foda}"


# ==============================================================================
# FASE D: RECOMENDACIÓN GLOBAL (Sección 8)
# ==============================================================================

def calcular_recomendacion(
    factores_evaluados: List[Union[Dict[str, Any], Tuple[int, str]]]
) -> Dict[str, Any]:
    """
    Calcula la recomendación global del sistema GUIOS a partir de la lista de factores relevantes evaluados.

    Cada elemento puede ser:
      - Una tupla: (relativa: int, foda: str)
      - Un diccionario con claves 'relativa' y 'foda' (y opcionalmente 'nombre', 'factor_id', etc.)

    Reglas de prioridad:
      1. Prioridad 1: Existe al menos un factor 'desfavorable crítico'
         (FODA in {Debilidad, Amenaza} Y Relativa in {Importante (3), Fundamental (4)})
         --> Recomendación C
      2. Prioridad 2: (No aplica 1) y existe al menos un factor 'desfavorable opcional'
         (FODA in {Debilidad, Amenaza} Y Relativa == Opcional (2))
         --> Recomendación B
      3. Prioridad 3: Todos son favorables (Fortaleza / Oportunidad)
         --> Recomendación A

    Retorna un diccionario estructurado con:
      - categoria: 'A', 'B' o 'C'
      - titulo: Nombre corto de la recomendación
      - texto: Texto íntegro oficial de la metodología GUIOS
      - factores_desfavorables_criticos: lista de factores que activaron C
      - factores_desfavorables_opcionales: lista de factores que activaron B
      - resumen_foda: conteos de F, O, D, A
    """
    if not factores_evaluados:
        raise ValueError("No hay factores evaluados para calcular la recomendación.")

    # Normalizar items
    parsed_items: List[Dict[str, Any]] = []
    conteo_foda = {"Fortaleza": 0, "Oportunidad": 0, "Debilidad": 0, "Amenaza": 0}

    for item in factores_evaluados:
        if isinstance(item, tuple):
            relativa, foda = item
            nombre = "Factor"
            extra = {}
        elif isinstance(item, dict):
            relativa = item.get("relativa", item.get("relative_importance"))
            foda = item.get("foda", item.get("clasificacion_foda", item.get("swot_classification")))
            nombre = item.get("nombre", item.get("name", item.get("factor_name", "Factor")))
            extra = item
        else:
            raise TypeError(f"Elemento inválido en factores_evaluados: {type(item)}")

        # Normalizar foda (por ejemplo si viene 'F', 'O', 'D', 'A')
        foda_map = {
            "F": "Fortaleza",
            "O": "Oportunidad",
            "D": "Debilidad",
            "A": "Amenaza",
        }
        foda_norm = foda_map.get(str(foda).upper(), str(foda).capitalize())

        if foda_norm not in FODA_VALIDOS:
            raise ValueError(f"Clasificación FODA inválida: '{foda}'. Debe ser Fortaleza, Oportunidad, Debilidad o Amenaza.")

        if not isinstance(relativa, int) or relativa < 1 or relativa > 4:
            raise ValueError(f"Importancia relativa inválida: {relativa}. Debe ser entero de 1 a 4.")

        conteo_foda[foda_norm] += 1

        parsed_items.append({
            "nombre": nombre,
            "relativa": relativa,
            "foda": foda_norm,
            "extra": extra,
        })

    # Factores desfavorables
    desfavorables_criticos = [
        item for item in parsed_items
        if item["foda"] in ("Debilidad", "Amenaza") and item["relativa"] in (3, 4)
    ]

    desfavorables_opcionales = [
        item for item in parsed_items
        if item["foda"] in ("Debilidad", "Amenaza") and item["relativa"] == 2
    ]

    # Evaluación por orden de prioridad
    if desfavorables_criticos:
        categoria = "C"
        titulo = "No se debe adoptar"
        texto = TEXTO_RECOMENDACION_C
    elif desfavorables_opcionales:
        categoria = "B"
        titulo = "Es posible adoptar"
        texto = TEXTO_RECOMENDACION_B
    else:
        categoria = "A"
        titulo = "Adoptar"
        texto = TEXTO_RECOMENDACION_A

    return {
        "categoria": categoria,
        "titulo": titulo,
        "texto": texto,
        "total_factores_evaluados": len(parsed_items),
        "resumen_foda": conteo_foda,
        "factores_desfavorables_criticos": desfavorables_criticos,
        "factores_desfavorables_opcionales": desfavorables_opcionales,
    }


# ==============================================================================
# ALIASES CAMELCASE (Para compatibilidad con la especificación del prompt)
# ==============================================================================

calcularR = calcular_r
calcularIL = calcular_il
calcularIS = calcular_is
calcularRelativa = calcular_relativa
esRelevante = es_relevante
calcularPonderacionMedia = calcular_ponderacion_media
clasificarFoda = clasificar_foda
explicarFoda = explicar_foda
calcularRecomendacion = calcular_recomendacion
recalcularImportanciaSugerida = recalcular_importancia_sugerida
