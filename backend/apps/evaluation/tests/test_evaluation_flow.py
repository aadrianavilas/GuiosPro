from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError

from apps.evaluation.models.organization import Organization
from apps.evaluation.models.software import Software
from apps.evaluation.models.evaluation import Evaluation, EvaluationResult
from apps.evaluation.models.factor_assessment import FactorAssessment
from apps.evaluation.models.subfactor_assessment import SubfactorAssessment
from apps.methodology.models.dimension import Dimension
from apps.methodology.models.factor import Factor
from apps.methodology.models.subfactor import Subfactor
from apps.methodology.models.scale import Scale, ScaleLevel
from apps.methodology.models.scope import Scope

from apps.evaluation.services.evaluation_service import EvaluationCalculationService
from apps.evaluation.services.guios_calculator import (
    TEXTO_RECOMENDACION_A,
    TEXTO_RECOMENDACION_B,
    TEXTO_RECOMENDACION_C,
)

User = get_user_model()


class EvaluationFlowIntegrationTest(TestCase):
    def setUp(self):
        # 1. Escalas
        self.scale_factor = Scale.objects.create(name="Factor", description="Escala de factores")
        self.scale_subfactor = Scale.objects.create(name="Subfactor", description="Escala de subfactores")

        self.f_levels = {}
        labels_factor = {1: "Irrelevante", 2: "Opcional", 3: "Importante", 4: "Fundamental"}
        for val, lab in labels_factor.items():
            self.f_levels[val] = ScaleLevel.objects.create(scale=self.scale_factor, value=val, label=lab, order=val)

        self.sub_levels = {}
        labels_sub = {1: "No cumple", 2: "Desconozco", 3: "Cumple parcialmente", 4: "Cumple"}
        for val, lab in labels_sub.items():
            self.sub_levels[val] = ScaleLevel.objects.create(scale=self.scale_subfactor, value=val, label=lab, order=val)

        # 2. Alcances
        self.scope_interno = Scope.objects.create(name="Interno")
        self.scope_externo = Scope.objects.create(name="Externo")

        # 3. Metodología: Dimensión, Factores y Subfactores
        self.dimension = Dimension.objects.create(name="Tecnológica", order=1)

        # Factor 1: Compatibilidad (IS = 3, tiene 2 subfactores)
        self.factor_comp = Factor.objects.create(
            name="Compatibilidad",
            dimension=self.dimension,
            total_citations=10,
            expert_importance=3,
            suggested_importance=self.f_levels[3],
            order=1,
        )
        self.sub1_comp = Subfactor.objects.create(name="Sistemas existentes", factor=self.factor_comp, order=1)
        self.sub2_comp = Subfactor.objects.create(name="Estándares", factor=self.factor_comp, order=2)

        # Factor 2: Costo (IS = 2, tiene 2 subfactores)
        self.factor_costo = Factor.objects.create(
            name="Costo",
            dimension=self.dimension,
            total_citations=5,
            expert_importance=3,
            suggested_importance=self.f_levels[2],
            order=2,
        )
        self.sub1_costo = Subfactor.objects.create(name="Licencias", factor=self.factor_costo, order=1)
        self.sub2_costo = Subfactor.objects.create(name="Infraestructura", factor=self.factor_costo, order=2)

        # 4. Usuario, Organización, Software y Evaluación
        self.user = User.objects.create_user(username="decisor", email="decisor@test.com", password="password123")
        self.org = Organization.objects.create(business_name="Empresa Test", organization_type=Organization.OrganizationType.PRIVATE)
        self.software = Software.objects.create(name="Nextcloud", version="28.0", description="Cloud suite")

        self.evaluation = Evaluation.objects.create(
            name="Evaluación Nextcloud",
            evaluator=self.user,
            organization=self.org,
            software=self.software,
        )

    def test_flujo_completo_evaluacion(self):
        # -------------------------------------------------------------
        # FASE B: Evaluación de factores
        # Compatibilidad: IS=3, Decisor=2 -> Relativa = floor((3+2)/2) = 2 (Opcional, relevante!)
        # Costo: IS=2, Decisor=1 -> Relativa = floor((2+1)/2) = 1 (Irrelevante, no relevante!)
        # -------------------------------------------------------------
        payload_factores = [
            {
                "factor_id": self.factor_comp.id,
                "decision_maker_importance": 2,
                "scope": "Interno",
            },
            {
                "factor_id": self.factor_costo.id,
                "decision_maker_importance": 1,
                "scope": "Externo",
            },
        ]

        summary = EvaluationCalculationService.save_factor_assessments(self.evaluation, payload_factores)
        self.assertEqual(len(summary), 2)

        comp_summary = next(s for s in summary if s["factor_id"] == self.factor_comp.id)
        costo_summary = next(s for s in summary if s["factor_id"] == self.factor_costo.id)

        self.assertEqual(comp_summary["relative_importance"], 2)
        self.assertTrue(comp_summary["is_relevant"])

        self.assertEqual(costo_summary["relative_importance"], 1)
        self.assertFalse(costo_summary["is_relevant"])

        # -------------------------------------------------------------
        # FASE C: Subfactores
        # Intentar evaluar subfactor de factor no relevante debe lanzar ValidationError
        # -------------------------------------------------------------
        with self.assertRaises(ValidationError):
            EvaluationCalculationService.save_subfactor_assessments(
                self.evaluation,
                [{"subfactor_id": self.sub1_costo.id, "value": 4}],
            )

        # Evaluar solo 1 de los 2 subfactores de Compatibilidad
        EvaluationCalculationService.save_subfactor_assessments(
            self.evaluation,
            [{"subfactor_id": self.sub1_comp.id, "value": 4}],
        )

        # Si intentamos calcular ahora, debe fallar porque falta el subfactor 2
        with self.assertRaises(ValidationError):
            EvaluationCalculationService.calculate_evaluation_results(self.evaluation)

        # Ahora evaluamos el subfactor 2 con valor 3
        # Media de Compatibilidad = (4 + 3) / 2 = 3.5
        # Como es Interno y media >= 3.0 -> Fortaleza!
        EvaluationCalculationService.save_subfactor_assessments(
            self.evaluation,
            [{"subfactor_id": self.sub2_comp.id, "value": 3}],
        )

        # -------------------------------------------------------------
        # FASE D: Cálculo de resultados y recomendación
        # Compatibilidad es Fortaleza con Relativa=2
        # Como no hay factores desfavorables -> Recomendación A
        # -------------------------------------------------------------
        resultado = EvaluationCalculationService.calculate_evaluation_results(self.evaluation)

        self.assertEqual(resultado["recommendation"]["categoria"], "A")
        self.assertEqual(resultado["recommendation"]["texto"], TEXTO_RECOMENDACION_A)
        self.assertEqual(len(resultado["factors_calculated"]), 1)

        f_calc = resultado["factors_calculated"][0]
        self.assertEqual(f_calc["swot_classification"], "Fortaleza")
        self.assertEqual(f_calc["average_weighting"], 3.5)

        # Verificar persistencia en base de datos
        self.evaluation.refresh_from_db()
        self.assertEqual(self.evaluation.state, Evaluation.State.COMPLETADA)
        self.assertEqual(self.evaluation.recommendation_category, "A")
        self.assertEqual(self.evaluation.recommendation_text, TEXTO_RECOMENDACION_A)

        eval_res = EvaluationResult.objects.get(evaluation=self.evaluation, factor=self.factor_comp)
        self.assertEqual(eval_res.swot_classification, EvaluationResult.FODA.FORTALEZA)
        self.assertEqual(eval_res.average_weighting, 3.5)

    def test_recomendacion_b_por_desfavorable_opcional(self):
        """
        Si un factor con relativa=2 (Opcional) resulta en Amenaza o Debilidad (media < 3.0),
        y no hay desfavorables críticos, la recomendación debe ser B.
        """
        # Compatibilidad: IS=3, Decisor=2 -> Relativa=2
        EvaluationCalculationService.save_factor_assessments(
            self.evaluation,
            [{"factor_id": self.factor_comp.id, "decision_maker_importance": 2, "scope": "Externo"}],
        )

        # Evaluamos con notas bajas: media = (1 + 2) / 2 = 1.5 < 3.0 -> Externo + < 3.0 = Amenaza
        EvaluationCalculationService.save_subfactor_assessments(
            self.evaluation,
            [
                {"subfactor_id": self.sub1_comp.id, "value": 1},
                {"subfactor_id": self.sub2_comp.id, "value": 2},
            ],
        )

        resultado = EvaluationCalculationService.calculate_evaluation_results(self.evaluation)
        self.assertEqual(resultado["recommendation"]["categoria"], "B")
        self.assertEqual(resultado["recommendation"]["texto"], TEXTO_RECOMENDACION_B)

    def test_recomendacion_c_por_desfavorable_critico(self):
        """
        Si un factor con relativa >= 3 (Importante o Fundamental) resulta en Debilidad o Amenaza (media < 3.0),
        la recomendación debe ser C (máxima prioridad).
        """
        # Compatibilidad: IS=3, Decisor=3 -> Relativa=3 (Importante)
        EvaluationCalculationService.save_factor_assessments(
            self.evaluation,
            [{"factor_id": self.factor_comp.id, "decision_maker_importance": 3, "scope": "Interno"}],
        )

        # Notas bajas: media = (2 + 2) / 2 = 2.0 < 3.0 -> Interno + < 3.0 = Debilidad
        EvaluationCalculationService.save_subfactor_assessments(
            self.evaluation,
            [
                {"subfactor_id": self.sub1_comp.id, "value": 2},
                {"subfactor_id": self.sub2_comp.id, "value": 2},
            ],
        )

        resultado = EvaluationCalculationService.calculate_evaluation_results(self.evaluation)
        self.assertEqual(resultado["recommendation"]["categoria"], "C")
        self.assertEqual(resultado["recommendation"]["texto"], TEXTO_RECOMENDACION_C)
        self.assertEqual(len(resultado["recommendation"]["factores_desfavorables_criticos"]), 1)

    def test_cambio_a_irrelevante_elimina_subfactores_y_resultados(self):
        """
        Regla de flujo: Si un factor evaluado cambia a no relevante (Relativa=1),
        se eliminan sus subfactores y resultados previos.
        """
        # 1. Evaluar como relevante (Relativa=2)
        EvaluationCalculationService.save_factor_assessments(
            self.evaluation,
            [{"factor_id": self.factor_comp.id, "decision_maker_importance": 2, "scope": "Interno"}],
        )
        EvaluationCalculationService.save_subfactor_assessments(
            self.evaluation,
            [
                {"subfactor_id": self.sub1_comp.id, "value": 4},
                {"subfactor_id": self.sub2_comp.id, "value": 4},
            ],
        )
        EvaluationCalculationService.calculate_evaluation_results(self.evaluation)

        self.assertEqual(EvaluationResult.objects.filter(evaluation=self.evaluation).count(), 1)
        self.assertEqual(SubfactorAssessment.objects.filter(evaluation=self.evaluation).count(), 2)

        # 2. Decisor cambia importancia de Compatibilidad a Irrelevante (1)
        # IS=2 para Costo con Decisor=1 da Relativa=1.
        # Para compatibilidad IS=3 con Decisor=1 da Relativa=2 (sigue relevante).
        # Usemos Costo: IS=2, Decisor=1 -> Relativa=1 (Irrelevante)
        # Si asignamos IS=1 y Decisor=1 -> Relativa=1.
        # Cambiamos temporalmente suggested_importance a 1:
        self.factor_comp.suggested_importance = self.f_levels[1]
        self.factor_comp.save()

        # Decisor marca 1 -> Relativa = floor((1+1)/2) = 1 (No relevante)
        EvaluationCalculationService.save_factor_assessments(
            self.evaluation,
            [{"factor_id": self.factor_comp.id, "decision_maker_importance": 1, "scope": "Interno"}],
        )

        # Los subfactores y resultados de Compatibilidad deben haberse eliminado automáticamente
        self.assertEqual(SubfactorAssessment.objects.filter(evaluation=self.evaluation).count(), 0)
        self.assertEqual(EvaluationResult.objects.filter(evaluation=self.evaluation).count(), 0)

    def test_finalize_action_sets_completed_and_end_date(self):
        """
        Verifica que el endpoint /finalize establezca el estado en COMPLETADA y registre la fecha de fin.
        """
        from rest_framework.test import APIClient
        from rest_framework import status
        client = APIClient()
        client.force_authenticate(user=self.user)

        self.evaluation.state = Evaluation.State.EN_PROGRESO
        self.evaluation.end_date = None
        self.evaluation.save()

        response = client.post(f"/api/v1/evaluations/{self.evaluation.id}/finalize/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.evaluation.refresh_from_db()
        self.assertEqual(self.evaluation.state, Evaluation.State.COMPLETADA)
        self.assertIsNotNone(self.evaluation.end_date)

