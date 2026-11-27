from rest_framework.viewsets import ModelViewSet

from apps.evaluation.models.software import Software
from apps.evaluation.api.serializers.software import SoftwareSerializer


class SoftwareViewSet(ModelViewSet):
    serializer_class = SoftwareSerializer
    queryset = Software.objects.all()
