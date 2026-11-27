from rest_framework import serializers

from apps.methodology.models.dimension import Dimension
from apps.methodology.api.serializers.factor import FactorTreeSerializer


class DimensionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dimension
        fields = ["id", "name", "description", "order"]
        extra_kwargs = {
            "order": {"required": False},
        }

    def validate_name(self, value):
        instance = getattr(self, "instance", None)
        qs = Dimension.objects.filter(name__iexact=value.strip())
        if instance:
            qs = qs.exclude(id=instance.id)
        if qs.exists():
            raise serializers.ValidationError("Ya existe una dimensión con este nombre.")
        return value.strip()


class DimensionTreeSerializer(serializers.ModelSerializer):
    factors = serializers.SerializerMethodField()
    factors_count = serializers.SerializerMethodField()
    subfactors_count = serializers.SerializerMethodField()

    class Meta:
        model = Dimension
        fields = [
            "id",
            "name",
            "description",
            "order",
            "factors_count",
            "subfactors_count",
            "factors",
        ]

    def get_factors(self, obj):
        factors = obj.factors.all().select_related(
            "literature_importance", "suggested_importance"
        ).prefetch_related("subfactors").order_by("order", "id")
        return FactorTreeSerializer(factors, many=True).data

    def get_factors_count(self, obj):
        return obj.factors.count()

    def get_subfactors_count(self, obj):
        count = 0
        for f in obj.factors.all():
            count += f.subfactors.count()
        return count
