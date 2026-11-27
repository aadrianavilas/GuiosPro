from rest_framework import serializers

from apps.methodology.models.factor import Factor
from apps.methodology.api.serializers.subfactor import SubfactorSerializer

EXPERT_IMPORTANCE_LABELS = {
    1: "Irrelevante",
    2: "Opcional",
    3: "Importante",
    4: "Fundamental",
}


class FactorWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Factor
        fields = [
            "id",
            "name",
            "description",
            "dimension",
            "total_citations",
            "expert_importance",
            "suggested_importance",
            "literature_importance",
            "order",
        ]
        extra_kwargs = {
            "suggested_importance": {"read_only": True},
            "literature_importance": {"read_only": True},
            "order": {"required": False},
        }

    def validate_name(self, value):
        instance = getattr(self, "instance", None)
        qs = Factor.objects.filter(name__iexact=value.strip())
        if instance:
            qs = qs.exclude(id=instance.id)
        if qs.exists():
            raise serializers.ValidationError("Ya existe un factor con este nombre.")
        return value.strip()


class FactorTreeSerializer(serializers.ModelSerializer):
    subfactors = serializers.SerializerMethodField()
    total_subfactors = serializers.SerializerMethodField()
    expert_importance_label = serializers.SerializerMethodField()
    literature_importance_info = serializers.SerializerMethodField()
    suggested_importance_info = serializers.SerializerMethodField()

    class Meta:
        model = Factor
        fields = [
            "id",
            "name",
            "description",
            "dimension",
            "order",
            "total_citations",
            "expert_importance",
            "expert_importance_label",
            "total_subfactors",
            "literature_importance",
            "literature_importance_info",
            "suggested_importance",
            "suggested_importance_info",
            "subfactors",
        ]

    def get_subfactors(self, obj):
        subfactors = obj.subfactors.all().order_by("order", "id")
        return SubfactorSerializer(subfactors, many=True).data

    def get_total_subfactors(self, obj):
        return obj.subfactors.count()

    def get_expert_importance_label(self, obj):
        return EXPERT_IMPORTANCE_LABELS.get(obj.expert_importance, "Importante")

    def get_literature_importance_info(self, obj):
        if obj.literature_importance:
            return {
                "id": obj.literature_importance.id,
                "value": obj.literature_importance.value,
                "label": obj.literature_importance.label,
            }
        return None

    def get_suggested_importance_info(self, obj):
        if obj.suggested_importance:
            return {
                "id": obj.suggested_importance.id,
                "value": obj.suggested_importance.value,
                "label": obj.suggested_importance.label,
            }
        return None


class FactorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Factor
        fields = ["id", "name", "dimension", "suggested_importance", "literature_importance", "order"]


class FactorEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Factor
        fields = ["id", "name"]
