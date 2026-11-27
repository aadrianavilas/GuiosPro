from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.methodology.models.scale import ScaleLevel
from apps.methodology.models.subfactor import Subfactor
from apps.evaluation.models.evaluation import Evaluation


class SubfactorAssessment(models.Model):
    scale_subfactor = models.ForeignKey(ScaleLevel, on_delete=models.CASCADE, verbose_name=_("Escala del subfactor"), related_name="scale_subfactor_assessments")
    subfactor = models.ForeignKey(Subfactor, on_delete=models.CASCADE, verbose_name=_("Subfactor"), related_name="subfactor_assessments")
    evaluation = models.ForeignKey(Evaluation, on_delete=models.CASCADE, verbose_name=_("Evaluación"), related_name="evaluation_subfactor_assessments")    


    def __str__(self):
        return f"{self.evaluation.name} - {self.subfactor.name}"

    class Meta:
        verbose_name = _("Evaluación de subfactores")
        verbose_name_plural = _("Evaluaciones de subfactores")
        indexes = [
            models.Index(fields=["evaluation","subfactor"], name="idx_subass_eval_subfactor")
        ]
        constraints = [
            models.UniqueConstraint(fields=["evaluation","subfactor"], name="uq_subfactor_assessment_evaluation_subfactor")
        ]