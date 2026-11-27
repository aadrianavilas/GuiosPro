from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction

from apps.methodology.models.subfactor import Subfactor
from apps.methodology.api.serializers.subfactor import SubfactorSerializer
from apps.auth.components.permissions.permissions import HasModulePermission
from apps.auth.components.permissions.constant import PERMISSIONS
from apps.methodology.services.factor_calculator import recalculate_factors_importance


class SubfactorViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la administración de subfactores técnicos en GuiosPro.
    Permite listar, crear, editar, reordenar y sincroniza el cálculo de importancia de factores.
    """
    queryset = Subfactor.objects.all().select_related("factor").order_by("order", "id")
    serializer_class = SubfactorSerializer
    permission_classes = [HasModulePermission]
    required_permissions = {
        "list": [PERMISSIONS["SUBFACTOR_VIEW"], PERMISSIONS["SUBFACTOR_CHANGE"], PERMISSIONS["DIMENSION_VIEW"], PERMISSIONS["DIMENSION_CHANGE"]],
        "retrieve": [PERMISSIONS["SUBFACTOR_VIEW"], PERMISSIONS["SUBFACTOR_CHANGE"], PERMISSIONS["DIMENSION_VIEW"], PERMISSIONS["DIMENSION_CHANGE"]],
        "create": [PERMISSIONS["SUBFACTOR_ADD"], PERMISSIONS["DIMENSION_CHANGE"]],
        "update": [PERMISSIONS["SUBFACTOR_CHANGE"], PERMISSIONS["DIMENSION_CHANGE"]],
        "partial_update": [PERMISSIONS["SUBFACTOR_CHANGE"], PERMISSIONS["DIMENSION_CHANGE"]],
        "destroy": [PERMISSIONS["SUBFACTOR_DELETE"], PERMISSIONS["DIMENSION_CHANGE"]],
        "reorder": [PERMISSIONS["SUBFACTOR_CHANGE"], PERMISSIONS["DIMENSION_CHANGE"]],
    }

    def perform_create(self, serializer):
        factor = serializer.validated_data.get("factor")
        if "order" not in serializer.validated_data or not serializer.validated_data["order"]:
            max_order = Subfactor.objects.filter(factor=factor).count() if factor else 0
            serializer.save(order=max_order + 1)
        else:
            serializer.save()

        # Recalcular inmediatamente los factores ya que el número de subfactores cambió
        recalculate_factors_importance()

    def perform_update(self, serializer):
        serializer.save()
        recalculate_factors_importance()

    def perform_destroy(self, instance):
        instance.delete()
        recalculate_factors_importance()

    @action(detail=False, methods=["post", "patch"], url_path="reorder")
    def reorder(self, request):
        """
        Actualiza el orden de los subfactores por arrastre dentro de su factor.
        Acepta una lista de objetos: [{'id': 101, 'order': 1}, ...]
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
                    sub_id = item.get("id")
                    order_val = item.get("order", index + 1)
                elif isinstance(item, int):
                    sub_id = item
                    order_val = index + 1
                else:
                    continue

                Subfactor.objects.filter(id=sub_id).update(order=order_val)

        return Response(
            {"detail": "Orden de subfactores actualizado exitosamente."},
            status=status.HTTP_200_OK,
        )
