from rest_framework import serializers
from django.db import transaction

from apps.methodology.models.scale import Scale, ScaleLevel


class ScaleLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScaleLevel
        fields = ["id", "scale", "value", "label", "order"]
        extra_kwargs = {
            "scale": {"required": False},
            "value": {"required": False},
            "order": {"required": False},
        }

    def validate_label(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("La etiqueta del nivel no puede estar vacía.")
        return cleaned

    def validate(self, attrs):
        scale = attrs.get("scale") or (self.instance.scale if self.instance else None)
        label = attrs.get("label", "").strip() if "label" in attrs else None
        if scale and label:
            qs = ScaleLevel.objects.filter(scale=scale, label__iexact=label)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError(
                    {"label": f"Ya existe el nivel '{label}' en esta escala."}
                )
        return attrs


class ScaleLevelInlineSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False, allow_null=True)
    label = serializers.CharField(max_length=100)
    value = serializers.IntegerField(required=False)
    order = serializers.IntegerField(required=False)


class ScaleSerializer(serializers.ModelSerializer):
    scale_levels = ScaleLevelSerializer(many=True, read_only=True)
    levels = ScaleLevelInlineSerializer(many=True, write_only=True, required=False)
    levels_count = serializers.SerializerMethodField()

    class Meta:
        model = Scale
        fields = ["id", "name", "description", "scale_levels", "levels", "levels_count"]

    def get_levels_count(self, obj):
        return obj.scale_levels.count()

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("El nombre de la escala es obligatorio.")
        instance = getattr(self, "instance", None)
        qs = Scale.objects.filter(name__iexact=cleaned)
        if instance:
            qs = qs.exclude(id=instance.id)
        if qs.exists():
            raise serializers.ValidationError("Ya existe una escala con este nombre.")
        return cleaned

    def validate(self, attrs):
        # Al crear una nueva escala, se exige un mínimo de 2 niveles
        if not self.instance:
            levels = attrs.get("levels")
            if not levels or len(levels) < 2:
                raise serializers.ValidationError(
                    {"levels": "Debe agregar al menos 2 niveles de escala al crear una escala."}
                )
        return attrs

    def create(self, validated_data):
        levels_data = validated_data.pop("levels", [])
        with transaction.atomic():
            scale = Scale.objects.create(**validated_data)
            for index, item in enumerate(levels_data):
                label = item.get("label", "").strip()
                if not label:
                    continue
                seq = index + 1
                ScaleLevel.objects.create(
                    scale=scale,
                    label=label,
                    value=seq,
                    order=seq,
                )
        return scale

    def update(self, instance, validated_data):
        levels_data = validated_data.pop("levels", None)
        with transaction.atomic():
            instance.name = validated_data.get("name", instance.name)
            instance.description = validated_data.get("description", instance.description)
            instance.save()

            if levels_data is not None:
                if len(levels_data) < 2:
                    raise serializers.ValidationError(
                        {"levels": "Una escala debe tener al menos 2 niveles de medición."}
                    )
                seen_ids = set()
                for index, item in enumerate(levels_data):
                    seq = index + 1
                    lvl_id = item.get("id")
                    label = item.get("label", "").strip()
                    if not label:
                        continue
                    if lvl_id:
                        lvl = ScaleLevel.objects.filter(id=lvl_id, scale=instance).first()
                        if lvl:
                            lvl.label = label
                            lvl.value = seq
                            lvl.order = seq
                            lvl.save(update_fields=["label", "value", "order"])
                            seen_ids.add(lvl.id)
                            continue
                    new_lvl = ScaleLevel.objects.create(
                        scale=instance,
                        label=label,
                        value=seq,
                        order=seq,
                    )
                    seen_ids.add(new_lvl.id)

                instance.scale_levels.exclude(id__in=seen_ids).delete()

        return instance


class ScaleLevelEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScaleLevel
        fields = ["id", "value", "label", "order"]
