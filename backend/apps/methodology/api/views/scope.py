from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated
from apps.methodology.models.scope import Scope
from apps.methodology.api.serializers.scope import ScopeSerializer


class ScopeViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    ViewSet para la consulta y edición de los alcances metodológicos (Interno y Externo).
    No permite la creación ni eliminación de registros para preservar la estructura fija de la matriz FODA.
    """
    serializer_class = ScopeSerializer
    queryset = Scope.objects.all().order_by("name")
    permission_classes = [IsAuthenticated]
