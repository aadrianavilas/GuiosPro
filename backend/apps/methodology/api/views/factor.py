from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction

from apps.methodology.models.factor import Factor
from apps.methodology.api.serializers.factor import (
    FactorWriteSerializer,
    FactorTreeSerializer,
)
from apps.auth.components.permissions.permissions import HasModulePermission
from apps.auth.components.permissions.constant import PERMISSIONS
from apps.methodology.services.factor_calculator import recalculate_factors_importance


class FactorViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la administración de factores metodológicos en GuiosPro.
    Permite listar, crear, editar, reordenar y calcular automáticamente IL e IS.
    """
    queryset = Factor.objects.all().select_related("dimension", "literature_importance", "suggested_importance").order_by("order", "id")
    serializer_class = FactorWriteSerializer
    permission_classes = [HasModulePermission]
    required_permissions = {
        "list": [PERMISSIONS["FACTOR_VIEW"], PERMISSIONS["FACTOR_CHANGE"], PERMISSIONS["DIMENSION_VIEW"], PERMISSIONS["DIMENSION_CHANGE"]],
        "retrieve": [PERMISSIONS["FACTOR_VIEW"], PERMISSIONS["FACTOR_CHANGE"], PERMISSIONS["DIMENSION_VIEW"], PERMISSIONS["DIMENSION_CHANGE"]],
        "create": [PERMISSIONS["FACTOR_ADD"], PERMISSIONS["DIMENSION_CHANGE"]],
        "update": [PERMISSIONS["FACTOR_CHANGE"], PERMISSIONS["DIMENSION_CHANGE"]],
        "partial_update": [PERMISSIONS["FACTOR_CHANGE"], PERMISSIONS["DIMENSION_CHANGE"]],
        "destroy": [PERMISSIONS["FACTOR_DELETE"], PERMISSIONS["DIMENSION_CHANGE"]],
        "reorder": [PERMISSIONS["FACTOR_CHANGE"], PERMISSIONS["DIMENSION_CHANGE"]],
    }

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return FactorTreeSerializer
        return FactorWriteSerializer

    def perform_create(self, serializer):
        dimension = serializer.validated_data.get("dimension")
        if "order" not in serializer.validated_data or not serializer.validated_data["order"]:
            max_order = Factor.objects.filter(dimension=dimension).count() if dimension else 0
            factor = serializer.save(order=max_order + 1)
        else:
            factor = serializer.save()

        # Recalcular distribución de importancia de literatura y sugerida
        recalculate_factors_importance()

    def perform_update(self, serializer):
        factor = serializer.save()
        recalculate_factors_importance()

    def perform_destroy(self, instance):
        instance.delete()
        recalculate_factors_importance()

    @action(detail=False, methods=["post", "patch"], url_path="reorder")
    def reorder(self, request):
        """
        Actualiza el orden de los factores por arrastre dentro de su dimensión.
        Acepta una lista de objetos: [{'id': 10, 'order': 1}, ...]
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
                    factor_id = item.get("id")
                    order_val = item.get("order", index + 1)
                elif isinstance(item, int):
                    factor_id = item
                    order_val = index + 1
                else:
                    continue

                Factor.objects.filter(id=factor_id).update(order=order_val)

        return Response(
            {"detail": "Orden de factores actualizado exitosamente."},
            status=status.HTTP_200_OK,
        )
