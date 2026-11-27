from rest_framework import serializers

from apps.methodology.api.serializers.scale import ScaleLevelEvaluationSerializer
from apps.methodology.api.serializers.subfactor import SubfactorEvaluationSerializer
from apps.evaluation.models.subfactor_assessment import SubfactorAssessment

class SubfactorEvaluationAssessmentSerializer(serializers.ModelSerializer):
    scale_subfactor = ScaleLevelEvaluationSerializer(read_only=True)
    subfactor = SubfactorEvaluationSerializer(read_only=True)

    class Meta:
        model = SubfactorAssessment
        fields = ["id", "scale_subfactor", "subfactor"]


class SubfactorAssessmentWriteSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = SubfactorAssessment
        fields = ["id", "scale_subfactor", "subfactor", "evaluation"]