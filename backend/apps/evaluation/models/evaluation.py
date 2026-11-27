from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.evaluation.models.organization import Organization
from apps.auth.models.auth.user import User
from apps.evaluation.models.software import Software
from apps.methodology.models.factor import Factor
from apps.methodology.models.recommendation import Recommendation
from apps.core.models import BaseModel

class Evaluation(BaseModel):
    class State(models.TextChoices):
        PENDIENTE = "PEN", _("Pendiente")
        EN_PROGRESO = "ENP", _("En Progreso")
        COMPLETADA = "COM", _("Completada")

    name = models.CharField(verbose_name=_("Nombre"), max_length=100)
    start_date = models.DateField(verbose_name=_("Fecha de inicio"), auto_now_add=True)
    end_date = models.DateField(verbose_name=_("Fecha de fin"), null=True, blank=True)
    state = models.CharField(max_length=3, choices=State.choices, default=State.PENDIENTE)
    recommendation = models.ForeignKey(
        Recommendation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("Recomendación metodológica"),
        related_name="evaluations",
    )
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, verbose_name=_("Organización"), related_name="organization_evaluations")
    evaluator = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name=_("Dueño de la evaluación"), related_name="evaluator_evaluations")
    software = models.ForeignKey(Software, on_delete=models.CASCADE, verbose_name=_("Software"), related_name="software_evaluations")

    @property
    def recommendation_category(self):
        return self.recommendation.code if self.recommendation else None

    @property
    def recommendation_text(self):
        return self.recommendation.description if self.recommendation else ""

    def __str__(self):
        return f"{self.name} - {self.start_date} a {self.end_date}"

    class Meta:
        verbose_name = _("Evaluación")
        verbose_name_plural = _("Evaluaciones")

        indexes = [
            models.Index(fields=["start_date"],name="idx_evaluation_start_date"),
            models.Index(fields=["software"],name="idx_evaluation_software"),
            models.Index(fields=["name", "evaluator"],name="idx_evaluation_name_evaluator"),
            models.Index(fields=["name","software"],name="idx_evaluation_name_software")
        ]

        constraints = [
            models.UniqueConstraint(fields=["name","evaluator"], name="uq_name_evaluator"),
            #models.UniqueConstraint(fields=["name","software"], name="unique_name_software"),
        ]
    
    

class EvaluationResult(models.Model):
    class FODA(models.TextChoices):
        DEBILIDAD = "D", _("Debilidad")
        AMENAZA = "A", _("Amenaza")
        FORTALEZA = "F", _("Fortaleza")
        OPORTUNIDAD = "O", _("Oportunidad")

    average_weighting = models.FloatField(verbose_name=_("Peso promedio"))
    swot_classification = models.CharField(verbose_name=_("Clasificación FODA"), max_length=1, choices=FODA.choices)
    evaluation = models.ForeignKey(Evaluation, on_delete=models.CASCADE, verbose_name=_("Evaluación"), related_name="evaluation_results")
    factor = models.ForeignKey(Factor, on_delete=models.CASCADE, verbose_name=_("Factor"), related_name="factor_results")

    def __str__(self):
        return f"{self.swot_classification} - {self.average_weighting}"

    class Meta:
        verbose_name = _("Resultado de la evaluación")
        verbose_name_plural = _("Resultados de las evaluaciones")
        ordering = ["-average_weighting"]

        indexes = [
            models.Index(fields=["evaluation","factor"], name="idx_evalres_eval_factor")
        ]

        constraints = [
            models.UniqueConstraint(fields=["evaluation","factor"],name="uq_evaluation_result_evaluation_factor"),
            models.CheckConstraint(condition=models.Q(average_weighting__gte=0), name="ck_evaluation_result_average_weighting")
        ]


