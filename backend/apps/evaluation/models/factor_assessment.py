from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.evaluation.models.evaluation import Evaluation
from apps.methodology.models.scale import ScaleLevel
from apps.methodology.models.factor import Factor
from apps.methodology.models.scope import Scope

class FactorAssessment(models.Model):
    decision_maker_importance = models.ForeignKey(ScaleLevel, on_delete=models.CASCADE, verbose_name=_("Importancia del decisor"), related_name="decision_maker_factor_assessments")
    relative_importance = models.ForeignKey(ScaleLevel, on_delete=models.CASCADE, verbose_name=_("Importancia relativa"), related_name="relative_factor_assessments")
    factor = models.ForeignKey(Factor, on_delete=models.CASCADE, verbose_name=_("Factor"), related_name="factor_assessments")
    evaluation = models.ForeignKey(Evaluation, on_delete=models.CASCADE, verbose_name=_("Evaluación"), related_name="evaluation_factor_assessments")    
    scope = models.ForeignKey(Scope, on_delete=models.CASCADE, verbose_name=_("Alcance"), related_name="scope_factor_assessments")

    def __str__(self):
        return f"{self.evaluation.name} - {self.factor.name}"

    class Meta:
        verbose_name = _("Evaluación de factores")
        indexes = [
            models.Index(fields=["evaluation","factor"], name="idx_factass_eval_factor")
        ]
        constraints = [
            models.UniqueConstraint(fields=["evaluation","factor"], name="uq_factor_assessment_evaluation_factor")
        ]

