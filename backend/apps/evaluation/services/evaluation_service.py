"""
Servicio de negocio para la gestión de evaluaciones, integración con la base de datos
y ejecución del motor de cálculo GUIOS.
"""

from typing import List, Dict, Any, Optional
from django.utils import timezone
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.evaluation.models.evaluation import Evaluation, EvaluationResult
from apps.evaluation.models.factor_assessment import FactorAssessment
from apps.evaluation.models.subfactor_assessment import SubfactorAssessment
from apps.methodology.models.factor import Factor
from apps.methodology.models.subfactor import Subfactor
from apps.methodology.models.scale import Scale, ScaleLevel
from apps.methodology.models.scope import Scope
from apps.methodology.models.recommendation import Recommendation

from apps.evaluation.services.guios_calculator import (
    matriz,
    calcular_relativa,
    es_relevante,
    calcular_ponderacion_media,
    clasificar_foda,
    explicar_foda,
    calcular_recomendacion,
)


class EvaluationCalculationService:
    """
    Servicio de orquestación de la evaluación GUIOS sobre la base de datos.
    """

    @staticmethod
    def _get_factor_scale_levels() -> Dict[int, ScaleLevel]:
        """Obtiene un mapa {valor: ScaleLevel} para la escala de Factor/Importancia."""
        # Se busca la escala 'Factor' o 'Importancia'
        scale = Scale.objects.filter(name__in=["Factor", "Importancia"]).first()
        if not scale:
            scale = Scale.objects.first()
        if not scale:
            raise ValidationError("No existe ninguna escala de Importancia/Factor configurada en la base de datos.")

        levels = ScaleLevel.objects.filter(scale=scale)
        return {level.value: level for level in levels}

    @staticmethod
    def _get_subfactor_scale_levels() -> Dict[int, ScaleLevel]:
        """Obtiene un mapa {valor: ScaleLevel} para la escala de Subfactor."""
        scale = Scale.objects.filter(name__in=["Subfactor", "Valoración de subfactor"]).first()
        if not scale:
            raise ValidationError("No existe ninguna escala de Subfactor configurada en la base de datos.")

        levels = ScaleLevel.objects.filter(scale=scale)
        return {level.value: level for level in levels}

    @classmethod
    @transaction.atomic
    def save_factor_assessments(
        cls,
        evaluation: Evaluation,
        factors_payload: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Registra o actualiza la importancia del decisor y el alcance para cada factor (FASE B).
        Recalcula la importancia relativa y limpia resultados posteriores si cambia relevancia (Reglas B2, B3).
        """
        factor_scales = cls._get_factor_scale_levels()
        scopes = {s.name.capitalize(): s for s in Scope.objects.all()}
        results_summary: List[Dict[str, Any]] = []

        for item in factors_payload:
            factor_id = item.get("factor_id") or item.get("factor")
            decisor_val = item.get("decision_maker_importance") or item.get("importance_value")
            scope_name = (item.get("scope") or item.get("scope_name") or "Interno").strip().capitalize()

            if not factor_id:
                raise ValidationError("Cada elemento debe tener 'factor_id'.")
            if decisor_val not in factor_scales:
                raise ValidationError(f"Importancia del decisor inválida: {decisor_val}. Debe estar en 1..4.")
            if scope_name not in scopes:
                # Si no está en BD, buscar por ID o crear por defecto
                scope_obj = Scope.objects.filter(name__iexact=scope_name).first()
                if not scope_obj:
                    scope_obj = Scope.objects.create(name=scope_name)
                    scopes[scope_name] = scope_obj
            else:
                scope_obj = scopes[scope_name]

            factor = Factor.objects.select_related("suggested_importance").get(id=factor_id)

            # Obtener IS (sugerida). Si el factor no tiene, usar por defecto 2 o 3.
            is_val = 3
            if factor.suggested_importance:
                is_val = factor.suggested_importance.value

            # Calcular Relativa = Matriz(IS, Decisor)
            relativa_val = calcular_relativa(is_val, decisor_val)
            relevante = es_relevante(relativa_val) and (decisor_val > 1)

            decisor_scale_level = factor_scales[decisor_val]
            relativa_scale_level = factor_scales[relativa_val]

            # Upsert FactorAssessment
            assessment, created = FactorAssessment.objects.update_or_create(
                evaluation=evaluation,
                factor=factor,
                defaults={
                    "decision_maker_importance": decisor_scale_level,
                    "relative_importance": relativa_scale_level,
                    "scope": scope_obj,
                },
            )

            # REGLA DE FLUJO:
            # Si el factor NO es relevante (relativa == 1), eliminar subfactores evaluados y resultados previos
            if not relevante:
                SubfactorAssessment.objects.filter(
                    evaluation=evaluation,
                    subfactor__factor=factor,
                ).delete()
                EvaluationResult.objects.filter(
                    evaluation=evaluation,
                    factor=factor,
                ).delete()
            else:
                # Si cambió el alcance o importancia de un factor previamente evaluado,
                # invalidar su resultado para forzar recálculo
                EvaluationResult.objects.filter(
                    evaluation=evaluation,
                    factor=factor,
                ).delete()

            results_summary.append({
                "factor_id": factor.id,
                "factor_name": factor.name,
                "suggested_importance": is_val,
                "decision_maker_importance": decisor_val,
                "relative_importance": relativa_val,
                "scope": scope_obj.name,
                "is_relevant": relevante,
            })

        if evaluation.state == Evaluation.State.PENDIENTE:
            evaluation.state = Evaluation.State.EN_PROGRESO
            evaluation.save(update_fields=["state", "updated_at"])

        return results_summary

    @classmethod
    @transaction.atomic
    def save_subfactor_assessments(
        cls,
        evaluation: Evaluation,
        subfactors_payload: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Registra o actualiza la valoración de cada subfactor (FASE C).
        Valida que pertenezcan a factores relevantes en la evaluación.
        """
        subfactor_scales = cls._get_subfactor_scale_levels()
        results: List[Dict[str, Any]] = []

        for item in subfactors_payload:
            subfactor_id = item.get("subfactor_id") or item.get("subfactor")
            val = item.get("value") or item.get("scale_subfactor")

            if not subfactor_id:
                raise ValidationError("Cada elemento debe tener 'subfactor_id'.")
            if val not in subfactor_scales:
                raise ValidationError(f"Valoración de subfactor inválida: {val}. Debe estar en 1..4.")

            subfactor = Subfactor.objects.select_related("factor").get(id=subfactor_id)

            # Verificar si el factor fue evaluado y es relevante
            factor_assessment = FactorAssessment.objects.filter(
                evaluation=evaluation,
                factor=subfactor.factor,
            ).select_related("relative_importance", "decision_maker_importance").first()

            is_fa_relevant = (
                factor_assessment
                and factor_assessment.decision_maker_importance
                and factor_assessment.decision_maker_importance.value > 1
                and es_relevante(factor_assessment.relative_importance.value)
            )

            if not is_fa_relevant:
                raise ValidationError(
                    f"El subfactor '{subfactor.name}' pertenece al factor '{subfactor.factor.name}', "
                    "el cual no es relevante o no ha sido configurado en la evaluación."
                )

            scale_subfactor_obj = subfactor_scales[val]

            SubfactorAssessment.objects.update_or_create(
                evaluation=evaluation,
                subfactor=subfactor,
                defaults={"scale_subfactor": scale_subfactor_obj},
            )

            results.append({
                "subfactor_id": subfactor.id,
                "subfactor_name": subfactor.name,
                "factor_id": subfactor.factor.id,
                "value": val,
                "label": scale_subfactor_obj.label,
            })

        return results

    @classmethod
    @transaction.atomic
    def calculate_evaluation_results(cls, evaluation: Evaluation, finalize: bool = True) -> Dict[str, Any]:
        """
        Ejecuta el cálculo completo de resultados (FASE C, D1, D2):
        1. Valida que todos los factores relevantes tengan todos sus subfactores valorados.
        2. Calcula la ponderación media y FODA para cada factor relevante.
        3. Calcula la recomendación global (A, B o C).
        4. Persiste los resultados y actualiza la evaluación.
        """
        # 1. Obtener todos los factores relevantes evaluados
        factor_assessments = FactorAssessment.objects.filter(
            evaluation=evaluation,
        ).select_related("factor__dimension", "relative_importance", "scope")

        relevant_assessments = [
            fa for fa in factor_assessments
            if (fa.decision_maker_importance and fa.decision_maker_importance.value > 1)
            and es_relevante(fa.relative_importance.value)
        ]

        if not relevant_assessments:
            raise ValidationError(
                "La evaluación no tiene ningún factor relevante configurado. "
                "Al menos un factor debe tener importancia relativa > 1."
            )

        # 2. Validar completitud de subfactores por cada factor relevante
        pares_para_recomendacion: List[Dict[str, Any]] = []
        factores_calculados: List[Dict[str, Any]] = []
        foda_code_map = {
            "Fortaleza": EvaluationResult.FODA.FORTALEZA,
            "Oportunidad": EvaluationResult.FODA.OPORTUNIDAD,
            "Debilidad": EvaluationResult.FODA.DEBILIDAD,
            "Amenaza": EvaluationResult.FODA.AMENAZA,
        }

        # Subfactores valorados en la evaluación
        sub_assessments = SubfactorAssessment.objects.filter(
            evaluation=evaluation,
        ).select_related("subfactor", "scale_subfactor")
        sub_by_factor: Dict[int, List[SubfactorAssessment]] = {}
        for sa in sub_assessments:
            sub_by_factor.setdefault(sa.subfactor.factor_id, []).append(sa)

        for fa in relevant_assessments:
            factor = fa.factor
            expected_subfactors = factor.subfactors.all()
            expected_count = expected_subfactors.count()
            evaluated_subs = sub_by_factor.get(factor.id, [])

            if len(evaluated_subs) < expected_count:
                raise ValidationError(
                    f"Faltan subfactores por valorar en el factor '{factor.name}'. "
                    f"Valorados: {len(evaluated_subs)} de {expected_count} requeridos."
                )

            # Extraer valoraciones 1..4
            valoraciones = [sa.scale_subfactor.value for sa in evaluated_subs]

            # FASE C: Ponderación media
            media = calcular_ponderacion_media(valoraciones)

            # FASE D1: Clasificación FODA
            scope_name = fa.scope.name.capitalize()
            foda_clasificacion = clasificar_foda(media, scope_name)
            foda_code = foda_code_map[foda_clasificacion]

            # Guardar o actualizar EvaluationResult
            EvaluationResult.objects.update_or_create(
                evaluation=evaluation,
                factor=factor,
                defaults={
                    "average_weighting": media,
                    "swot_classification": foda_code,
                },
            )

            # Explicación del cálculo
            explicacion = explicar_foda(valoraciones, media, scope_name, foda_clasificacion)

            info_factor = {
                "factor_id": factor.id,
                "factor_name": factor.name,
                "dimension_id": factor.dimension_id,
                "dimension_name": factor.dimension.name if factor.dimension else "",
                "relative_importance": fa.relative_importance.value,
                "scope": scope_name,
                "average_weighting": round(media, 4),
                "average_weighting_display": f"{media:.1f}",
                "swot_classification": foda_clasificacion,
                "swot_code": foda_code,
                "explanation": explicacion,
                "subfactors": [
                    {
                        "subfactor_id": sa.subfactor.id,
                        "subfactor_name": sa.subfactor.name,
                        "value": sa.scale_subfactor.value,
                        "label": sa.scale_subfactor.label,
                    }
                    for sa in evaluated_subs
                ],
            }
            factores_calculados.append(info_factor)

            pares_para_recomendacion.append({
                "relativa": fa.relative_importance.value,
                "foda": foda_clasificacion,
                "nombre": factor.name,
                "factor_id": factor.id,
            })

        # 3. FASE D2: Recomendación global
        rec = calcular_recomendacion(pares_para_recomendacion)

        # Consultar datos oficiales de la recomendación almacenada en la base de datos
        rec_db = Recommendation.objects.filter(code=rec["categoria"]).first()
        if not rec_db:
            rec_db, _ = Recommendation.objects.get_or_create(
                code=rec["categoria"],
                defaults={
                    "title": (
                        "Adoptar"
                        if rec["categoria"] == "A"
                        else ("Es posible adoptar" if rec["categoria"] == "B" else "No se debe adoptar")
                    ),
                    "description": rec["texto"],
                    "order": 1 if rec["categoria"] == "A" else (2 if rec["categoria"] == "B" else 3),
                },
            )
        if rec_db:
            rec["texto"] = rec_db.description
            rec["titulo"] = rec_db.title

        # Actualizar la evaluación
        evaluation.recommendation = rec_db
        if finalize:
            evaluation.state = Evaluation.State.COMPLETADA
            evaluation.end_date = timezone.now().date()
            evaluation.save(update_fields=[
                "recommendation",
                "state",
                "end_date",
                "updated_at",
            ])
        else:
            if evaluation.state != Evaluation.State.COMPLETADA:
                evaluation.state = Evaluation.State.EN_PROGRESO
            evaluation.save(update_fields=[
                "recommendation",
                "state",
                "updated_at",
            ])

        # Agrupar factores por FODA
        foda_grupos = {
            "Fortalezas": [f for f in factores_calculados if f["swot_classification"] == "Fortaleza"],
            "Oportunidades": [f for f in factores_calculados if f["swot_classification"] == "Oportunidad"],
            "Debilidades": [f for f in factores_calculados if f["swot_classification"] == "Debilidad"],
            "Amenazas": [f for f in factores_calculados if f["swot_classification"] == "Amenaza"],
        }

        return {
            "evaluation_id": evaluation.id,
            "evaluation_name": evaluation.name,
            "state": evaluation.state,
            "recommendation": rec,
            "factors_calculated": factores_calculados,
            "foda_groups": foda_grupos,
        }
