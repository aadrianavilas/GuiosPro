from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction

from apps.methodology.models.dimension import Dimension
from apps.methodology.models.factor import Factor
from apps.methodology.api.serializers.dimension import (
    DimensionSerializer,
    DimensionTreeSerializer,
)
from apps.auth.components.permissions.permissions import HasModulePermission
from apps.auth.components.permissions.constant import PERMISSIONS
from apps.methodology.services.factor_calculator import recalculate_factors_importance


class DimensionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la administración de dimensiones metodológicas en GuiosPro.
    Permite listar, crear, editar, reordenar por arrastre y consultar la estructura
    completa en árbol (Dimensiones -> Factores -> Subfactores).
    """
    queryset = Dimension.objects.all().order_by("order", "id")
    serializer_class = DimensionSerializer
    permission_classes = [HasModulePermission]
    required_permissions = {
        "list": [PERMISSIONS["DIMENSION_VIEW"], PERMISSIONS["DIMENSION_CHANGE"]],
        "retrieve": [PERMISSIONS["DIMENSION_VIEW"], PERMISSIONS["DIMENSION_CHANGE"]],
        "tree": [PERMISSIONS["DIMENSION_VIEW"], PERMISSIONS["DIMENSION_CHANGE"]],
        "create": PERMISSIONS["DIMENSION_ADD"],
        "update": PERMISSIONS["DIMENSION_CHANGE"],
        "partial_update": PERMISSIONS["DIMENSION_CHANGE"],
        "destroy": PERMISSIONS["DIMENSION_DELETE"],
        "reorder": PERMISSIONS["DIMENSION_CHANGE"],
    }

    def perform_create(self, serializer):
        if "order" not in serializer.validated_data or not serializer.validated_data["order"]:
            max_order = Dimension.objects.count()
            serializer.save(order=max_order + 1)
        else:
            serializer.save()

    def perform_destroy(self, instance):
        instance.delete()
        recalculate_factors_importance()

    @action(detail=False, methods=["get"], url_path="tree")
    def tree(self, request):
        """
        Retorna la estructura jerárquica unificada completa:
        Dimensiones -> Factores (con citas, IE, subfactores e IL/IS calculadas) -> Subfactores.
        """
        # Sincronización automática de seguridad si existen factores con subfactores pendientes
        if Factor.objects.filter(literature_importance__isnull=True, subfactors__isnull=False).exists():
            recalculate_factors_importance()

        dimensions = Dimension.objects.prefetch_related(
            "factors__subfactors",
            "factors__literature_importance",
            "factors__suggested_importance",
        ).all().order_by("order", "id")

        serializer = DimensionTreeSerializer(dimensions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post", "patch"], url_path="reorder")
    def reorder(self, request):
        """
        Actualiza el orden de aparición de las dimensiones por arrastre (drag-and-drop).
        Acepta una lista de objetos: [{'id': 1, 'order': 1}, ...] o lista de IDs.
        """
        payload = request.data
        if not isinstance(payload, list):
            return Response(
                {"detail": "El formato esperado es una lista de objetos con id y orden."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for index, item in enumerate(payload):
                if isinstance(item, dict) and "id" in item:
                    dim_id = item.get("id")
                    order_val = item.get("order", index + 1)
                elif isinstance(item, int):
                    dim_id = item
                    order_val = index + 1
                else:
                    continue

                Dimension.objects.filter(id=dim_id).update(order=order_val)

        return Response(
            {"detail": "Orden de dimensiones actualizado exitosamente."},
            status=status.HTTP_200_OK,
        )
