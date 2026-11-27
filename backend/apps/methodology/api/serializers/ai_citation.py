from rest_framework import serializers
from apps.methodology.models.scientific_database import ScientificDatabase
from apps.methodology.models.ai_query import (
    AiCitationQuery,
    AiCitationQueryFactor,
    AiCitationQueryDatabase,
)


class ScientificDatabaseSerializer(serializers.ModelSerializer):
    """
    Serializador para las bases de datos científicas disponibles.
    """
    class Meta:
        model = ScientificDatabase
        fields = ["id", "name", "description", "is_active"]


class AiCitationQueryRequestSerializer(serializers.Serializer):
    """
    Validador de entrada para la solicitud de búsqueda de citas con IA.
    """
    start_period = serializers.DateField(
        required=True,
        error_messages={"required": "Debe especificar la fecha de inicio del periodo."},
    )
    end_period = serializers.DateField(
        required=True,
        error_messages={"required": "Debe especificar la fecha de fin del periodo."},
    )
    database_names = serializers.ListField(
        child=serializers.CharField(max_length=150),
        allow_empty=False,
        error_messages={"required": "Debe seleccionar al menos una base de datos científica."},
    )
    factor_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        error_messages={"required": "Debe seleccionar al menos un factor para consultar."},
    )

    def validate(self, attrs):
        start = attrs.get("start_period")
        end = attrs.get("end_period")
        if start and end and start > end:
            raise serializers.ValidationError(
                {"end_period": "La fecha de fin no puede ser anterior a la fecha de inicio."}
            )
        return attrs


class FactorCitationApplyItemSerializer(serializers.Serializer):
    """
    Item individual para aplicar el nuevo valor de citas a un factor.
    """
    factor_id = serializers.IntegerField(min_value=1)
    total_citations = serializers.IntegerField(min_value=0)


class AiCitationApplyRequestSerializer(serializers.Serializer):
    """
    Validador de entrada para aplicar los resultados de la IA a los factores.
    """
    query_id = serializers.IntegerField(required=False, allow_null=True)
    factors = serializers.ListField(
        child=FactorCitationApplyItemSerializer(),
        allow_empty=False,
        error_messages={"required": "Debe enviar al menos un factor con su total de citas a actualizar."},
    )


class AiCitationQueryListSerializer(serializers.ModelSerializer):
    """
    Serializador para el listado general de consultas de citas con IA.
    """
    user_display = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = AiCitationQuery
        fields = [
            "id",
            "query_date",
            "start_period",
            "end_period",
            "total_factors",
            "total_databases",
            "status",
            "status_display",
            "user_display",
        ]

    def get_user_display(self, obj: AiCitationQuery) -> str:
        if not obj.user:
            return "Sistema / Administrador"
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.username or obj.user.email


class AiCitationQueryDatabaseDetailSerializer(serializers.ModelSerializer):
    """
    Serializador para las bases científicas consultadas en una consulta específica.
    """
    query_status_display = serializers.CharField(source="get_query_status_display", read_only=True)

    class Meta:
        model = AiCitationQueryDatabase
        fields = [
            "id",
            "database_name",
            "query_status",
            "query_status_display",
        ]


class AiCitationQueryFactorDetailSerializer(serializers.ModelSerializer):
    """
    Serializador para los factores investigados en una consulta específica.
    """
    dimension_name = serializers.SerializerMethodField()
    factor_exists = serializers.SerializerMethodField()
    current_factor_name = serializers.SerializerMethodField()
    result_status_display = serializers.CharField(source="get_result_status_display", read_only=True)
    bibliographic_references = serializers.JSONField(read_only=True)

    class Meta:
        model = AiCitationQueryFactor
        fields = [
            "id",
            "factor_id",
            "factor_name",
            "current_factor_name",
            "dimension_name",
            "total_citations",
            "result_status",
            "result_status_display",
            "factor_exists",
            "bibliographic_references",
        ]

    def get_dimension_name(self, obj: AiCitationQueryFactor) -> str:
        if obj.factor and obj.factor.dimension:
            return obj.factor.dimension.name
        return ""

    def get_factor_exists(self, obj: AiCitationQueryFactor) -> bool:
        return obj.factor is not None

    def get_current_factor_name(self, obj: AiCitationQueryFactor) -> str:
        if obj.factor:
            return obj.factor.name
        return obj.factor_name


class AiCitationQueryDetailSerializer(serializers.ModelSerializer):
    """
    Serializador detallado de una consulta de IA, incluyendo factores, bases científicas
    y la lista consolidada de referencias bibliográficas.
    """
    user_display = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    database_results = AiCitationQueryDatabaseDetailSerializer(many=True, read_only=True)
    factor_results = AiCitationQueryFactorDetailSerializer(many=True, read_only=True)
    all_bibliographic_references = serializers.SerializerMethodField()

    class Meta:
        model = AiCitationQuery
        fields = [
            "id",
            "query_date",
            "start_period",
            "end_period",
            "total_factors",
            "total_databases",
            "status",
            "status_display",
            "user_display",
            "database_results",
            "factor_results",
            "all_bibliographic_references",
        ]

    def get_all_bibliographic_references(self, obj: AiCitationQuery) -> list:
        all_refs = []
        for f in obj.factor_results.all():
            refs = f.bibliographic_references or []
            for r in refs:
                all_refs.append({
                    **r,
                    "factor_id": f.factor_id,
                    "factor_name": f.factor_name,
                })
        return all_refs

    def get_user_display(self, obj: AiCitationQuery) -> str:
        if not obj.user:
            return "Sistema / Administrador"
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.username or obj.user.email
