from rest_framework import serializers

from apps.methodology.api.serializers.scale import ScaleLevelEvaluationSerializer
from apps.methodology.api.serializers.factor import FactorEvaluationSerializer
from apps.methodology.api.serializers.scope import ScopeSerializer
from apps.evaluation.models.factor_assessment import FactorAssessment


class FactorEvaluationAssessmentSerializer(serializers.ModelSerializer):
    decision_maker_importance = ScaleLevelEvaluationSerializer(read_only=True)
    relative_importance = ScaleLevelEvaluationSerializer(read_only=True)
    factor = FactorEvaluationSerializer(read_only=True)
    scope = ScopeSerializer(read_only=True)

    class Meta:
        model = FactorAssessment
        fields = ["id","decision_maker_importance","relative_importance", "factor", "scope"]


class FactorAssessmentWriteSerializer(serializers.ModelSerializer):

    class Meta:
        model = FactorAssessment
        fields = ["id", "decision_maker_importance", "relative_importance","factor","evaluation", "scope"]