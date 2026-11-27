from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction

from apps.methodology.models.scale import Scale, ScaleLevel
from apps.methodology.api.serializers.scale import (
    ScaleSerializer,
    ScaleLevelSerializer,
)
from apps.auth.components.permissions.permissions import HasModulePermission
from apps.auth.components.permissions.constant import PERMISSIONS
from apps.methodology.services.factor_calculator import recalculate_factors_importance


PROTECTED_SCALES = {"factor", "subfactor", "importancia", "valoración de subfactor"}


class ScaleViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la administración de escalas metodológicas en GuiosPro.
    Permite listar, crear escalas con niveles iniciales, editar, eliminar y reordenar niveles.
    """
    serializer_class = ScaleSerializer
    queryset = Scale.objects.prefetch_related("scale_levels").all().order_by("id")
    permission_classes = [HasModulePermission]
    required_permissions = {
        "list": [PERMISSIONS["SCALE_VIEW"], PERMISSIONS["SCALE_CHANGE"]],
        "retrieve": [PERMISSIONS["SCALE_VIEW"], PERMISSIONS["SCALE_CHANGE"]],
        "create": PERMISSIONS["SCALE_ADD"],
        "update": PERMISSIONS["SCALE_CHANGE"],
        "partial_update": PERMISSIONS["SCALE_CHANGE"],
        "destroy": PERMISSIONS["SCALE_DELETE"],
        "reorder_levels": PERMISSIONS["SCALE_CHANGE"],
    }

    def create(self, request, *args, **kwargs):
        return Response(
            {"detail": "Las escalas de medición metodológicas GUIOS son fijas y no se permite crear nuevas."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Las escalas de medición metodológicas GUIOS son fijas y no pueden ser eliminadas."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=True, methods=["post", "patch"], url_path="reorder-levels")
    def reorder_levels(self, request, pk=None):
        """
        Reordena por arrastre los niveles de la escala seleccionada.
        Actualiza simultáneamente el orden y el valor numérico (1, 2, 3...) de cada nivel.
        """
        scale = self.get_object()
        payload = request.data
        if not isinstance(payload, list):
            return Response(
                {"detail": "Se esperaba una lista de identificadores o niveles con nuevo orden."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for index, item in enumerate(payload):
                lvl_id = item.get("id") if isinstance(item, dict) else item
                seq = index + 1
                ScaleLevel.objects.filter(id=lvl_id, scale=scale).update(
                    order=seq,
                    value=seq
                )

        recalculate_factors_importance()
        scale.refresh_from_db()
        return Response(
            ScaleSerializer(scale).data,
            status=status.HTTP_200_OK,
        )


class ScaleLevelViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión granular de niveles de escala individuales.
    """
    serializer_class = ScaleLevelSerializer
    queryset = ScaleLevel.objects.select_related("scale").all().order_by("order", "id")
    permission_classes = [HasModulePermission]
    required_permissions = {
        "list": [PERMISSIONS["SCALE_VIEW"], PERMISSIONS["SCALE_CHANGE"]],
        "retrieve": [PERMISSIONS["SCALE_VIEW"], PERMISSIONS["SCALE_CHANGE"]],
        "create": [PERMISSIONS["SCALE_ADD"], PERMISSIONS["SCALE_CHANGE"]],
        "update": PERMISSIONS["SCALE_CHANGE"],
        "partial_update": PERMISSIONS["SCALE_CHANGE"],
        "destroy": [PERMISSIONS["SCALE_DELETE"], PERMISSIONS["SCALE_CHANGE"]],
        "reorder": PERMISSIONS["SCALE_CHANGE"],
    }

    def create(self, request, *args, **kwargs):
        return Response(
            {"detail": "Los niveles de escala de medición GUIOS son fijos (1 al 4) y no se permite agregar nuevos."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def perform_update(self, serializer):
        serializer.save()
        recalculate_factors_importance()

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Los niveles de escala de medición GUIOS son fijos y no pueden ser eliminados."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=False, methods=["post", "patch"], url_path="reorder")
    def reorder(self, request):
        payload = request.data
        if not isinstance(payload, list):
            return Response(
                {"detail": "Formato inválido. Se espera una lista de niveles."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for index, item in enumerate(payload):
                lvl_id = item.get("id") if isinstance(item, dict) else item
                seq = index + 1
                ScaleLevel.objects.filter(id=lvl_id).update(order=seq, value=seq)

        recalculate_factors_importance()
        return Response(
            {"detail": "Niveles reordenados correctamente."},
            status=status.HTTP_200_OK,
        )
