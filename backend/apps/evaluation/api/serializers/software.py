from rest_framework import serializers

from apps.evaluation.models.software import Software


class SoftwareSerializer(serializers.ModelSerializer):
    class Meta:
        model = Software
        fields = '__all__'    