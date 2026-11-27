from rest_framework import serializers
from apps.methodology.models.recommendation import Recommendation


class RecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recommendation
        fields = ["id", "code", "title", "description", "order"]
