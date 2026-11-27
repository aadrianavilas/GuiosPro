from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.evaluation.models.organization import Organization
from apps.evaluation.models.software import Software
from apps.evaluation.models.evaluation import Evaluation
from apps.auth.models.auth.user import User

class LatestDraftEndpointTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testeval",
            email="testeval@guiospro.com",
            first_name="Tester",
            last_name="Evaluation",
            password="Password#2026",
        )
        self.client.force_authenticate(user=self.user)
        self.org = Organization.objects.create(
            business_name="Test Org S.A.",
            commercial_name="TestOrg",
            organization_type="private",
            sector="Tecnología",
            city="Quito",
            country="Ecuador",
        )
        self.software = Software.objects.create(
            name="ERP Libre",
            version="1.0.0",
            description="Sistema ERP de prueba",
        )

    def test_no_draft_returns_false(self):
        response = self.client.get("/api/v1/evaluations/latest-draft/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["has_draft"])
        self.assertIsNone(response.data["draft"])

    def test_draft_exists_returns_latest(self):
        draft = Evaluation.objects.create(
            name="Evaluación ERP Libre",
            software=self.software,
            organization=self.org,
            evaluator=self.user,
            state=Evaluation.State.PENDIENTE,
        )
        response = self.client.get("/api/v1/evaluations/latest-draft/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["has_draft"])
        self.assertIsNotNone(response.data["draft"])
        self.assertEqual(response.data["draft"]["id"], draft.id)
        self.assertEqual(response.data["draft"]["name"], "Evaluación ERP Libre")
        self.assertEqual(response.data["draft"]["software_name"], "ERP Libre")
        self.assertEqual(response.data["draft"]["step_number"], 2)
        self.assertEqual(response.data["draft"]["step_slug"], "factores")

    def test_draft_with_factors_only_stays_at_step_2_factors(self):
        from apps.evaluation.models.factor_assessment import FactorAssessment
        from apps.methodology.models.dimension import Dimension
        from apps.methodology.models.factor import Factor
        from apps.methodology.models.scale import Scale, ScaleLevel
        from apps.methodology.models.scope import Scope

        scale_factor = Scale.objects.create(name="Factor", description="Escala de factores")
        lvl = ScaleLevel.objects.create(scale=scale_factor, value=3, label="Importante", order=3)
        dim = Dimension.objects.create(name="Dim 1", order=1)
        scope = Scope.objects.create(name="Interno")
        factor = Factor.objects.create(
            name="Factor 1",
            dimension=dim,
            suggested_importance=lvl,
            order=1,
        )

        draft = Evaluation.objects.create(
            name="Evaluación En Factores",
            software=self.software,
            organization=self.org,
            evaluator=self.user,
            state=Evaluation.State.PENDIENTE,
        )
        FactorAssessment.objects.create(
            evaluation=draft,
            factor=factor,
            decision_maker_importance=lvl,
            relative_importance=lvl,
            scope=scope,
        )

        response = self.client.get("/api/v1/evaluations/latest-draft/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["has_draft"])
        # Debe mantenerse en el paso 2 (factores) hasta avanzar o evaluar subfactores
        self.assertEqual(response.data["draft"]["step_number"], 2)
        self.assertEqual(response.data["draft"]["step_slug"], "factores")

    def test_completed_evaluation_excluded(self):
        Evaluation.objects.create(
            name="Evaluación Completada",
            software=self.software,
            organization=self.org,
            evaluator=self.user,
            state=Evaluation.State.COMPLETADA,
        )
        response = self.client.get("/api/v1/evaluations/latest-draft/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["has_draft"])
        self.assertIsNone(response.data["draft"])
