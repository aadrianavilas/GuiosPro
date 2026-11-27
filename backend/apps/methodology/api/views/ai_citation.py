import logging
from typing import Any, Dict, List
from django.db.models import Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.methodology.models.scientific_database import ScientificDatabase
from apps.methodology.models.factor import Factor
from apps.methodology.models.ai_query import (
    AiCitationQuery,
    AiCitationQueryFactor,
    AiCitationQueryDatabase,
)
from apps.methodology.api.serializers.ai_citation import (
    ScientificDatabaseSerializer,
    AiCitationQueryRequestSerializer,
    AiCitationApplyRequestSerializer,
    AiCitationQueryListSerializer,
    AiCitationQueryDetailSerializer,
)
from apps.methodology.services.ai_citation_service import AiCitationService
from apps.methodology.services.factor_calculator import recalculate_factors_importance

logger = logging.getLogger(__name__)


class ScientificDatabaseListView(APIView):
    """
    Vista para listar las bases de datos científicas activas del sistema.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args: Any, **kwargs: Any) -> Response:
        databases = ScientificDatabase.objects.filter(is_active=True).order_by("name")
        serializer = ScientificDatabaseSerializer(databases, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AiCitationQueryView(APIView):
    """
    Vista para ejecutar la consulta de citas con IA (Groq).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args: Any, **kwargs: Any) -> Response:
        serializer = AiCitationQueryRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        start_period = validated_data["start_period"]
        end_period = validated_data["end_period"]
        database_names: List[str] = validated_data["database_names"]
        factor_ids: List[int] = validated_data["factor_ids"]

        service = AiCitationService()
        try:
            result = service.query_citations(
                start_period=start_period,
                end_period=end_period,
                database_names=database_names,
                factor_ids=factor_ids,
                user=request.user,
            )
            return Response(result, status=status.HTTP_200_OK)
        except ValueError as ve:
            return Response({"error": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error("Error en consulta de citas con IA: %s", e, exc_info=True)
            return Response(
                {"error": f"Error al consultar la IA: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AiCitationApplyView(APIView):
    """
    Vista para aplicar los totales de citas calculados por la IA a los factores seleccionados.
    Solo modifica los factores consultados y recalcula la importancia metodológica (cuartiles GUIOS).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args: Any, **kwargs: Any) -> Response:
        serializer = AiCitationApplyRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        factors_data = serializer.validated_data["factors"]
        updated_count = 0
        updated_factor_ids: List[int] = []

        for item in factors_data:
            f_id = item["factor_id"]
            citations = item["total_citations"]
            try:
                factor = Factor.objects.get(id=f_id)
                factor.total_citations = citations
                factor.save(update_fields=["total_citations"])
                updated_count += 1
                updated_factor_ids.append(f_id)
            except Factor.DoesNotExist:
                logger.warning("Factor con ID %s no encontrado al aplicar citas.", f_id)
                continue

        # Recalcular automáticamente los cuartiles de literatura (IL) e importancia sugerida (IS)
        try:
            recalculate_factors_importance()
        except Exception as e:
            logger.error("Error recalculando importancia metodológica: %s", e)

        return Response(
            {
                "message": "Totales de citas aplicados correctamente y recalcula la importancia metodológica.",
                "updated_count": updated_count,
                "updated_factor_ids": updated_factor_ids,
            },
            status=status.HTTP_200_OK,
        )


class AiCitationQueryListView(APIView):
    """
    Vista para listar las consultas de citas con IA con soporte para búsqueda y filtros rápidos.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args: Any, **kwargs: Any) -> Response:
        queryset = AiCitationQuery.objects.select_related("user").prefetch_related("factor_results", "database_results").all()

        search = request.query_params.get("search", "").strip()
        status_filter = request.query_params.get("status", "").strip()
        date_from = request.query_params.get("date_from", "").strip()
        date_to = request.query_params.get("date_to", "").strip()
        period_start = request.query_params.get("period_start", "").strip()
        period_end = request.query_params.get("period_end", "").strip()

        if search:
            search_filter = (
                Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(user__email__icontains=search)
                | Q(factor_results__factor_name__icontains=search)
                | Q(database_results__database_name__icontains=search)
            )
            if search.isdigit():
                search_filter |= Q(id=int(search))
            queryset = queryset.filter(search_filter).distinct()

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if date_from:
            queryset = queryset.filter(query_date__date__gte=date_from)

        if date_to:
            queryset = queryset.filter(query_date__date__lte=date_to)

        if period_start:
            queryset = queryset.filter(start_period__gte=period_start)

        if period_end:
            queryset = queryset.filter(end_period__lte=period_end)

        serializer = AiCitationQueryListSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AiCitationQueryDetailView(APIView):
    """
    Vista para ver el detalle completo de una consulta de citas con IA (factores y bases de datos).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int, *args: Any, **kwargs: Any) -> Response:
        try:
            query_obj = (
                AiCitationQuery.objects.select_related("user")
                .prefetch_related(
                    "database_results",
                    "factor_results__factor__dimension",
                )
                .get(pk=pk)
            )
        except AiCitationQuery.DoesNotExist:
            return Response(
                {"error": "La consulta solicitada no fue encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AiCitationQueryDetailSerializer(query_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AiCitationQueryRestorePreviewView(APIView):
    """
    Vista para previsualizar la restauración de una versión histórica de citas.
    Compara los factores históricos contra los factores actuales de la base de datos por ID.
    Identifica factores existentes, cambios de nombre y factores eliminados.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int, *args: Any, **kwargs: Any) -> Response:
        try:
            query_obj = (
                AiCitationQuery.objects.prefetch_related(
                    "factor_results__factor__dimension"
                ).get(pk=pk)
            )
        except AiCitationQuery.DoesNotExist:
            return Response(
                {"error": "La consulta solicitada no fue encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        matching_factors: List[Dict[str, Any]] = []
        deleted_factors: List[Dict[str, Any]] = []

        factor_results = query_obj.factor_results.all()

        for fr in factor_results:
            target_factor: Optional[Factor] = None
            if fr.factor_id:
                target_factor = Factor.objects.select_related("dimension").filter(id=fr.factor_id).first()

            if target_factor:
                # El factor existe actualmente en la base de datos
                current_name = target_factor.name.strip()
                historical_name = fr.factor_name.strip()
                name_changed = current_name.lower() != historical_name.lower()

                matching_factors.append({
                    "factor_id": target_factor.id,
                    "current_name": current_name,
                    "historical_name": historical_name,
                    "name_changed": name_changed,
                    "current_citations": target_factor.total_citations,
                    "citations_to_apply": fr.total_citations,
                    "dimension_name": target_factor.dimension.name if target_factor.dimension else "",
                })
            else:
                # El factor fue eliminado de la metodología
                deleted_factors.append({
                    "factor_id": fr.factor_id,
                    "historical_name": fr.factor_name,
                    "citations_in_query": fr.total_citations,
                })

        can_restore = len(matching_factors) > 0
        empty_reason = (
            "Ninguno de los factores existe actualmente. No se puede restaurar esta versión."
            if not can_restore
            else ""
        )

        return Response(
            {
                "query_id": query_obj.id,
                "query_date": query_obj.query_date,
                "can_restore": can_restore,
                "empty_reason": empty_reason,
                "matching_factors": matching_factors,
                "deleted_factors": deleted_factors,
                "total_matching": len(matching_factors),
                "total_deleted": len(deleted_factors),
            },
            status=status.HTTP_200_OK,
        )


class AiCitationQueryRestoreView(APIView):
    """
    Vista para ejecutar la restauración de valores de citas de una versión histórica.
    Aplica las citas exclusivamente a los factores existentes que coinciden por ID.
    Recalcula la importancia metodológica en tiempo real.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int, *args: Any, **kwargs: Any) -> Response:
        try:
            query_obj = AiCitationQuery.objects.prefetch_related("factor_results").get(pk=pk)
        except AiCitationQuery.DoesNotExist:
            return Response(
                {"error": "La consulta solicitada no fue encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        restored_count = 0
        restored_factor_ids: List[int] = []

        for fr in query_obj.factor_results.all():
            if not fr.factor_id:
                continue
            factor = Factor.objects.filter(id=fr.factor_id).first()
            if factor:
                factor.total_citations = fr.total_citations
                factor.save(update_fields=["total_citations"])
                restored_count += 1
                restored_factor_ids.append(factor.id)

        if restored_count == 0:
            return Response(
                {
                    "error": "Ninguno de los factores existe actualmente. No se puede restaurar esta versión."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Recalcular automáticamente los cuartiles e importancia metodológica GUIOS
        try:
            recalculate_factors_importance()
        except Exception as e:
            logger.error("Error recalculando importancia metodológica al restaurar: %s", e)

        return Response(
            {
                "message": f"Se restauraron {restored_count} factores correctamente y se recalculó la importancia metodológica.",
                "restored_count": restored_count,
                "restored_factor_ids": restored_factor_ids,
            },
            status=status.HTTP_200_OK,
        )
