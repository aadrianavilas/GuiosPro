from rest_framework import serializers

from apps.methodology.models.subfactor import Subfactor


class SubfactorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subfactor
        fields = ["id", "name", "description", "factor", "order"]
        extra_kwargs = {
            "order": {"required": False},
            "factor": {"required": False},
        }

    def validate(self, attrs):
        if not self.instance and "factor" not in attrs:
            raise serializers.ValidationError({"factor": "El factor es requerido para registrar un subfactor."})
        return attrs

    def validate_name(self, value):
        instance = getattr(self, "instance", None)
        cleaned = value.strip()
        qs = Subfactor.objects.filter(name__iexact=cleaned)
        if instance:
            qs = qs.exclude(id=instance.id)
        if qs.exists():
            raise serializers.ValidationError("Ya existe un subfactor con este nombre.")
        return cleaned


class SubfactorEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subfactor
        fields = ["id", "name", "order"]
