from rest_framework import serializers

from apps.evaluation.models.organization import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    """Serializer de solo lectura para anidar organización en otros recursos."""

    organization_type_display = serializers.CharField(
        source="get_organization_type_display",
        read_only=True,
    )

    class Meta:
        model = Organization
        fields = [
            "id",
            "business_name",
            "commercial_name",
            "organization_type",
            "organization_type_display",
            "sector",
            "address",
            "city",
            "country",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "organization_type_display"]


class OrganizationCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para registrar la organización del decisor por primera vez.
    Valida que el usuario autenticado no tenga ya una organización vinculada.
    """

    class Meta:
        model = Organization
        fields = [
            "business_name",
            "commercial_name",
            "organization_type",
            "sector",
            "address",
            "city",
            "country",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        if request and request.user.organization is not None:
            raise serializers.ValidationError(
                "Ya tienes una organización registrada. "
                "Puedes editarla desde el módulo de Organización."
            )
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        organization = Organization.objects.create(user=user, **validated_data)
        # Vincular al usuario autenticado
        if user:
            user.organization = organization
            user.save(update_fields=["organization"])
        return organization


class OrganizationUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer para actualizar la organización del decisor.
    Se usa en el módulo de Organización (edición posterior).
    """

    class Meta:
        model = Organization
        fields = [
            "business_name",
            "commercial_name",
            "organization_type",
            "sector",
            "address",
            "city",
            "country",
        ]

    def validate_business_name(self, value):
        # Validar unicidad compuesta: razón social + usuario
        instance = self.instance
        request = self.context.get("request")
        user = instance.user if instance and instance.user else (request.user if request and request.user.is_authenticated else None)
        qs = Organization.objects.filter(business_name=value)
        if user:
            qs = qs.filter(user=user)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "Ya tienes una organización registrada con esa razón social."
            )
        return value
