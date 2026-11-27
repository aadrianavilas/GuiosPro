from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.conf import settings

from apps.core.models import BaseModel
from apps.methodology.models.factor import Factor
from apps.methodology.models.scientific_database import ScientificDatabase


class AiCitationQuery(BaseModel):
    """
    Almacena la información general de cada búsqueda bibliográfica realizada por la IA.
    """
    class QueryStatus(models.TextChoices):
        COMPLETED = "completed", _("Completada")
        PARTIAL = "partial", _("Parcial")
        FAILED = "failed", _("Fallida")

    query_date = models.DateTimeField(
        default=timezone.now,
        verbose_name=_("Fecha de consulta"),
    )
    start_period = models.DateField(
        verbose_name=_("Periodo de inicio"),
    )
    end_period = models.DateField(
        verbose_name=_("Periodo de fin"),
    )
    total_factors = models.PositiveIntegerField(
        default=0,
        verbose_name=_("Total de factores"),
    )
    total_databases = models.PositiveIntegerField(
        default=0,
        verbose_name=_("Total de bases de datos"),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_citation_queries",
        verbose_name=_("Usuario administrador"),
    )
    status = models.CharField(
        max_length=20,
        choices=QueryStatus.choices,
        default=QueryStatus.COMPLETED,
        verbose_name=_("Estado de la consulta"),
    )

    class Meta:
        verbose_name = _("Consulta de citas con IA")
        verbose_name_plural = _("Consultas de citas con IA")
        ordering = ["-query_date"]
        indexes = [
            models.Index(fields=["query_date"], name="idx_aiq_date"),
            models.Index(fields=["status"], name="idx_aiq_status"),
        ]

    def __str__(self) -> str:
        return f"Consulta IA #{self.id} ({self.start_period} a {self.end_period}) - {self.status}"


class AiCitationQueryFactor(BaseModel):
    """
    Almacena los resultados obtenidos por la IA para cada factor incluido en una consulta.
    """
    class ResultStatus(models.TextChoices):
        VALID = "valid", _("Válido")
        PARTIAL = "partial", _("Parcial")
        NOT_FOUND = "not_found", _("No encontrado")

    query = models.ForeignKey(
        AiCitationQuery,
        on_delete=models.CASCADE,
        related_name="factor_results",
        verbose_name=_("Consulta a la que pertenece"),
    )
    factor = models.ForeignKey(
        Factor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_citation_records",
        verbose_name=_("Factor investigado"),
    )
    factor_name = models.CharField(
        max_length=150,
        verbose_name=_("Nombre del factor al momento de la consulta"),
    )
    total_citations = models.PositiveIntegerField(
        default=0,
        verbose_name=_("Total de citas encontradas"),
    )
    result_status = models.CharField(
        max_length=20,
        choices=ResultStatus.choices,
        default=ResultStatus.VALID,
        verbose_name=_("Estado del resultado"),
    )
    bibliographic_references = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_("Referencias bibliográficas"),
        help_text=_("Lista de referencias bibliográficas con título, autores, año, revista, link/doi"),
    )

    class Meta:
        verbose_name = _("Resultado de factor por IA")
        verbose_name_plural = _("Resultados de factores por IA")
        ordering = ["query", "factor_name"]
        indexes = [
            models.Index(fields=["query", "factor"], name="idx_aiqf_query_factor"),
            models.Index(fields=["result_status"], name="idx_aiqf_status"),
        ]

    def __str__(self) -> str:
        return f"{self.factor_name}: {self.total_citations} citas ({self.result_status})"


class AiCitationQueryDatabase(BaseModel):
    """
    Almacena las bases de datos científicas utilizadas en cada consulta con IA.
    """
    class QueryDatabaseStatus(models.TextChoices):
        COMPLETED = "completed", _("Completada")
        PARTIAL = "partial", _("Parcial")
        FAILED = "failed", _("Falló")

    query = models.ForeignKey(
        AiCitationQuery,
        on_delete=models.CASCADE,
        related_name="database_results",
        verbose_name=_("Consulta a la que pertenece"),
    )
    scientific_database = models.ForeignKey(
        ScientificDatabase,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="query_records",
        verbose_name=_("Base de datos científica vinculada"),
    )
    database_name = models.CharField(
        max_length=150,
        verbose_name=_("Nombre de la base de datos científica"),
    )
    query_status = models.CharField(
        max_length=20,
        choices=QueryDatabaseStatus.choices,
        default=QueryDatabaseStatus.COMPLETED,
        verbose_name=_("Estado de la consulta en la base de datos"),
    )

    class Meta:
        verbose_name = _("Base científica de consulta IA")
        verbose_name_plural = _("Bases científicas de consultas IA")
        ordering = ["query", "database_name"]
        indexes = [
            models.Index(fields=["query", "database_name"], name="idx_aiqdb_query_name"),
            models.Index(fields=["query_status"], name="idx_aiqdb_status"),
        ]

    def __str__(self) -> str:
        return f"{self.database_name} - {self.query_status}"
