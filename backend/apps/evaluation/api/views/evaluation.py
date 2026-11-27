from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.exceptions import ValidationError
from django.utils import timezone

from apps.auth.components.permissions.permissions import (
    HasModulePermission,
    HasModuleOptionPermission,
)
from apps.auth.components.permissions.constant import PERMISSIONS
from apps.evaluation.api.serializers.evaluation import (
    EvaluationCreateSerializer,
    EvaluationDetailSerializer,
    EvaluationSerializer,
    AnalisisIARecomendacionSerializer,
)
from apps.evaluation.models.evaluation import Evaluation
from apps.evaluation.models.organization import Organization
from apps.auth.models.auth.user import User
from apps.evaluation.services.evaluation_service import EvaluationCalculationService
from apps.evaluation.services.ai_recommendation_service import AiRecommendationService


class EvaluationViewSet(ModelViewSet):
    permission_classes = [HasModulePermission, HasModuleOptionPermission]
    required_permissions = {
        "list": [PERMISSIONS["EVALUATION_VIEW"], PERMISSIONS["EVALUATION_CREATE"]],
        "retrieve": [PERMISSIONS["EVALUATION_VIEW"], PERMISSIONS["EVALUATION_CREATE"]],
        "create": PERMISSIONS["EVALUATION_CREATE"],
        "update": [PERMISSIONS["EVALUATION_CHANGE"], PERMISSIONS["EVALUATION_CREATE"]],
        "partial_update": [PERMISSIONS["EVALUATION_CHANGE"], PERMISSIONS["EVALUATION_CREATE"]],
        "destroy": PERMISSIONS["EVALUATION_DELETE"],
        "latest_draft": [PERMISSIONS["EVALUATION_CREATE"], PERMISSIONS["EVALUATION_VIEW"]],
        "active_evaluations": [PERMISSIONS["EVALUATION_VIEW"], PERMISSIONS["EVALUATION_CREATE"]],
        "evaluate_factors": PERMISSIONS["EVALUATION_CREATE"],
        "evaluate_subfactors": PERMISSIONS["EVALUATION_CREATE"],
        "calculate": PERMISSIONS["EVALUATION_CREATE"],
        "results": [PERMISSIONS["EVALUATION_VIEW"], PERMISSIONS["EVALUATION_CREATE"]],
        "finalize": PERMISSIONS["EVALUATION_CREATE"],
        "ai_analysis": [PERMISSIONS["EVALUATION_VIEW"], PERMISSIONS["EVALUATION_CREATE"]],
    }
    queryset = Evaluation.objects.all()

    def _is_admin(self, request=None, user=None):
        req = request or getattr(self, "request", None)
        user = user or (req.user if req and hasattr(req, "user") else None)
        if not user or not user.is_authenticated:
            return False

        active_group = None
        if req and hasattr(req, "headers"):
            active_group = req.headers.get("X-Active-Group")
        if not active_group and req and hasattr(req, "query_params"):
            active_group = req.query_params.get("active_group")

        if active_group:
            return active_group.strip().lower() == "administrador"

        if user.groups.filter(name="Decisor").exists() and not user.is_superuser:
            return False

        return user.is_superuser or user.groups.filter(name="Administrador").exists()

    def get_queryset(self):
        qs = Evaluation.objects.filter(is_active=True).select_related("software", "organization", "evaluator")
        user = self.request.user if self.request.user and self.request.user.is_authenticated else None

        # El rol Administrador no cuenta con organización ni tiene acceso al historial o creación de evaluaciones
        if self._is_admin(self.request, user):
            return qs.none()
        
        # Historial y evaluaciones en curso deben mostrar únicamente las evaluaciones realizadas por el usuario actual
        if user:
            qs = qs.filter(evaluator=user)

        state_param = self.request.query_params.get("state")
        if state_param == "in_progress":
            qs = qs.exclude(state=Evaluation.State.COMPLETADA)
        elif state_param in ["completed", "completada", "COM"]:
            qs = qs.filter(state=Evaluation.State.COMPLETADA)
        elif state_param:
            qs = qs.filter(state=state_param)

        return qs.order_by("-updated_at", "-id")

    def get_serializer_class(self):
        if self.action == "create":
            return EvaluationCreateSerializer
        if self.action in ["list", "retrieve"]:
            return EvaluationDetailSerializer
        return EvaluationSerializer

    def create(self, request, *args, **kwargs):
        user = request.user if request.user and request.user.is_authenticated else None
        if self._is_admin(request, user):
            return Response(
                {"detail": "El rol de Administrador no cuenta con una organización asociada y no puede crear evaluaciones."},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)

        # 1. Resolver evaluador automáticamente
        evaluator_user = None
        if not data.get("evaluator"):
            evaluator_user = user or User.objects.filter(is_active=True).first() or User.objects.first()
            if evaluator_user:
                data["evaluator"] = evaluator_user.id
        else:
            try:
                evaluator_user = User.objects.get(id=data["evaluator"])
            except Exception:
                evaluator_user = user or User.objects.first()
                if evaluator_user:
                    data["evaluator"] = evaluator_user.id

        # 2. Resolver organización automáticamente
        if not data.get("organization"):
            org = (user.organization if user and user.organization else None) or Organization.objects.first()
            if not org:
                org = Organization.objects.create(
                    business_name="Comercial Andina Cía. Ltda.",
                    commercial_name="TecnoEmpresa",
                    organization_type="private",
                    sector="Tecnología",
                    city="Guayaquil",
                    country="Ecuador",
                )
            data["organization"] = org.id

        # 3. Si ya existe una evaluación con este nombre y evaluador, reutilizarla
        eval_name = data.get("name")
        if eval_name and evaluator_user:
            existing = Evaluation.objects.filter(name=eval_name, evaluator=evaluator_user).first()
            if existing:
                sw_id = data.get("software")
                if sw_id and existing.software_id != sw_id:
                    existing.software_id = sw_id
                    existing.save(update_fields=["software"])
                return Response(
                    EvaluationDetailSerializer(existing).data,
                    status=status.HTTP_200_OK,
                )

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=["get"], url_path="latest-draft")
    def latest_draft(self, request):
        """
        Consulta el borrador más reciente del usuario autenticado:
        - Evaluaciones con estado distinto de 'completada' (COM)
        - Ordenadas por updated_at descendente
        - Límite 1
        """
        user = request.user if request.user and request.user.is_authenticated else None
        qs = Evaluation.objects.filter(is_active=True).exclude(state=Evaluation.State.COMPLETADA)
        if user:
            qs = qs.filter(evaluator=user)
        else:
            fallback_user = User.objects.filter(is_active=True).first() or User.objects.first()
            if fallback_user:
                qs = qs.filter(evaluator=fallback_user)

        latest = qs.order_by("-updated_at").first()
        if not latest:
            return Response({"has_draft": False, "draft": None}, status=status.HTTP_200_OK)

        has_results = latest.evaluation_results.exists()
        has_subfactors = latest.evaluation_subfactor_assessments.exists()
        has_factors = latest.evaluation_factor_assessments.exists()

        if has_results:
            step_number = 4
            step_slug = "resultados"
            step_key = "results"
        elif has_subfactors:
            step_number = 3
            step_slug = "subfactores"
            step_key = "subfactors"
        elif latest.software_id or has_factors:
            step_number = 2
            step_slug = "factores"
            step_key = "factors"
        else:
            step_number = 1
            step_slug = "software"
            step_key = "software"

        software_name = latest.software.name if latest.software else "Software"

        return Response(
            {
                "has_draft": True,
                "draft": {
                    "id": latest.id,
                    "name": latest.name,
                    "software_name": software_name,
                    "software_id": latest.software_id,
                    "step_number": step_number,
                    "step_slug": step_slug,
                    "step_key": step_key,
                    "state": latest.state,
                    "updated_at": latest.updated_at.isoformat() if latest.updated_at else None,
                },
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="evaluate-factors")
    def evaluate_factors(self, request, pk=None):
        """
        Registra la importancia del decisor y el alcance para la lista de factores.
        Body esperado:
        {
            "factors": [
                {
                    "factor_id": 1,
                    "decision_maker_importance": 2, // 1..4
                    "scope": "Interno" // "Interno" | "Externo"
                },
                ...
            ]
        }
        """
        evaluation = self.get_object()
        factors_payload = request.data.get("factors", request.data)
        if not isinstance(factors_payload, list):
            return Response(
                {"error": "Se esperaba una lista de factores en 'factors' o en el cuerpo de la petición."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        summary = EvaluationCalculationService.save_factor_assessments(evaluation, factors_payload)
        return Response(
            {"message": "Factores evaluados exitosamente.", "factors": summary},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="evaluate-subfactors")
    def evaluate_subfactors(self, request, pk=None):
        """
        Registra la valoración de subfactores (1..4) para factores relevantes.
        Body esperado:
        {
            "subfactors": [
                {
                    "subfactor_id": 10,
                    "value": 4 // 1..4
                },
                ...
            ]
        }
        """
        evaluation = self.get_object()
        subfactors_payload = request.data.get("subfactors", request.data)
        if not isinstance(subfactors_payload, list):
            return Response(
                {"error": "Se esperaba una lista de subfactores en 'subfactors' o en el cuerpo de la petición."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        summary = EvaluationCalculationService.save_subfactor_assessments(evaluation, subfactors_payload)
        return Response(
            {"message": "Subfactores evaluados exitosamente.", "subfactors": summary},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="calculate")
    def calculate(self, request, pk=None):
        """
        Ejecuta el cálculo completo de la evaluación GUIOS:
        - Valida subfactores de factores relevantes
        - Ponderación media
        - Clasificación FODA
        - Recomendación global A, B o C
        """
        evaluation = self.get_object()
        try:
            finalize = False
            if isinstance(request.data, dict) and request.data.get("finalize") is True:
                finalize = True
            calculation_result = EvaluationCalculationService.calculate_evaluation_results(
                evaluation, finalize=finalize
            )
            return Response(calculation_result, status=status.HTTP_200_OK)
        except ValidationError as e:
            msg = e.detail if hasattr(e, "detail") else str(e)
            if isinstance(msg, list) and len(msg) > 0:
                msg = str(msg[0])
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"], url_path="results")
    def results(self, request, pk=None):
        """
        Obtiene los resultados calculados y la recomendación de la evaluación.
        """
        evaluation = self.get_object()
        try:
            calculation_result = EvaluationCalculationService.calculate_evaluation_results(
                evaluation, finalize=False
            )
            return Response(calculation_result, status=status.HTTP_200_OK)
        except ValidationError as e:
            msg = e.detail if hasattr(e, "detail") else str(e)
            if isinstance(msg, list) and len(msg) > 0:
                msg = str(msg[0])
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="finalize")
    def finalize(self, request, pk=None):
        """
        Finaliza formalmente la evaluación.
        Establece el estado en COMPLETADA (COM) y registra la fecha de fin (end_date).
        Una vez finalizada, ya no es un borrador y queda cerrada para edición.
        """
        evaluation = self.get_object()
        evaluation.state = Evaluation.State.COMPLETADA
        evaluation.end_date = timezone.now().date()
        evaluation.save(update_fields=["state", "end_date", "updated_at"])
        return Response(
            {
                "message": "Evaluación finalizada exitosamente.",
                "state": evaluation.state,
                "end_date": str(evaluation.end_date),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get", "post"], url_path="ai-analysis")
    def ai_analysis(self, request, pk=None):
        """
        Obtiene o genera el análisis ampliado de la recomendación con IA de Groq.
        GET: Retorna el último análisis generado para la evaluación (si existe).
             Si query param ?regenerate=true o ?force=true, genera uno nuevo.
        POST: Genera un nuevo análisis con Groq y lo persiste en la BD.
        """
        evaluation = self.get_object()

        force = (
            request.query_params.get("regenerate") == "true"
            or request.query_params.get("force") == "true"
            or (isinstance(request.data, dict) and request.data.get("regenerate") is True)
        )

        if request.method == "GET" and not force:
            latest = evaluation.analisis_ia.first()
            if latest:
                serializer = AnalisisIARecomendacionSerializer(latest)
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(
                {"detail": "No se ha generado un análisis de IA para esta evaluación todavía."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # POST o GET con force=true
        try:
            # Asegurar que los resultados estén calculados si aún no lo están
            if not evaluation.recommendation_id or not evaluation.evaluation_results.exists():
                EvaluationCalculationService.calculate_evaluation_results(evaluation, finalize=False)
                evaluation.refresh_from_db()

            service = AiRecommendationService()
            analisis = service.generate_analysis(evaluation)
            serializer = AnalisisIARecomendacionSerializer(analisis)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            msg = e.detail if hasattr(e, "detail") else str(e)
            if isinstance(msg, list) and len(msg) > 0:
                msg = str(msg[0])
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Error al generar análisis con IA: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


    

