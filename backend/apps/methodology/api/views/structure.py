from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.core.management import call_command
import logging

logger = logging.getLogger(__name__)

from apps.methodology.models import (
    Dimension,
    Factor,
    Subfactor,
    Scale,
    ScaleLevel,
    Scope,
    Recommendation,
)


class EvaluationStructureView(APIView):
    """
    Retorna la estructura jerárquica completa y oficial de la metodología GUIOS
    consultada directamente desde la base de datos:
    - Dimensiones -> Factores (con IS/IL/citas) -> Subfactores
    - Escalas y niveles para Factores y Subfactores
    - Alcances (Interno, Externo)
    - Recomendaciones oficiales (A, B, C)
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        # Auto-seed de rescate si la base de datos está vacía
        if not Dimension.objects.exists() or not Factor.objects.exists():
            try:
                call_command("seed_methodology_data")
            except Exception as e:
                logger.error(f"Error auto-seeding methodology data: {e}")

        # 1. Dimensiones con factores y subfactores precalculados desde BD
        dimensions = Dimension.objects.all().order_by("order")
        factors = (
            Factor.objects.all()
            .select_related("dimension", "suggested_importance", "literature_importance")
            .prefetch_related("subfactors")
            .order_by("order")
        )

        factors_by_dimension = {}
        for f in factors:
            subfactors_data = [
                {
                    "id": sub.id,
                    "name": sub.name,
                    "description": sub.description,
                    "order": sub.order,
                }
                for sub in f.subfactors.all().order_by("order")
            ]

            factor_data = {
                "id": f.id,
                "name": f.name,
                "description": f.description,
                "dimension_id": f.dimension_id,
                "order": f.order,
                "total_citations": f.total_citations,
                "expert_importance": f.expert_importance,
                "suggested_importance": {
                    "id": f.suggested_importance.id if f.suggested_importance else None,
                    "value": f.suggested_importance.value if f.suggested_importance else 3,
                    "label": f.suggested_importance.label if f.suggested_importance else "Importante",
                } if f.suggested_importance else {
                    "id": None,
                    "value": 3,
                    "label": "Importante",
                },
                "literature_importance": {
                    "id": f.literature_importance.id if f.literature_importance else None,
                    "value": f.literature_importance.value if f.literature_importance else None,
                    "label": f.literature_importance.label if f.literature_importance else None,
                } if f.literature_importance else None,
                "subfactors": subfactors_data,
                "subfactors_count": len(subfactors_data),
            }
            factors_by_dimension.setdefault(f.dimension_id, []).append(factor_data)

        dimensions_data = []
        for d in dimensions:
            dim_factors = factors_by_dimension.get(d.id, [])
            dimensions_data.append({
                "id": d.id,
                "name": d.name,
                "description": d.description,
                "order": d.order,
                "factors_count": len(dim_factors),
                "factors": dim_factors,
            })

        # 2. Escalas de Factor y Subfactor
        scale_factor = Scale.objects.filter(name__in=["Factor", "Importancia"]).first()
        scale_factor_levels = (
            ScaleLevel.objects.filter(scale=scale_factor).order_by("value")
            if scale_factor
            else []
        )

        scale_subfactor = Scale.objects.filter(name__in=["Subfactor", "Valoración de subfactor"]).first()
        scale_subfactor_levels = (
            ScaleLevel.objects.filter(scale=scale_subfactor).order_by("value")
            if scale_subfactor
            else []
        )

        # 3. Alcances
        scopes = Scope.objects.all().order_by("name")

        # 4. Recomendaciones
        recommendations = Recommendation.objects.all().order_by("order")

        payload = {
            "dimensions": dimensions_data,
            "scales": {
                "factor": [
                    {
                        "id": lvl.id,
                        "value": lvl.value,
                        "label": lvl.label,
                        "order": lvl.order,
                    }
                    for lvl in scale_factor_levels
                ],
                "subfactor": [
                    {
                        "id": lvl.id,
                        "value": lvl.value,
                        "label": lvl.label,
                        "order": lvl.order,
                    }
                    for lvl in scale_subfactor_levels
                ],
            },
            "scopes": [
                {
                    "id": sc.id,
                    "name": sc.name,
                }
                for sc in scopes
            ],
            "recommendations": [
                {
                    "id": rec.id,
                    "code": rec.code,
                    "title": rec.title,
                    "description": rec.description,
                    "order": rec.order,
                }
                for rec in recommendations
            ],
        }

        return Response(payload, status=status.HTTP_200_OK)
