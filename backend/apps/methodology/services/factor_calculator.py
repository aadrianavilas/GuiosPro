"""
Servicio de cálculo y sincronización de importancia para factores de la metodología GUIOS.
Implementa estrictamente la FASE A descrita en docs/prompt_calculos_guios.md:
- Relación de citas r_i = TC_i / NS_i
- Cuartiles por el método de mediana de mitades
- Importancia de la literatura (IL)
- Importancia sugerida (IS) combinando IE e IL mediante Matriz(IE, IL)
"""

from apps.methodology.models.factor import Factor
from apps.methodology.models.scale import ScaleLevel
from apps.evaluation.services.guios_calculator import (
    calcular_r,
    cuartiles,
    calcular_il,
    calcular_is,
)


def recalculate_factors_importance() -> None:
    """
    Recalcula automáticamente la Importancia de la Literatura (IL) y la
    Importancia Sugerida (IS) para todos los factores registrados en la base de datos.
    Cualquier cambio en citas, importancia de experto o en la cantidad de subfactores
    de cualquier factor actualiza toda la distribución.
    """
    factors = list(Factor.objects.prefetch_related("subfactors").all())
    if not factors:
        return

    valid_pairs = []
    for factor in factors:
        sub_count = factor.subfactors.count()
        if sub_count > 0:
            try:
                r_val = calcular_r(factor.total_citations, sub_count)
                valid_pairs.append((factor, r_val))
            except Exception:
                continue

    if not valid_pairs:
        # Si ningún factor tiene subfactores, dejar IL e IS como None
        for factor in factors:
            factor.literature_importance = None
            factor.suggested_importance = None
            factor.save(update_fields=["literature_importance", "suggested_importance"])
        return

    # Cuartiles por el método de mediana de mitades sobre los r de todos los factores válidos
    r_values = [r for _, r in valid_pairs]
    c = cuartiles(r_values)

    # Niveles de escala de importancia (1: Irrelevante, 2: Opcional, 3: Importante, 4: Fundamental)
    scale_levels = {
        level.value: level
        for level in ScaleLevel.objects.filter(
            scale__name__in=["Importancia", "Factor"],
            value__in=[1, 2, 3, 4]
        )
    }
    if len(scale_levels) < 4:
        for level in ScaleLevel.objects.filter(
            label__in=["Irrelevante", "Opcional", "Importante", "Fundamental"]
        ):
            if level.value not in scale_levels:
                scale_levels[level.value] = level

    valid_factor_ids = set()

    for factor, r_val in valid_pairs:
        valid_factor_ids.add(factor.id)
        il_val = calcular_il(r_val, c)
        ie_val = factor.expert_importance if factor.expert_importance in [1, 2, 3, 4] else 3
        is_val = calcular_is(ie_val, il_val)

        factor.literature_importance = scale_levels.get(il_val)
        factor.suggested_importance = scale_levels.get(is_val)
        factor.save(update_fields=["literature_importance", "suggested_importance"])

    # Aquellos factores que no tengan subfactores aún quedan con IL e IS pendientes (None)
    for factor in factors:
        if factor.id not in valid_factor_ids:
            factor.literature_importance = None
            factor.suggested_importance = None
            factor.save(update_fields=["literature_importance", "suggested_importance"])
