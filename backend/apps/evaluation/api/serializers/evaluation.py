from rest_framework import serializers

from apps.evaluation.api.serializers.subfactor_assessment import SubfactorEvaluationAssessmentSerializer
from apps.evaluation.api.serializers.factor_assessment import FactorEvaluationAssessmentSerializer
from apps.evaluation.api.serializers.organization import OrganizationSerializer
from apps.methodology.api.serializers.factor import FactorEvaluationSerializer
from apps.evaluation.models.evaluation import Evaluation, EvaluationResult
from apps.evaluation.models.organization import Organization
from apps.auth.models.auth.user import User
from apps.evaluation.api.serializers.software import SoftwareSerializer
from apps.auth.api.serializers.auth.user import UserSerializer
from apps.methodology.models.recommendation import Recommendation
from apps.evaluation.models.ai_recommendation_analysis import AnalisisIARecomendacion


class EvaluationSerializer(serializers.ModelSerializer):
    """
    Serializador base para operaciones generales de evaluación.
    """
    class Meta:
        model = Evaluation
        fields = ["id", "name", "state", "start_date", "end_date", "organization", "software", "evaluator"]


class EvaluationCreateSerializer(serializers.ModelSerializer):
    """
    Serializador para registrar la primera parte de la evaluación
    (datos generales de la evaluación)
    """
    evaluator = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    organization = serializers.PrimaryKeyRelatedField(
        queryset=Organization.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Evaluation
        fields = ["id", "name", "evaluator", "organization", "software"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        # 1. Asignar evaluator automáticamente si no viene en el payload
        if not attrs.get("evaluator"):
            if user:
                attrs["evaluator"] = user
            else:
                fallback_user = User.objects.filter(is_active=True).first() or User.objects.first()
                if not fallback_user:
                    fallback_user = User.objects.create_user(
                        email="adrian@guiospro.com",
                        first_name="Adrián",
                        last_name="Decisor",
                        password="Password#2026",
                    )
                attrs["evaluator"] = fallback_user

        # 2. Asignar organization automáticamente si no viene en el payload
        if not attrs.get("organization"):
            if user and user.organization:
                attrs["organization"] = user.organization
            else:
                from apps.evaluation.models.organization import Organization
                org = Organization.objects.first()
                if not org:
                    org = Organization.objects.create(
                        business_name="Comercial Andina Cía. Ltda.",
                        commercial_name="TecnoEmpresa",
                        organization_type="private",
                        sector="Tecnología",
                        city="Guayaquil",
                        country="Ecuador",
                    )
                attrs["organization"] = org
                if user and not user.organization:
                    user.organization = org
                    user.save(update_fields=["organization"])

        return attrs
    
        
class EvaluationResultSerializer(serializers.ModelSerializer):
    """
    Serializador para mostrar los resultados de la evaluación en estado 
    completado o en progreso
    """
    factor = FactorEvaluationSerializer(read_only=True)
    
    class Meta:
        model = EvaluationResult
        fields = ["id", "average_weighting", "swot_classification", "factor"]


class EvaluationDetailSerializer(serializers.ModelSerializer):
    """
    Serializador principal que agrupa en un solo json el contenido de la 
    evaluación
    """
    organization = OrganizationSerializer(read_only=True)
    software = SoftwareSerializer(read_only=True) 
    evaluator = UserSerializer(read_only=True)
    results = EvaluationResultSerializer(source="evaluation_results", many=True, read_only=True)
    factor_assessment = FactorEvaluationAssessmentSerializer(source="evaluation_factor_assessments", many=True, read_only=True)
    subfactor_assessment = SubfactorEvaluationAssessmentSerializer(source="evaluation_subfactor_assessments", many=True, read_only=True)
    step_number = serializers.SerializerMethodField()
    step_slug = serializers.SerializerMethodField()
    step_name = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()
    recommendation_category = serializers.SerializerMethodField()
    recommendation_title = serializers.SerializerMethodField()
    recommendation_text = serializers.SerializerMethodField()

    def get_step_number(self, obj):
        if obj.evaluation_results.exists():
            return 4
        if obj.evaluation_subfactor_assessments.exists():
            return 3
        if obj.software_id or obj.evaluation_factor_assessments.exists():
            return 2
        return 1

    def get_step_slug(self, obj):
        sn = self.get_step_number(obj)
        mapping = {1: "software", 2: "factores", 3: "subfactores", 4: "resultados"}
        return mapping.get(sn, "factores")

    def get_step_name(self, obj):
        sn = self.get_step_number(obj)
        mapping = {1: "Software libre", 2: "Factores", 3: "Subfactores", 4: "Resultados"}
        return mapping.get(sn, "Factores")

    def get_progress_percentage(self, obj):
        if obj.state == Evaluation.State.COMPLETADA:
            return 100
        sn = self.get_step_number(obj)
        mapping = {1: 25, 2: 50, 3: 75, 4: 100}
        return mapping.get(sn, 25)

    def get_recommendation_category(self, obj):
        if obj.recommendation:
            return obj.recommendation.code
        return None

    def get_recommendation_title(self, obj):
        if obj.recommendation and obj.recommendation.title:
            return obj.recommendation.title
        cat = obj.recommendation_category
        if not cat:
            return "Sin recomendación"
        mapping = {
            "A": "Adoptar",
            "B": "Es posible adoptar",
            "C": "No se debe adoptar",
        }
        return mapping.get(cat, cat or "Sin recomendación")

    def get_recommendation_text(self, obj):
        if obj.recommendation and obj.recommendation.description:
            return obj.recommendation.description
        return ""

    class Meta: 
        model = Evaluation
        fields = [
            "id", "name", "state", "start_date", "end_date", "created_at", "updated_at",
            "recommendation", "recommendation_category", "recommendation_text", "recommendation_title",
            "organization", "software", "evaluator",
            "results", "factor_assessment", "subfactor_assessment",
            "step_number", "step_slug", "step_name", "progress_percentage"
        ]


class AnalisisIARecomendacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalisisIARecomendacion
        fields = [
            "id",
            "evaluacion",
            "interpretacion",
            "analisis_factores",
            "modelo_ia",
            "fecha_creacion",
        ]
        read_only_fields = ["id", "fecha_creacion"]
