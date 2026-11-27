import os
import json
import logging
import requests
from typing import Any, Dict, List, Optional
from django.conf import settings
from rest_framework.exceptions import ValidationError

from apps.evaluation.models.evaluation import Evaluation, EvaluationResult
from apps.evaluation.models.factor_assessment import FactorAssessment
from apps.evaluation.models.subfactor_assessment import SubfactorAssessment
from apps.evaluation.models.ai_recommendation_analysis import AnalisisIARecomendacion
from apps.methodology.models.recommendation import Recommendation

logger = logging.getLogger(__name__)

EXCLUDED_MODEL_KEYWORDS: List[str] = [
    "whisper",
    "tts",
    "playai",
    "orpheus",
    "guard",
    "safeguard",
    "embed",
]

DEFAULT_GROQ_MODELS: List[str] = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama3-70b-8192",
    "llama-3.1-8b-instant",
]


class AiRecommendationService:
    """
    Servicio para generar el análisis ampliado de la recomendación de una evaluación
    utilizando la IA de Groq conforme a la metodología GUIOS.
    """

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key: str = (
            api_key
            or getattr(settings, "GROQ_API_KEY", "")
            or os.getenv("GROQ_API_KEY", "")
        )
        self.api_base_url: str = "https://api.groq.com/openai/v1"

    def _get_available_models(self) -> List[str]:
        """
        Obtiene los modelos disponibles de Groq priorizando los más capaces para razonamiento.
        """
        if not self.api_key:
            return DEFAULT_GROQ_MODELS

        try:
            resp = requests.get(
                f"{self.api_base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=5,
            )
            if resp.ok:
                data = resp.json().get("data", [])
                all_ids: List[str] = [m.get("id") for m in data if m.get("id")]
                text_models: List[str] = [
                    m_id for m_id in all_ids
                    if not any(ex in m_id.lower() for ex in EXCLUDED_MODEL_KEYWORDS)
                ]
                text_models.sort(
                    key=lambda m: 0
                    if any(p in m.lower() for p in ["70b", "versatile", "120b", "gpt-oss"])
                    else 1
                )
                if text_models:
                    return text_models
        except Exception as e:
            logger.warning("No se pudo obtener la lista dinámica de modelos de Groq: %s", e)

        return DEFAULT_GROQ_MODELS

    def _load_prompt_template(self) -> str:
        """
        Carga la plantilla de prompt desde backend/apps/evaluation/prompt/recomendation_ia.txt.
        """
        prompt_path = os.path.join(
            settings.BASE_DIR, "apps", "evaluation", "prompt", "recomendation_ia.txt"
        )
        if os.path.exists(prompt_path):
            try:
                with open(prompt_path, "r", encoding="utf-8") as f:
                    return f.read()
            except Exception as e:
                logger.error("Error leyendo archivo de prompt recomendation_ia.txt: %s", e)

        return (
            "Actúa como un especialista en evaluación de adopción de software según la metodología GUIOS.\n"
            "Interpreta la recomendación y analiza los factores más relevantes.\n"
            "Responde estrictamente en formato JSON con las claves 'interpretacion' y 'analisis_factores'."
        )

    def generate_analysis(self, evaluation: Evaluation) -> AnalisisIARecomendacion:
        """
        Ejecuta el análisis con la IA de Groq para la evaluación dada y persiste el resultado.
        """
        if not self.api_key:
            raise ValidationError(
                "La clave de API de Groq (GROQ_API_KEY) no está configurada en el sistema."
            )

        # 1. Obtener datos de la recomendación y resultados
        rec_db = evaluation.recommendation or (
            Recommendation.objects.filter(code=evaluation.recommendation_category).first()
            if evaluation.recommendation_category
            else None
        )
        rec_category = rec_db.code if rec_db else (evaluation.recommendation_category or "B")
        rec_title = rec_db.title if rec_db else (
            "Adoptar" if rec_category == "A"
            else "Es posible adoptar" if rec_category == "B"
            else "No se debe adoptar"
        )
        justificacion = rec_db.description if rec_db else (evaluation.recommendation_text or "")

        # 2. Recopilar factores relevantes y sus subfactores
        results = EvaluationResult.objects.filter(evaluation=evaluation).select_related(
            "factor__dimension"
        )
        factor_assessments = {
            fa.factor_id: fa
            for fa in FactorAssessment.objects.filter(evaluation=evaluation).select_related(
                "relative_importance", "scope"
            )
        }
        sub_assessments = SubfactorAssessment.objects.filter(
            evaluation=evaluation
        ).select_related("subfactor", "scale_subfactor")

        sub_by_factor: Dict[int, List[SubfactorAssessment]] = {}
        for sa in sub_assessments:
            sub_by_factor.setdefault(sa.subfactor.factor_id, []).append(sa)

        factores_data: List[Dict[str, Any]] = []
        factores_text_list: List[str] = []

        foda_display = {
            EvaluationResult.FODA.FORTALEZA: "Fortaleza",
            EvaluationResult.FODA.OPORTUNIDAD: "Oportunidad",
            EvaluationResult.FODA.DEBILIDAD: "Debilidad",
            EvaluationResult.FODA.AMENAZA: "Amenaza",
        }

        for res in results:
            factor = res.factor
            fa = factor_assessments.get(factor.id)
            dim_name = factor.dimension.name if factor.dimension else "General"
            foda_name = foda_display.get(res.swot_classification, res.swot_classification)
            relativa_val = fa.relative_importance.value if fa and fa.relative_importance else 2
            media_val = res.average_weighting

            subs = sub_by_factor.get(factor.id, [])
            sub_list = [
                {
                    "nombre": sa.subfactor.name,
                    "valor": sa.scale_subfactor.value,
                    "etiqueta": sa.scale_subfactor.label,
                }
                for sa in subs
            ]

            factores_data.append({
                "nombre": factor.name,
                "dimension": dim_name,
                "clasificacion": foda_name,
                "descripcion": factor.description or "",
                "resultado": f"Ponderación media: {media_val:.2f}/4.0 (Importancia relativa: {relativa_val})",
                "subfactores": sub_list,
            })

            sub_str = ", ".join([f"{s['nombre']} ({s['valor']}/4)" for s in sub_list])
            factores_text_list.append(
                f"- Factor: {factor.name}\n"
                f"  Dimensión: {dim_name}\n"
                f"  Clasificación FODA: {foda_name}\n"
                f"  Descripción: {factor.description or 'Sin descripción'}\n"
                f"  Resultado evaluación: Ponderación media {media_val:.2f} sobre 4.0 (Importancia relativa: {relativa_val})\n"
                f"  Subfactores evaluados: {sub_str if sub_str else 'N/A'}"
            )

        # 3. Estructura JSON de entrada según format_json/input_recomendation.json
        input_json_data = {
            "metodologia": {
                "nombre": "Metodología GUIOS de evaluación de adopción de software libre",
                "criterios": (
                    "Evaluación jerárquica de 3 dimensiones (Tecnológica, Organizacional, Entorno), "
                    "con factores técnicos valorados entre 1 y 4 combinados mediante matriz de decisión matemática. "
                    "Factores con importancia 1 son considerados irrelevantes y excluidos."
                ),
                "reglas_evaluacion": (
                    "1. La ponderación media por factor se calcula como promedio de sus subfactores (escala 1 a 4). "
                    "2. Clasificación FODA: Factores internos con media >= 3.0 son Fortalezas, y < 3.0 son Debilidades; "
                    "factores externos con media >= 3.0 son Oportunidades, y < 3.0 son Amenazas. "
                    "3. Regla crítica: Si existe al menos un factor desfavorable crítico (importancia relativa 4 con "
                    "clasificación Debilidad o Amenaza), la recomendación es obligatoriamente 'No se debe adoptar' (Categoría C). "
                    "Si no hay factores críticos desfavorables pero existen riesgos moderados, 'Es posible adoptar' (Categoría B). "
                    "Si prevalecen condiciones favorables sin desfavorables críticos, 'Adoptar' (Categoría A)."
                ),
            },
            "evaluacion": {
                "recomendacion": f"{rec_title} (Categoría {rec_category})",
                "justificacion": justificacion,
                "factores": factores_data,
            },
        }

        # 4. Construir prompt interpolando placeholders
        template = self._load_prompt_template()
        prompt = template

        metodologia_str = (
            "La metodología GUIOS evalúa la adopción de software libre mediante evaluación jerárquica:\n"
            "- 3 Dimensiones metodológicas: Tecnológica, Organizacional y del Entorno.\n"
            "- Escala discreta de 1 a 4.\n"
            "- Filtro de irrelevancia: Factores con importancia 1 quedan excluidos de la evaluación.\n"
            "- Ponderación media: Promedio aritmético de los subfactores de cada factor relevante.\n"
            "- Clasificación FODA: Factores de alcance Interno con media >= 3.0 son Fortalezas, < 3.0 son Debilidades. "
            "Factores de alcance Externo con media >= 3.0 son Oportunidades, < 3.0 son Amenazas.\n"
            "- Regla de recomendación: Si existe al menos un factor crítico desfavorable (importancia relativa 4 clasificado "
            "en Debilidad o Amenaza), la recomendación final es 'No se debe adoptar' (Categoría C). Si no hay desfavorables "
            "críticos pero existen riesgos moderados, 'Es posible adoptar' (Categoría B). Si las condiciones son plenamente "
            "favorables, 'Adoptar' (Categoría A)."
        )

        prompt = prompt.replace("[METODOLOGÍA Y REGLAS DE EVALUACIÓN DEL SISTEMA]", metodologia_str)
        prompt = prompt.replace("[RECOMENDACIÓN FINAL]", f"{rec_title} (Categoría {rec_category})")
        prompt = prompt.replace("[JUSTIFICACIÓN GENERADA POR EL SISTEMA]", justificacion)

        factores_block = "\n\n".join(factores_text_list)
        # Reemplazar la sección de lista dinámica de factores
        if "[LISTA DINÁMICA DE FACTORES" in prompt:
            # Buscar el bloque hasta el cierre ']'
            idx_start = prompt.find("[LISTA DINÁMICA DE FACTORES")
            idx_end = prompt.find("]", idx_start)
            if idx_start != -1 and idx_end != -1:
                prompt = prompt[:idx_start] + factores_block + prompt[idx_end + 1:]
        else:
            prompt += f"\n\n### FACTORES EVALUADOS:\n{factores_block}"

        # Anexar JSON estructurado para mayor precisión del modelo
        prompt += (
            "\n\n### DATOS ESTRUCTURADOS DE ENTRADA (JSON):\n"
            f"{json.dumps(input_json_data, ensure_ascii=False, indent=2)}\n\n"
            "Recuerda: Devuelve ÚNICAMENTE un objeto JSON con exactamente las claves 'interpretacion' y 'analisis_factores'."
        )

        # 5. Ejecutar llamada a Groq con estrategia de reintento/fallback
        models_to_try = self._get_available_models()
        parsed_response: Optional[Dict[str, Any]] = None
        model_used: Optional[str] = None
        last_error: str = ""

        for model_name in models_to_try:
            try:
                logger.info("Solicitando análisis de recomendación IA con Groq: %s", model_name)
                payload = {
                    "model": model_name,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "Eres un especialista senior en evaluación de adopción de software conforme a la metodología GUIOS. "
                                "Analiza los resultados con rigor técnico, respetando las extensiones requeridas: "
                                "máximo 80 palabras para la interpretación y máximo 120 palabras para el análisis de factores. "
                                "Responde estrictamente con un JSON válido con las claves 'interpretacion' y 'analisis_factores'."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                }

                resp = requests.post(
                    f"{self.api_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=35,
                )

                if resp.status_code == 200:
                    data = resp.json()
                    content = (
                        data.get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                        .strip()
                    )
                    parsed = json.loads(content)
                    if "interpretacion" in parsed and "analisis_factores" in parsed:
                        parsed_response = parsed
                        model_used = model_name
                        break
                else:
                    err_msg = resp.text[:200]
                    last_error = f"{model_name}: HTTP {resp.status_code} - {err_msg}"
                    logger.warning("Modelo %s falló: %s", model_name, err_msg)
                    continue
            except Exception as ex:
                last_error = f"{model_name}: {str(ex)}"
                logger.warning("Error invocando %s: %s", model_name, ex)
                continue

        if not parsed_response or not model_used:
            raise ValidationError(
                f"No fue posible generar el análisis con la IA de Groq. Detalle: {last_error}"
            )

        interpretacion = str(parsed_response.get("interpretacion", "")).strip()
        analisis_factores = str(parsed_response.get("analisis_factores", "")).strip()

        # 6. Guardar en la base de datos
        analisis = AnalisisIARecomendacion.objects.create(
            evaluacion=evaluation,
            interpretacion=interpretacion,
            analisis_factores=analisis_factores,
            modelo_ia=model_used,
        )

        return analisis
