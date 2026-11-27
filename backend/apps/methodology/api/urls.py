from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.methodology.api.views.dimension import DimensionViewSet
from apps.methodology.api.views.factor import FactorViewSet
from apps.methodology.api.views.subfactor import SubfactorViewSet
from apps.methodology.api.views.scale import ScaleViewSet, ScaleLevelViewSet
from apps.methodology.api.views.scope import ScopeViewSet
from apps.methodology.api.views.recommendation import RecommendationViewSet
from apps.methodology.api.views.structure import EvaluationStructureView
from apps.methodology.api.views.ai_citation import (
    ScientificDatabaseListView,
    AiCitationQueryView,
    AiCitationApplyView,
    AiCitationQueryListView,
    AiCitationQueryDetailView,
    AiCitationQueryRestorePreviewView,
    AiCitationQueryRestoreView,
)

router = DefaultRouter()
router.register(r"dimensions", DimensionViewSet, basename="dimensions")
router.register(r"factors", FactorViewSet, basename="factors")
router.register(r"subfactors", SubfactorViewSet, basename="subfactors")
router.register(r"scales", ScaleViewSet, basename="scales")
router.register(r"scale-levels", ScaleLevelViewSet, basename="scale-levels")
router.register(r"scopes", ScopeViewSet, basename="scopes")
router.register(r"recommendations", RecommendationViewSet, basename="recommendations")

urlpatterns = [
    path("evaluation-structure/", EvaluationStructureView.as_view(), name="evaluation-structure"),
    path("scientific-databases/", ScientificDatabaseListView.as_view(), name="scientific-databases-list"),
    path("ai-citations/query/", AiCitationQueryView.as_view(), name="ai-citations-query"),
    path("ai-citations/apply/", AiCitationApplyView.as_view(), name="ai-citations-apply"),
    path("ai-citations/queries/", AiCitationQueryListView.as_view(), name="ai-citations-queries-list"),
    path("ai-citations/queries/<int:pk>/", AiCitationQueryDetailView.as_view(), name="ai-citations-queries-detail"),
    path("ai-citations/queries/<int:pk>/restore-preview/", AiCitationQueryRestorePreviewView.as_view(), name="ai-citations-queries-restore-preview"),
    path("ai-citations/queries/<int:pk>/restore/", AiCitationQueryRestoreView.as_view(), name="ai-citations-queries-restore"),
    path("", include(router.urls)),
]
