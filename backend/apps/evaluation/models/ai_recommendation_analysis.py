from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.evaluation.models.evaluation import Evaluation


class AnalisisIARecomendacion(models.Model):
    evaluacion = models.ForeignKey(
        Evaluation,
        on_delete=models.CASCADE,
        related_name="analisis_ia",
        verbose_name=_("Evaluación")
    )

    interpretacion = models.TextField(verbose_name=_("Interpretación"))
    analisis_factores = models.TextField(verbose_name=_("Análisis de factores"))

    modelo_ia = models.CharField(max_length=100, verbose_name=_("Modelo de IA"))
    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name=_("Fecha de creación"))

    class Meta:
        verbose_name = _("Análisis de recomendación con IA")
        verbose_name_plural = _("Análisis de recomendaciones con IA")
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"Análisis IA {self.evaluacion_id} - {self.fecha_creacion}"
