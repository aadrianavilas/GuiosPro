from unittest.mock import patch
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.methodology.models.dimension import Dimension
from apps.methodology.models.factor import Factor
from apps.methodology.models.subfactor import Subfactor
from apps.methodology.models.scientific_database import ScientificDatabase
from apps.methodology.models.ai_query import (
    AiCitationQuery,
    AiCitationQueryFactor,
    AiCitationQueryDatabase,
)

User = get_user_model()


class AiCitationFeatureTests(TestCase):
    """
    Pruebas unitarias para los modelos, servicios y endpoints de consulta de citas con IA.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="adminuser",
            email="admin@guiospro.com",
            first_name="Admin",
            last_name="GuiosPro",
            password="AdminPassword#2026",
            is_staff=True,
        )
        self.client.force_authenticate(user=self.user)

        # Crear dimensiones y factores de prueba
        self.dimension1 = Dimension.objects.create(name="Tecnológica", order=1)
        self.dimension2 = Dimension.objects.create(name="Organizacional", order=2)

        self.factor1 = Factor.objects.create(
            name="Compatibilidad",
            dimension=self.dimension1,
            order=1,
            total_citations=5,
            expert_importance=3,
        )
        self.factor2 = Factor.objects.create(
            name="Fiabilidad",
            dimension=self.dimension1,
            order=2,
            total_citations=8,
            expert_importance=4,
        )
        self.factor3 = Factor.objects.create(
            name="Formación",
            dimension=self.dimension2,
            order=1,
            total_citations=12,
            expert_importance=2,
        )

        # Subfactores para permitir el recálculo
        Subfactor.objects.create(name="Sub 1", factor=self.factor1, order=1)
        Subfactor.objects.create(name="Sub 2", factor=self.factor2, order=1)

        # Bases de datos científicas
        self.db_scopus = ScientificDatabase.objects.create(
            name="Scopus", description="Base de datos bibliográfica", is_active=True
        )
        self.db_ieee = ScientificDatabase.objects.create(
            name="IEEE Xplore", description="Literatura de ingeniería", is_active=True
        )

    def test_list_scientific_databases(self):
        """Verifica que el endpoint devuelva las bases de datos científicas activas."""
        url = "/api/v1/methodology/scientific-databases/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertGreaterEqual(len(data), 2)
        names = [d["name"] for d in data]
        self.assertIn("Scopus", names)
        self.assertIn("IEEE Xplore", names)

    @patch("apps.methodology.services.ai_citation_service.AiCitationService.query_citations")
    def test_query_ai_citations_endpoint(self, mock_query):
        """Verifica la recepción y respuesta de la consulta a la IA."""
        mock_query.return_value = {
            "query_id": 99,
            "model_used": "llama-3.3-70b-versatile",
            "resumen": {
                "total_factores": 2,
                "total_bases_indicadas": 2,
                "periodo_inicio": "2020-01-01",
                "periodo_fin": "2025-12-31",
            },
            "resultados": [
                {
                    "factor_id": self.factor1.id,
                    "factor_name": self.factor1.name,
                    "total_citations": 25,
                    "status": "valid",
                },
                {
                    "factor_id": self.factor2.id,
                    "factor_name": self.factor2.name,
                    "total_citations": 30,
                    "status": "valid",
                },
            ],
        }

        url = "/api/v1/methodology/ai-citations/query/"
        payload = {
            "start_period": "2020-01-01",
            "end_period": "2025-12-31",
            "database_names": ["Scopus", "IEEE Xplore"],
            "factor_ids": [self.factor1.id, self.factor2.id],
        }
        response = self.client.post(url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["query_id"], 99)
        self.assertEqual(len(data["resultados"]), 2)
        self.assertEqual(data["resultados"][0]["total_citations"], 25)

    def test_apply_ai_citations_endpoint(self):
        """
        Verifica que al aplicar los resultados:
        1. Se actualizan únicamente los factores seleccionados.
        2. Los factores no consultados mantienen sus citas intactas.
        3. Se recalculan los valores metodológicos.
        """
        url = "/api/v1/methodology/ai-citations/apply/"
        payload = {
            "query_id": 1,
            "factors": [
                {"factor_id": self.factor1.id, "total_citations": 45},
                {"factor_id": self.factor2.id, "total_citations": 50},
            ],
        }
        response = self.client.post(url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["updated_count"], 2)

        # Verificar en base de datos
        self.factor1.refresh_from_db()
        self.factor2.refresh_from_db()
        self.factor3.refresh_from_db()

        self.assertEqual(self.factor1.total_citations, 45)
        self.assertEqual(self.factor2.total_citations, 50)
        # El factor 3 no fue incluido y debe conservar sus 12 citas intactas
        self.assertEqual(self.factor3.total_citations, 12)

    def test_list_and_detail_ai_citation_queries(self):
        """
        Verifica el listado y detalle de consultas de IA con filtros y búsqueda.
        """
        query_obj = AiCitationQuery.objects.create(
            start_period="2020-01-01",
            end_period="2025-12-31",
            total_factors=2,
            total_databases=2,
            user=self.user,
            status=AiCitationQuery.QueryStatus.COMPLETED,
        )
        AiCitationQueryDatabase.objects.create(
            query=query_obj,
            scientific_database=self.db_scopus,
            database_name="Scopus",
            query_status=AiCitationQueryDatabase.QueryDatabaseStatus.COMPLETED,
        )
        AiCitationQueryFactor.objects.create(
            query=query_obj,
            factor=self.factor1,
            factor_name="Compatibilidad",
            total_citations=33,
            result_status=AiCitationQueryFactor.ResultStatus.VALID,
        )

        # Listado general
        list_url = "/api/v1/methodology/ai-citations/queries/"
        resp = self.client.get(list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.json()
        self.assertGreaterEqual(len(results), 1)
        self.assertEqual(results[0]["id"], query_obj.id)
        self.assertIn("user_display", results[0])

        # Búsqueda por término
        search_resp = self.client.get(f"{list_url}?search=Compatibilidad")
        self.assertEqual(search_resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(search_resp.json()), 1)

        # Detalle de consulta
        detail_url = f"/api/v1/methodology/ai-citations/queries/{query_obj.id}/"
        detail_resp = self.client.get(detail_url)
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        detail_data = detail_resp.json()
        self.assertEqual(detail_data["id"], query_obj.id)
        self.assertEqual(len(detail_data["factor_results"]), 1)
        self.assertEqual(detail_data["factor_results"][0]["total_citations"], 33)
        self.assertEqual(len(detail_data["database_results"]), 1)

    def test_restore_preview_and_execution(self):
        """
        Verifica la lógica completa de restauración de versión:
        1. Identificación de factores coincidentes.
        2. Detección de cambio de nombre de factor.
        3. Identificación de factores eliminados.
        4. Ejecución de la restauración y persistencia de valores en BD.
        """
        # Cambiar el nombre actual del factor1 para probar detección de nombre actualizado
        self.factor1.name = "Compatibilidad Avanzada"
        self.factor1.save(update_fields=["name"])

        query_obj = AiCitationQuery.objects.create(
            start_period="2019-01-01",
            end_period="2024-12-31",
            total_factors=3,
            total_databases=1,
            user=self.user,
            status=AiCitationQuery.QueryStatus.COMPLETED,
        )

        # Factor 1: Coincide por ID, pero el nombre fue actualizado en la BD
        AiCitationQueryFactor.objects.create(
            query=query_obj,
            factor=self.factor1,
            factor_name="Compatibilidad",  # Nombre histórico
            total_citations=77,
            result_status=AiCitationQueryFactor.ResultStatus.VALID,
        )

        # Factor 2: Coincide por ID con el mismo nombre
        AiCitationQueryFactor.objects.create(
            query=query_obj,
            factor=self.factor2,
            factor_name="Fiabilidad",
            total_citations=88,
            result_status=AiCitationQueryFactor.ResultStatus.VALID,
        )

        # Factor Eliminado: No existe en la tabla Factor
        AiCitationQueryFactor.objects.create(
            query=query_obj,
            factor=None,
            factor_name="Factor Antiguo Ya Eliminado",
            total_citations=15,
            result_status=AiCitationQueryFactor.ResultStatus.VALID,
        )

        # 1. Probar Preview de Restauración
        preview_url = f"/api/v1/methodology/ai-citations/queries/{query_obj.id}/restore-preview/"
        preview_resp = self.client.get(preview_url)
        self.assertEqual(preview_resp.status_code, status.HTTP_200_OK)
        preview_data = preview_resp.json()

        self.assertTrue(preview_data["can_restore"])
        self.assertEqual(preview_data["total_matching"], 2)
        self.assertEqual(preview_data["total_deleted"], 1)

        # Verificar detección de nombre actualizado en factor 1
        matching = {m["factor_id"]: m for m in preview_data["matching_factors"]}
        self.assertTrue(matching[self.factor1.id]["name_changed"])
        self.assertEqual(matching[self.factor1.id]["current_name"], "Compatibilidad Avanzada")
        self.assertEqual(matching[self.factor1.id]["historical_name"], "Compatibilidad")
        self.assertEqual(matching[self.factor1.id]["citations_to_apply"], 77)

        # Verificar factor 2 sin cambio de nombre
        self.assertFalse(matching[self.factor2.id]["name_changed"])

        # Verificar factor eliminado
        self.assertEqual(preview_data["deleted_factors"][0]["historical_name"], "Factor Antiguo Ya Eliminado")

        # 2. Ejecutar la Restauración
        restore_url = f"/api/v1/methodology/ai-citations/queries/{query_obj.id}/restore/"
        restore_resp = self.client.post(restore_url)
        self.assertEqual(restore_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(restore_resp.json()["restored_count"], 2)

        # 3. Comprobar que en BD se aplicaron las citas pero se preservó el nombre actual
        self.factor1.refresh_from_db()
        self.factor2.refresh_from_db()
        self.factor3.refresh_from_db()

        self.assertEqual(self.factor1.total_citations, 77)
        self.assertEqual(self.factor1.name, "Compatibilidad Avanzada")  # Nombre preservado
        self.assertEqual(self.factor2.total_citations, 88)
        self.assertEqual(self.factor3.total_citations, 12)  # No afectado

    def test_restore_when_all_factors_deleted(self):
        """
        Verifica que si ningún factor de la versión existe, se bloquea la restauración y se muestra el mensaje requerido.
        """
        query_obj = AiCitationQuery.objects.create(
            start_period="2018-01-01",
            end_period="2022-12-31",
            total_factors=1,
            total_databases=1,
            user=self.user,
        )
        AiCitationQueryFactor.objects.create(
            query=query_obj,
            factor=None,
            factor_name="Factor Fantasma",
            total_citations=5,
        )

        preview_url = f"/api/v1/methodology/ai-citations/queries/{query_obj.id}/restore-preview/"
        preview_resp = self.client.get(preview_url)
        self.assertEqual(preview_resp.status_code, status.HTTP_200_OK)
        preview_data = preview_resp.json()

        self.assertFalse(preview_data["can_restore"])
        self.assertIn("Ninguno de los factores existe actualmente", preview_data["empty_reason"])

        # Si se intenta forzar la restauración por POST, debe rechazar con 400
        restore_url = f"/api/v1/methodology/ai-citations/queries/{query_obj.id}/restore/"
        restore_resp = self.client.post(restore_url)
        self.assertEqual(restore_resp.status_code, status.HTTP_400_BAD_REQUEST)
