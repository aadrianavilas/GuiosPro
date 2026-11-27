from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated
from apps.methodology.models.recommendation import Recommendation
from apps.methodology.api.serializers.recommendation import RecommendationSerializer


class RecommendationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    ViewSet para consultar y editar las recomendaciones oficiales de la metodología GUIOS (A, B, C).
    No permite crear ni eliminar registros para preservar la coherencia matemática del algoritmo decisorio.
    """
    queryset = Recommendation.objects.all().order_by("order")
    serializer_class = RecommendationSerializer
    permission_classes = [IsAuthenticated]
