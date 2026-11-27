import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/context/ToastContext';
import { EvaluationPdfReport } from '@/components/evaluations/EvaluationPdfReport';
import { downloadEvaluationPdf } from '@/utils/pdfReportGenerator';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';
import type { SoftwarePayload } from '@/types';

interface CreateEvaluationViewProps {
  onEvaluationCreated?: (evaluationId: number) => void;
  onFinish?: () => void;
}

export type StepKey = 'software' | 'factors' | 'subfactors' | 'results';

export interface UnfinishedDraft {
  id: number;
  name: string;
  software_name: string;
  software_id: number;
  step_number: number;
  step_slug: string; // 'factores' | 'subfactores' | 'resultados'
  step_key: StepKey;
  state: string;
  updated_at: string | null;
}

interface StepItem {
  key: StepKey;
  label: string;
  stepNumber: number;
}

// Interfaces de la estructura metodológica cargada desde BD
export interface DbSubfactorItem {
  id: number;
  name: string;
  description: string;
  order: number;
}

export interface DbFactorItem {
  id: number;
  name: string;
  description: string;
  dimension_id: number;
  order: number;
  total_citations: number;
  expert_importance: number;
  suggested_importance: {
    id: number | null;
    value: number; // 1..4
    label: string;
  };
  subfactors: DbSubfactorItem[];
  subfactors_count: number;
}

export interface DbDimensionItem {
  id: number;
  name: string;
  description: string;
  order: number;
  factors_count: number;
  factors: DbFactorItem[];
}

export interface DbScaleLevelItem {
  id: number;
  value: number;
  label: string;
  order: number;
}

export interface DbScopeItem {
  id: number;
  name: string;
}

export interface DbRecommendationItem {
  id: number;
  code: string;
  title: string;
  description: string;
  order: number;
}

export interface MethodologyStructure {
  dimensions: DbDimensionItem[];
  scales: {
    factor: DbScaleLevelItem[];
    subfactor: DbScaleLevelItem[];
  };
  scopes: DbScopeItem[];
  recommendations: DbRecommendationItem[];
}

export interface FactorAssessmentState {
  decisionMakerValue: number; // 1..4 (1 = Irrelevante por defecto)
  scope: string; // 'Interno' | 'Externo'
  modificadoPorUsuario: boolean;
  esPredeterminado: boolean;
}

export interface CalculatedFactorResult {
  factor_id: number;
  factor_name: string;
  dimension_id?: number;
  dimension_name?: string;
  relative_importance?: number;
  scope?: string;
  scope_display?: string;
  average_weighting?: number;
  average_weighting_display?: string;
  foda_classification?: string;
  foda_classification_display?: string;
  swot_classification?: string;
  swot_code?: string;
  explanation?: string;
  subfactors?: Array<{
    subfactor_id: number;
    subfactor_name: string;
    value: number;
    label: string;
  }>;
}

export interface CalculationResponse {
  evaluation_id: number;
  evaluation_name: string;
  state: string;
  recommendation: {
    categoria: 'A' | 'B' | 'C';
    titulo: string;
    texto: string;
    total_factores_evaluados: number;
    resumen_foda: Record<string, number>;
    factores_desfavorables_criticos?: Array<{ nombre: string; foda: string; relativa: number }>;
    factores_desfavorables_opcionales?: Array<{ nombre: string; foda: string; relativa: number }>;
  };
  factors_calculated: CalculatedFactorResult[];
  foda_groups: {
    Fortalezas: CalculatedFactorResult[];
    Oportunidades: CalculatedFactorResult[];
    Debilidades: CalculatedFactorResult[];
    Amenazas: CalculatedFactorResult[];
  };
}

const LOCAL_STORAGE_KEY = 'guiospro_evaluation_draft_v1';

const SLUG_TO_STEP_KEY: Record<string, StepKey> = {
  software: 'software',
  factores: 'factors',
  factors: 'factors',
  subfactores: 'subfactors',
  subfactors: 'subfactors',
  resultados: 'results',
  results: 'results',
};

const STEP_KEY_TO_SLUG: Record<StepKey, string> = {
  software: 'software',
  factors: 'factores',
  subfactors: 'subfactores',
  results: 'resultados',
};

const getApiErrorMessage = (errData: any, fallback: string): string => {
  if (!errData) return fallback;
  if (typeof errData === 'string') return errData;
  if (Array.isArray(errData)) return errData.join(' ');
  if (typeof errData === 'object') {
    if (errData.error && typeof errData.error === 'string') return errData.error;
    if (errData.detail && typeof errData.detail === 'string') return errData.detail;
    if (errData.message && typeof errData.message === 'string') return errData.message;
    const values = Object.values(errData).flat();
    if (values.length > 0) {
      return values.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ');
    }
  }
  return fallback;
};

export const CreateEvaluationView: React.FC<CreateEvaluationViewProps> = ({
  onEvaluationCreated,
  onFinish,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Identificadores de BD
  const [evaluationId, setEvaluationId] = useState<number | null>(null);
  const [softwareId, setSoftwareId] = useState<number | null>(null);

  // Paso actual de la evaluación y progreso máximo desbloqueado
  const [currentStep, setCurrentStep] = useState<StepKey>('software');
  const [maxStepReachedIndex, setMaxStepReachedIndex] = useState<number>(0);
  const [highestProgressPercentage, setHighestProgressPercentage] = useState<number>(0);

  // Datos metodológicos desde la Base de Datos
  const [structure, setStructure] = useState<MethodologyStructure | null>(null);
  const [isLoadingStructure, setIsLoadingStructure] = useState<boolean>(true);

  // Estado para diálogo de evaluación sin terminar (borrador más reciente)
  const [isCheckingDraft, setIsCheckingDraft] = useState<boolean>(true);
  const [showDraftModal, setShowDraftModal] = useState<boolean>(false);
  const [unfinishedDraft, setUnfinishedDraft] = useState<UnfinishedDraft | null>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  // ── Estado de finalización y bloqueo de edición de la evaluación ──
  const [isEvaluationFinalized, setIsEvaluationFinalized] = useState<boolean>(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);

  // Estado del software
  const [softwareForm, setSoftwareForm] = useState<SoftwarePayload>({
    name: '',
    version: '',
    description: '',
  });

  // Nombre de la evaluación (personalizado o sugerido)
  const [evaluationName, setEvaluationName] = useState<string>('');
  const toast = useToast();
  const [errors, setErrors] = useState<{ name?: string; evaluationName?: string }>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Estado de evaluación de Factores (factorId -> { decisionMakerValue, scope, modificadoPorUsuario, esPredeterminado })
  const [factorAssessments, setFactorAssessments] = useState<Record<number, FactorAssessmentState>>({});

  // Estado de confirmación de valores predeterminados de factores
  const [hasAcceptedDefaults, setHasAcceptedDefaults] = useState<boolean>(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);
  const [pendingConfirmationFactors, setPendingConfirmationFactors] = useState<DbFactorItem[]>([]);

  // Estado de evaluación de Subfactores (subfactorId -> valor 1..4)
  const [subfactorAssessments, setSubfactorAssessments] = useState<Record<number, number>>({});

  // Estado del cálculo final retornado por la BD
  const [calculationResult, setCalculationResult] = useState<CalculationResponse | null>(null);

  // ── Estado de búsqueda, filtros y colapso de la pantalla de Resultados ──
  const [resultsSearchQuery, setResultsSearchQuery] = useState<string>('');
  const [resultsFodaFilter, setResultsFodaFilter] = useState<'Todos' | 'Fortalezas' | 'Oportunidades' | 'Debilidades' | 'Amenazas'>('Todos');
  const [collapsedResultsDimensions, setCollapsedResultsDimensions] = useState<Record<number, boolean>>({});
  const [expandedFactorId, setExpandedFactorId] = useState<number | null>(null);

  const toggleFactorDetail = (factorId: number) => {
    setExpandedFactorId((prev) => (prev === factorId ? null : factorId));
  };

  // ── Comportamiento Acordeón Estricto (solo uno abierto a la vez) ──
  const [expandedDimensionId, setExpandedDimensionId] = useState<number | null>(null);
  const [expandedSubfactorDimensionId, setExpandedSubfactorDimensionId] = useState<number | null>(null);
  const [expandedSubfactorFactorId, setExpandedSubfactorFactorId] = useState<number | null>(null);
  const [showInfoBanner, setShowInfoBanner] = useState<boolean>(true);

  // ── Autoguardado e Indicador de Última Modificación ──
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isAutosaving, setIsAutosaving] = useState<boolean>(false);

  // ── Datos para Reporte PDF (Decisor y Fecha de Finalización) ──
  const [evaluatorName, setEvaluatorName] = useState<string>('Adrián');
  const [evaluationEndDate, setEvaluationEndDate] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('guiospro_user') || '{}');
      const fullName = [storedUser.first_name, storedUser.last_name].filter(Boolean).join(' ');
      if (fullName) {
        setEvaluatorName(fullName);
      } else if (storedUser.username) {
        setEvaluatorName(storedUser.username);
      }

      const storedOrg = JSON.parse(localStorage.getItem('guiospro_organization') || '{}');
      if (storedOrg.business_name || storedOrg.commercial_name) {
        setOrganizationName(storedOrg.business_name || storedOrg.commercial_name);
      }
    } catch {}
  }, []);

  const formatSpanishDate = (dateStr?: string | null): string => {
    const d = dateStr ? new Date(dateStr) : new Date();
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  };

  const handleExportPdf = () => {
    if (!calculationResult) {
      toast.error('Aún no hay resultados calculados para exportar.');
      return;
    }
    try {
      const safeSoftware = softwareForm.name.trim() || 'Software';
      const today = new Date().toISOString().split('T')[0];
      downloadEvaluationPdf(
        {
          evaluationName: evaluationName || `Evaluación de ${safeSoftware}`,
          softwareName: safeSoftware,
          softwareVersion: softwareForm.version,
          decisorName: evaluatorName,
          completionDate: formatSpanishDate(evaluationEndDate),
          organizationName: organizationName,
          fodaCounts: resultsFodaCounts,
          dimensionGroups: groupedResultsByDimension,
          recommendation: calculationResult.recommendation,
        },
        `Evaluacion_${safeSoftware.replace(/[^a-zA-Z0-9_-]/g, '_')}_${today}.pdf`
      );
      toast.success('El reporte PDF se ha generado y descargado automáticamente.');
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      toast.error('Ocurrió un error al generar la descarga del PDF.');
    }
  };

  // ── Modal y Estado de Ampliación de Recomendación con IA (Groq) ──
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiActiveTab, setAiActiveTab] = useState<'interpretacion' | 'factores'>('interpretacion');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{
    id: number;
    interpretacion: string;
    analisis_factores: string;
    modelo_ia: string;
    fecha_creacion: string;
  } | null>(null);

  const handleOpenAiRecommendation = async (regenerate: boolean = false) => {
    if (!evaluationId) {
      toast.error('No se encontró el identificador de la evaluación.');
      return;
    }

    setIsAiModalOpen(true);
    setAiError(null);

    // Si ya tenemos el análisis cargado y no se solicita regenerar, lo mostramos de inmediato
    if (aiAnalysis && !regenerate) {
      return;
    }

    setAiLoading(true);

    const activeGroup = localStorage.getItem('guiospro_active_group') || 'Decisor';

    try {
      // Si no es forzado a regenerar, consultar si ya existe previamente en BD
      if (!regenerate) {
        const getRes = await fetch(`/api/v1/evaluations/${evaluationId}/ai-analysis/`, {
          headers: {
            'X-Active-Group': activeGroup,
          },
          credentials: 'include',
        });
        if (getRes.ok) {
          const data = await getRes.json();
          if (data && data.interpretacion && data.analisis_factores) {
            setAiAnalysis(data);
            setAiLoading(false);
            return;
          }
        }
      }

      // Si no existe o se solicita regenerar, llamar con POST a Groq
      const postRes = await fetch(`/api/v1/evaluations/${evaluationId}/ai-analysis/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Active-Group': activeGroup,
        },
        credentials: 'include',
        body: JSON.stringify({ regenerate }),
      });

      if (!postRes.ok) {
        const errData = await postRes.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || 'Error al generar el análisis con IA.');
      }

      const newData = await postRes.json();
      setAiAnalysis(newData);
      toast.success(regenerate ? 'Análisis con IA regenerado exitosamente.' : 'Análisis con IA generado exitosamente.');
    } catch (err: any) {
      console.error('Error generando análisis con IA:', err);
      setAiError(err.message || 'Error de conexión con el servicio de IA.');
    } finally {
      setAiLoading(false);
    }
  };

  // Referencias para evitar guardados redundantes (evita llamadas HTTP inútiles)
  const lastSavedSoftwareRef = useRef<string>('');
  const lastSavedFactorsRef = useRef<string>('');
  const lastSavedSubfactorsRef = useRef<string>('');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper para hora actual formateada
  const getFormattedTime = () => {
    return new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Accesibilidad y reglas del Modal de Borrador
  // ──────────────────────────────────────────────────────────────────────────
  // Foco inicial en el botón [Continuar] al mostrarse el modal
  useEffect(() => {
    if (showDraftModal) {
      const timer = setTimeout(() => {
        continueButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showDraftModal]);

  // Si presiona Escape, cerrar modal y volver al panel principal
  useEffect(() => {
    if (!showDraftModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowDraftModal(false);
        navigate('/dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [showDraftModal, navigate]);

  // ──────────────────────────────────────────────────────────────────────────
  // Cargar detalles de una evaluación desde la Base de Datos
  // ──────────────────────────────────────────────────────────────────────────
  const loadEvaluationDetails = async (evalId: number, targetStepKey?: StepKey) => {
    try {
      const evalRes = await fetch(`/api/v1/evaluations/${evalId}/`, {
        credentials: 'include',
      });
      if (evalRes.ok) {
        const evalDetail = await evalRes.json();
        setEvaluationId(evalDetail.id);
        if (evalDetail.software) {
          setSoftwareForm({
            name: evalDetail.software.name || '',
            version: evalDetail.software.version || '',
            description: evalDetail.software.description || '',
          });
          if (evalDetail.software.id) setSoftwareId(evalDetail.software.id);
        }
        if (evalDetail.name) {
          setEvaluationName(evalDetail.name);
        }
        if (evalDetail.evaluator) {
          const evalFullName = [evalDetail.evaluator.first_name, evalDetail.evaluator.last_name].filter(Boolean).join(' ');
          if (evalFullName) setEvaluatorName(evalFullName);
          else if (evalDetail.evaluator.username) setEvaluatorName(evalDetail.evaluator.username);
        }
        if (evalDetail.end_date || evalDetail.updated_at || evalDetail.created_at) {
          setEvaluationEndDate(evalDetail.end_date || evalDetail.updated_at || evalDetail.created_at);
        }

        // Sincronizar factores persistidos en BD
        if (Array.isArray(evalDetail.factor_assessment) && evalDetail.factor_assessment.length > 0) {
          setFactorAssessments((prev) => {
            const updated = { ...prev };
            evalDetail.factor_assessment.forEach((faItem: any) => {
              const fId = faItem.factor?.id;
              if (fId) {
                updated[fId] = {
                  decisionMakerValue: faItem.decision_maker_importance?.value ?? 1,
                  scope: faItem.scope?.name ?? 'Interno',
                  modificadoPorUsuario: true,
                  esPredeterminado: false,
                };
              }
            });
            lastSavedFactorsRef.current = JSON.stringify(updated);
            return updated;
          });
        }

        // Sincronizar subfactores persistidos en BD
        if (Array.isArray(evalDetail.subfactor_assessment) && evalDetail.subfactor_assessment.length > 0) {
          const updatedSubs: Record<number, number> = {};
          evalDetail.subfactor_assessment.forEach((subItem: any) => {
            const sId = subItem.subfactor?.id;
            if (sId) {
              updatedSubs[sId] = subItem.scale_subfactor?.value ?? 2;
            }
          });
          setSubfactorAssessments(updatedSubs);
          lastSavedSubfactorsRef.current = JSON.stringify(updatedSubs);
        }

        if (targetStepKey) {
          setCurrentStep(targetStepKey);
        }

        // Determinar si la evaluación ya está formalmente finalizada (completada)
        const isEvalCompleted = evalDetail.state === 'COM' || evalDetail.state === 'completada';
        setIsEvaluationFinalized(isEvalCompleted);

        // Determinar el paso máximo alcanzado según el estado de la evaluación
        if (isEvalCompleted) {
          setMaxStepReachedIndex(3);
          setHighestProgressPercentage(100);
        } else {
          let reachedIdx = 0;
          if (evalDetail.id) reachedIdx = 1;
          if (Array.isArray(evalDetail.factor_assessment) && evalDetail.factor_assessment.length > 0) reachedIdx = 2;
          if (targetStepKey === 'subfactors') reachedIdx = Math.max(reachedIdx, 2);
          if (
            targetStepKey === 'results' ||
            (Array.isArray(evalDetail.results) && evalDetail.results.length > 0)
          ) {
            reachedIdx = 3;
          }
          setMaxStepReachedIndex((prev) => Math.max(prev, reachedIdx));
          const draftProg = reachedIdx === 3 ? 100 : reachedIdx === 2 ? 75 : reachedIdx === 1 ? 50 : 25;
          setHighestProgressPercentage((prev) => Math.max(prev, evalDetail.progress_percentage || 0, draftProg));
        }

        // Si se cargan resultados o la evaluación ya tiene resultados calculados
        if (targetStepKey === 'results' || (Array.isArray(evalDetail.results) && evalDetail.results.length > 0)) {
          try {
            const resRes = await fetch(`/api/v1/evaluations/${evalId}/results/`, { credentials: 'include' });
            if (resRes.ok) {
              const resData = await resRes.json();
              setCalculationResult(resData);
            }
          } catch (rErr) {
            console.error('Error cargando resultados de evaluación:', rErr);
          }
        }
      }
    } catch (syncErr) {
      console.error('Error sincronizando con evaluación existente:', syncErr);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Acciones de los botones del modal de borrador
  // ──────────────────────────────────────────────────────────────────────────
  // [Continuar]: navegar a la ruta del paso donde se quedó según paso_actual
  const handleContinueDraft = async () => {
    if (!unfinishedDraft) return;
    setShowDraftModal(false);
    await loadEvaluationDetails(unfinishedDraft.id, unfinishedDraft.step_key);
    navigate(`/evaluaciones/${unfinishedDraft.id}/${unfinishedDraft.step_slug}`);
  };

  // [Empezar nueva]: cerrar el modal y dejar visible el formulario en blanco.
  // NO crear nada en la base de datos y NO eliminar ni modificar el borrador anterior.
  const handleStartNew = () => {
    setShowDraftModal(false);
    setShowFinalizeModal(false);
    setIsFinalizing(false);
    setIsEvaluationFinalized(false);
    setEvaluationId(null);
    setSoftwareId(null);
    setSoftwareForm({ name: '', version: '', description: '' });
    setEvaluationName('');
    setCurrentStep('software');
    setMaxStepReachedIndex(0);
    setHighestProgressPercentage(0);
    setErrors({});
    setSubfactorAssessments({});
    setCalculationResult(null);
    setHasAcceptedDefaults(false);
    setLastSavedTime(null);
    lastSavedSoftwareRef.current = '';
    lastSavedFactorsRef.current = '';
    lastSavedSubfactorsRef.current = '';
    localStorage.removeItem(LOCAL_STORAGE_KEY);

    if (structure) {
      const defaultScope = structure.scopes[0]?.name || 'Interno';
      const freshFactors: Record<number, FactorAssessmentState> = {};
      structure.dimensions.forEach((dim) => {
        dim.factors.forEach((f) => {
          freshFactors[f.id] = {
            decisionMakerValue: 1,
            scope: defaultScope,
            modificadoPorUsuario: false,
            esPredeterminado: true,
          };
        });
      });
      setFactorAssessments(freshFactors);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Finalización formal de la evaluación
  // ──────────────────────────────────────────────────────────────────────────
  const handleConfirmFinalize = async () => {
    if (!evaluationId) {
      setShowFinalizeModal(false);
      return;
    }

    try {
      setIsFinalizing(true);
      const res = await fetch(`/api/v1/evaluations/${evaluationId}/finalize/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (res.ok) {
        setIsEvaluationFinalized(true);
        setMaxStepReachedIndex(3);
        setShowFinalizeModal(false);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        toast.success('Evaluación finalizada con éxito. Ahora se encuentra en modo de solo lectura.');
        onFinish?.();
      } else {
        const data = await res.json();
        toast.error(data?.error || data?.message || 'Error al finalizar la evaluación.');
        setShowFinalizeModal(false);
      }
    } catch (err) {
      console.error('Error finalizando evaluación:', err);
      toast.error('No se pudo finalizar la evaluación. Intente nuevamente.');
      setShowFinalizeModal(false);
    } finally {
      setIsFinalizing(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CARGA DE ESTRUCTURA METODOLÓGICA (Solo se ejecuta una vez al montar)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const loadStructure = async () => {
      try {
        setIsLoadingStructure(true);

        // Consultar la estructura metodológica desde la Base de Datos con reintento suave si el backend arranca
        let res: Response | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            res = await fetch('/api/v1/evaluation-structure/', {
              credentials: 'include',
            });
            if (res.ok) break;
          } catch (e) {
            if (attempt === 3) throw e;
          }
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }

        if (!res || !res.ok) {
          throw new Error('No se pudo cargar la metodología de evaluación.');
        }

        const data: MethodologyStructure = await res.json();
        if (!isMounted) return;

        setStructure(data);

        // Inicializar factores con «Irrelevante» (valor 1) como predeterminado por el sistema
        const defaultScope = data.scopes[0]?.name || 'Interno';
        const initialFactors: Record<number, FactorAssessmentState> = {};

        data.dimensions.forEach((dim) => {
          dim.factors.forEach((f) => {
            initialFactors[f.id] = {
              decisionMakerValue: 1, // Irrelevante por defecto
              scope: defaultScope,
              modificadoPorUsuario: false,
              esPredeterminado: true,
            };
          });
        });
        setFactorAssessments(initialFactors);

        // Inicializar primer elemento abierto para acordeón
        if (data.dimensions.length > 0) {
          setExpandedDimensionId(data.dimensions[0].id);
        }
      } catch (err: any) {
        console.error('Error cargando estructura:', err);
        toast.error('No se pudo cargar la información. Por favor, intente nuevamente.');
      } finally {
        if (isMounted) {
          setIsLoadingStructure(false);
        }
      }
    };

    loadStructure();

    return () => {
      isMounted = false;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 1.1 RESPUESTA REACTIVA A CAMBIOS DE RUTA Y BOTÓN "CREAR EVALUACIÓN"
  // Detecta cuando el usuario está en cualquier vista (ej. dentro de una evaluación)
  // y hace clic en "Crear evaluación" para verificar borradores y abrir el modal.
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!structure) return;

    let isMounted = true;

    const handleRouteChange = async () => {
      // 1. Detectar si la ruta actual es una evaluación específica directa: /evaluaciones/:id/:step o /evaluations/:id/:step
      const evalRouteMatch = location.pathname.match(/\/(?:evaluaciones|evaluations)\/(\d+)(?:\/([a-zA-Z0-9_-]+))?/);
      if (evalRouteMatch) {
        const directEvalId = Number(evalRouteMatch[1]);
        const directSlug = evalRouteMatch[2];
        const directStep = directSlug && SLUG_TO_STEP_KEY[directSlug] ? SLUG_TO_STEP_KEY[directSlug] : 'factors';

        if (isMounted) {
          setIsCheckingDraft(false);
          setShowDraftModal(false);
        }

        if (evaluationId !== directEvalId) {
          await loadEvaluationDetails(directEvalId, directStep);
        } else if (directStep && currentStep !== directStep) {
          setCurrentStep(directStep);
        }
        return;
      }

      // 2. Al entrar o hacer clic en "Crear evaluación" (/evaluaciones/nueva o /evaluations/new):
      const isNewEvalRoute =
        location.pathname === '/evaluaciones/nueva' ||
        location.pathname === '/evaluations/new';

      if (isNewEvalRoute) {
        if (isMounted) {
          setIsCheckingDraft(true);
        }

        try {
          const draftRes = await fetch('/api/v1/evaluations/latest-draft/', {
            credentials: 'include',
          });
          if (draftRes.ok) {
            const draftJson = await draftRes.json();
            if (isMounted) {
              if (draftJson.has_draft && draftJson.draft) {
                setUnfinishedDraft(draftJson.draft);
                setShowDraftModal(true);
              } else {
                setUnfinishedDraft(null);
                setShowDraftModal(false);
                // Si no hay borrador o el usuario venía de estar dentro de una evaluación, reiniciar a formulario en blanco
                if (evaluationId !== null) {
                  handleStartNew();
                }
              }
            }
          }
        } catch (draftErr) {
          console.error('Error consultando borrador reciente:', draftErr);
        } finally {
          if (isMounted) {
            setIsCheckingDraft(false);
          }
        }
      }
    };

    handleRouteChange();

    return () => {
      isMounted = false;
    };
  }, [location.pathname, location.key, location.state, structure]);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. PERSISTENCIA INMEDIATA EN LOCALSTORAGE (Blindaje contra recargas)
  // ──────────────────────────────────────────────────────────────────────────
  const persistDraftToStorage = useCallback(() => {
    try {
      if (isEvaluationFinalized || (!evaluationId && !softwareForm.name.trim())) {
        return;
      }
      const draft = {
        evaluationId,
        softwareId,
        currentStep,
        softwareForm,
        evaluationName,
        factorAssessments,
        subfactorAssessments,
        hasAcceptedDefaults,
        lastSavedTime,
        calculationResult,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn('No se pudo guardar borrador en localStorage', e);
    }
  }, [
    isEvaluationFinalized,
    evaluationId,
    softwareId,
    currentStep,
    softwareForm,
    evaluationName,
    factorAssessments,
    subfactorAssessments,
    hasAcceptedDefaults,
    lastSavedTime,
    calculationResult,
  ]);

  useEffect(() => {
    persistDraftToStorage();
  }, [persistDraftToStorage]);

  // ──────────────────────────────────────────────────────────────────────────
  // 3. AUTOGUARDADO EN BASE DE DATOS TRAS INACTIVIDAD (Temporizador / Debounce)
  // ──────────────────────────────────────────────────────────────────────────
  const triggerAutosave = useCallback(async () => {
    if (!evaluationId || isEvaluationFinalized) return;

    try {
      setIsAutosaving(true);

      // Si estamos en Paso 1 (Software) y hubo cambios
      if (currentStep === 'software' && softwareId) {
        const currentPayloadStr = JSON.stringify({ form: softwareForm, name: evaluationName });
        if (currentPayloadStr !== lastSavedSoftwareRef.current) {
          await fetch(`/api/v1/software/${softwareId}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: softwareForm.name.trim(),
              version: softwareForm.version?.trim() || null,
              description: softwareForm.description?.trim() || null,
            }),
          });
          if (evaluationName.trim()) {
            await fetch(`/api/v1/evaluations/${evaluationId}/`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ name: evaluationName.trim() }),
            });
          }
          lastSavedSoftwareRef.current = currentPayloadStr;
          const timeNow = getFormattedTime();
          setLastSavedTime(timeNow);
        }
      }

      // Si estamos en Paso 2 (Factores) y hubo cambios
      if (currentStep === 'factors' && structure) {
        const currentFactorsStr = JSON.stringify(factorAssessments);
        if (currentFactorsStr !== lastSavedFactorsRef.current) {
          const payload = structure.dimensions.flatMap((dim) =>
            dim.factors.map((f) => {
              const fa = factorAssessments[f.id] || { decisionMakerValue: 1, scope: 'Interno' };
              return {
                factor_id: f.id,
                decision_maker_importance: fa.decisionMakerValue,
                scope: fa.scope,
              };
            })
          );

          await fetch(`/api/v1/evaluations/${evaluationId}/evaluate-factors/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ factors: payload }),
          });

          lastSavedFactorsRef.current = currentFactorsStr;
          const timeNow = getFormattedTime();
          setLastSavedTime(timeNow);
        }
      }

      // Si estamos en Paso 3 (Subfactores) y hubo cambios
      if (currentStep === 'subfactors') {
        const currentSubStr = JSON.stringify(subfactorAssessments);
        if (currentSubStr !== lastSavedSubfactorsRef.current) {
          const subPayload = Object.entries(subfactorAssessments).map(([sId, val]) => ({
            subfactor_id: Number(sId),
            value: val,
          }));

          if (subPayload.length > 0) {
            await fetch(`/api/v1/evaluations/${evaluationId}/evaluate-subfactors/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ subfactors: subPayload }),
            });
          }

          lastSavedSubfactorsRef.current = currentSubStr;
          const timeNow = getFormattedTime();
          setLastSavedTime(timeNow);
        }
      }
    } catch (err) {
      console.error('Error durante autoguardado:', err);
    } finally {
      setIsAutosaving(false);
    }
  }, [evaluationId, softwareId, currentStep, softwareForm, evaluationName, factorAssessments, subfactorAssessments, structure]);

  // Programar temporizador de autoguardado cuando el usuario deja de interactuar (3 segundos)
  const scheduleAutosave = useCallback(() => {
    if (isEvaluationFinalized) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      triggerAutosave();
    }, 3000);
  }, [triggerAutosave, isEvaluationFinalized]);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. MANEJO DE ACORDEÓN (Si abre uno, los otros deben cerrarse)
  // ──────────────────────────────────────────────────────────────────────────
  const toggleDimension = (dimId: number) => {
    setExpandedDimensionId((prev) => (prev === dimId ? null : dimId));
  };

  const toggleSubfactorDimension = (dimId: number) => {
    setExpandedSubfactorDimensionId((prev) => (prev === dimId ? null : dimId));
  };

  const toggleSubfactorFactor = (factorId: number) => {
    setExpandedSubfactorFactorId((prev) => (prev === factorId ? null : factorId));
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 5. GESTIÓN DE FACTORES: Seguimiento de selecciones y valores predeterminados
  // ──────────────────────────────────────────────────────────────────────────
  const handleUpdateFactorImportance = (factorId: number, val: number) => {
    setFactorAssessments((prev) => ({
      ...prev,
      [factorId]: {
        ...(prev[factorId] || { scope: 'Interno' }),
        decisionMakerValue: val,
        modificadoPorUsuario: true, // Interacción explícita del usuario
        esPredeterminado: false,     // Ya no conserva el valor predeterminado
      },
    }));
    scheduleAutosave();
  };

  const handleUpdateFactorScope = (factorId: number, scope: string) => {
    setFactorAssessments((prev) => ({
      ...prev,
      [factorId]: {
        ...(prev[factorId] || {
          decisionMakerValue: 1,
          modificadoPorUsuario: false,
          esPredeterminado: true,
        }),
        scope,
      },
    }));
    scheduleAutosave();
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 6. GESTIÓN DE SUBFACTORES
  // ──────────────────────────────────────────────────────────────────────────
  const handleUpdateSubfactorScore = (subfactorId: number, val: number) => {
    setSubfactorAssessments((prev) => ({
      ...prev,
      [subfactorId]: val,
    }));
    scheduleAutosave();
  };

  // Mapeos de escalas desde BD
  const factorScaleMap = useMemo(() => {
    const map = new Map<number, string>();
    structure?.scales.factor.forEach((s) => map.set(s.value, s.label));
    return map;
  }, [structure]);

  const subfactorScaleMap = useMemo(() => {
    const map = new Map<number, string>();
    structure?.scales.subfactor.forEach((s) => map.set(s.value, s.label));
    return map;
  }, [structure]);

  // ──────────────────────────────────────────────────────────────────────────
  // 7. FILTRO ESTRICTO: Si en factor se seleccionó «Irrelevante», no aparece en subfactor
  // ──────────────────────────────────────────────────────────────────────────
  const relevantFactors = useMemo(() => {
    if (!structure) return [];
    const relList: DbFactorItem[] = [];

    structure.dimensions.forEach((dim) => {
      dim.factors.forEach((f) => {
        const fa = factorAssessments[f.id];
        // REGLA: Si no tiene valoración o el decisor eligió 1 (Irrelevante), SE EXCLUYE COMPLETAMENTE
        if (!fa || fa.decisionMakerValue === 1) {
          return;
        }

        const isVal = f.suggested_importance?.value || 3;
        const relVal = Math.floor((isVal + fa.decisionMakerValue) / 2);

        // Si la importancia relativa también es mayor a 1
        if (relVal > 1) {
          relList.push(f);
        }
      });
    });

    return relList;
  }, [structure, factorAssessments]);

  // Dimensiones que contienen factores relevantes para el paso 3
  const relevantDimensions = useMemo(() => {
    if (!structure) return [];
    return structure.dimensions
      .map((dim) => ({
        ...dim,
        factors: dim.factors.filter((f) => relevantFactors.some((rf) => rf.id === f.id)),
      }))
      .filter((dim) => dim.factors.length > 0);
  }, [structure, relevantFactors]);

  // Total de subfactores de factores relevantes
  const totalRelevantSubfactors = useMemo(() => {
    return relevantFactors.reduce((acc, f) => acc + (f.subfactors?.length || 0), 0);
  }, [relevantFactors]);

  const ratedRelevantSubfactorsCount = useMemo(() => {
    let count = 0;
    relevantFactors.forEach((f) => {
      f.subfactors?.forEach((sub) => {
        if (subfactorAssessments[sub.id]) count++;
      });
    });
    return count;
  }, [relevantFactors, subfactorAssessments]);

  // ── Cálculo del porcentaje de progreso global (nunca retrocede al navegar hacia atrás) ──
  const currentCalculatedProgress = useMemo(() => {
    // Si ya se llegó a resultados, o hay resultados calculados, o está finalizada -> 100%
    if (isEvaluationFinalized || currentStep === 'results' || maxStepReachedIndex >= 3 || calculationResult) {
      return 100;
    }

    // Paso 3: Subfactores alcanzado o completado
    if (currentStep === 'subfactors' || maxStepReachedIndex >= 2) {
      if (totalRelevantSubfactors === 0) {
        return 75;
      }
      const subRatio = ratedRelevantSubfactorsCount / totalRelevantSubfactors;
      const subProgress = Math.min(Math.round(50 + subRatio * 25), 75);
      return Math.max(50, subProgress);
    }

    // Paso 2: Factores alcanzado o completado
    if (currentStep === 'factors' || maxStepReachedIndex >= 1) {
      return 50;
    }

    // Paso 1: Software libre
    const nameLen = softwareForm.name.trim().length;
    const evalLen = evaluationName.trim().length;
    let p = 0;
    if (nameLen > 0) p += 10;
    if (evalLen > 0) p += 15;
    return Math.min(p, 25);
  }, [
    isEvaluationFinalized,
    currentStep,
    maxStepReachedIndex,
    calculationResult,
    totalRelevantSubfactors,
    ratedRelevantSubfactorsCount,
    softwareForm.name,
    evaluationName,
  ]);

  // Mantener la marca más alta de progreso alcanzada para evitar disminuciones al volver atrás
  useEffect(() => {
    if (currentCalculatedProgress > 0) {
      setHighestProgressPercentage((prev) => Math.max(prev, currentCalculatedProgress));
    }
  }, [currentCalculatedProgress]);

  // El progreso visual es siempre el valor máximo alcanzado
  const progressPercentage = Math.max(highestProgressPercentage, currentCalculatedProgress);

  // ──────────────────────────────────────────────────────────────────────────
  // 7.5. MÉTODOS Y MEMOS PARA LA PESTAÑA DE RESULTADOS (DISEÑO GUIOS FODA)
  // ──────────────────────────────────────────────────────────────────────────
  const getFodaKey = useCallback((f: CalculatedFactorResult): 'Fortalezas' | 'Oportunidades' | 'Debilidades' | 'Amenazas' | 'Otro' => {
    const raw = (f.foda_classification || f.swot_classification || '').trim().toLowerCase();
    if (raw.includes('fortaleza')) return 'Fortalezas';
    if (raw.includes('oportunidad')) return 'Oportunidades';
    if (raw.includes('debilidad')) return 'Debilidades';
    if (raw.includes('amenaza')) return 'Amenazas';
    return 'Otro';
  }, []);

  // Conteos globales para las tarjetas métricas superiores
  const resultsFodaCounts = useMemo(() => {
    const counts = {
      total: 0,
      Fortalezas: 0,
      Oportunidades: 0,
      Debilidades: 0,
      Amenazas: 0,
    };
    if (!calculationResult?.factors_calculated) return counts;

    counts.total = calculationResult.factors_calculated.length;
    calculationResult.factors_calculated.forEach((factor) => {
      const key = getFodaKey(factor);
      if (key !== 'Otro') {
        counts[key]++;
      }
    });

    return counts;
  }, [calculationResult, getFodaKey]);

  // Agrupamiento por Dimensión con conteos F · O · D · A y alerta de atención
  interface DimensionResultGroup {
    dimensionId: number;
    dimensionName: string;
    order: number;
    factors: CalculatedFactorResult[];
    counts: {
      total: number;
      F: number;
      O: number;
      D: number;
      A: number;
    };
    requiresAttentionCount: number;
  }

  const groupedResultsByDimension = useMemo((): DimensionResultGroup[] => {
    if (!calculationResult?.factors_calculated) return [];

    const dimMap = new Map<number, { name: string; order: number; factors: CalculatedFactorResult[] }>();

    // Inicializar con dimensiones de la estructura si están disponibles
    if (structure?.dimensions) {
      structure.dimensions.forEach((d) => {
        dimMap.set(d.id, { name: d.name, order: d.order, factors: [] });
      });
    }

    calculationResult.factors_calculated.forEach((factor) => {
      let dimId = factor.dimension_id;
      let dimName = factor.dimension_name;

      if (!dimId && structure?.dimensions) {
        const found = structure.dimensions.find((d) => d.factors.some((f) => f.id === factor.factor_id));
        if (found) {
          dimId = found.id;
          dimName = found.name;
        }
      }

      const finalDimId = dimId || 9999;
      const finalDimName = dimName || 'General';

      if (!dimMap.has(finalDimId)) {
        dimMap.set(finalDimId, { name: finalDimName, order: 9999, factors: [] });
      }

      dimMap.get(finalDimId)!.factors.push(factor);
    });

    const groups: DimensionResultGroup[] = [];

    dimMap.forEach((val, id) => {
      if (val.factors.length > 0) {
        let F = 0;
        let O = 0;
        let D = 0;
        let A = 0;

        val.factors.forEach((f) => {
          const key = getFodaKey(f);
          if (key === 'Fortalezas') F++;
          else if (key === 'Oportunidades') O++;
          else if (key === 'Debilidades') D++;
          else if (key === 'Amenazas') A++;
        });

        groups.push({
          dimensionId: id,
          dimensionName: val.name,
          order: val.order,
          factors: val.factors,
          counts: {
            total: val.factors.length,
            F,
            O,
            D,
            A,
          },
          requiresAttentionCount: D + A,
        });
      }
    });

    return groups.sort((a, b) => a.order - b.order);
  }, [calculationResult, structure, getFodaKey]);

  // Filtrado de factores según barra de búsqueda y botones de filtro FODA
  const filteredResultsGroups = useMemo(() => {
    const query = resultsSearchQuery.trim().toLowerCase();

    return groupedResultsByDimension
      .map((group) => {
        const filteredFactors = group.factors.filter((factor) => {
          const fodaKey = getFodaKey(factor);

          if (resultsFodaFilter !== 'Todos' && fodaKey !== resultsFodaFilter) {
            return false;
          }

          if (query) {
            const name = (factor.factor_name || '').toLowerCase();
            const dimName = group.dimensionName.toLowerCase();
            const scope = (factor.scope_display || factor.scope || '').toLowerCase();
            const fodaStr = fodaKey.toLowerCase();
            return (
              name.includes(query) ||
              dimName.includes(query) ||
              scope.includes(query) ||
              fodaStr.includes(query)
            );
          }

          return true;
        });

        return {
          ...group,
          filteredFactors,
        };
      })
      .filter((group) => group.filteredFactors.length > 0);
  }, [groupedResultsByDimension, resultsSearchQuery, resultsFodaFilter, getFodaKey]);

  const totalFilteredFactorsCount = useMemo(() => {
    return filteredResultsGroups.reduce((acc, g) => acc + g.filteredFactors.length, 0);
  }, [filteredResultsGroups]);

  const toggleResultsDimension = (dimId: number) => {
    setCollapsedResultsDimensions((prev) => ({
      ...prev,
      [dimId]: !prev[dimId],
    }));
  };

  const isAllResultsCollapsed = useMemo(() => {
    if (filteredResultsGroups.length === 0) return false;
    return filteredResultsGroups.every((g) => collapsedResultsDimensions[g.dimensionId]);
  }, [filteredResultsGroups, collapsedResultsDimensions]);

  const toggleAllResultsDimensions = () => {
    const shouldCollapse = !isAllResultsCollapsed;
    const newMap: Record<number, boolean> = {};
    filteredResultsGroups.forEach((g) => {
      newMap[g.dimensionId] = shouldCollapse;
    });
    setCollapsedResultsDimensions(newMap);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 8. PASO 1 -> PASO 2: Guardar Software y Evaluación (Evitando guardados inútiles)
  // ──────────────────────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSoftwareForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    scheduleAutosave();
  };

  const validateStep1 = (): boolean => {
    const newErrors: typeof errors = {};
    if (!softwareForm.name.trim()) {
      newErrors.name = 'El nombre del software libre es obligatorio.';
    }
    if (!evaluationName.trim()) {
      newErrors.evaluationName = 'El nombre de la evaluación es obligatorio. Puedes usar la sugerencia automática.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveSoftwareAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1()) return;

    setIsSaving(true);

    try {
      const currentPayloadStr = JSON.stringify({ form: softwareForm, name: evaluationName });

      // Si ya existe la evaluación y no cambió nada, no hacer peticiones inútiles
      if (evaluationId && softwareId && currentPayloadStr === lastSavedSoftwareRef.current) {
        setCurrentStep('factors');
        setMaxStepReachedIndex((prev) => Math.max(prev, 1));
        navigate(`/evaluaciones/${evaluationId}/factores`);
        setIsSaving(false);
        return;
      }

      // Si ya existe la evaluación pero el usuario cambió algún dato del software o nombre
      if (evaluationId && softwareId) {
        await fetch(`/api/v1/software/${softwareId}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: softwareForm.name.trim(),
            version: softwareForm.version?.trim() || null,
            description: softwareForm.description?.trim() || null,
          }),
        });

        await fetch(`/api/v1/evaluations/${evaluationId}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: evaluationName.trim() }),
        });

        lastSavedSoftwareRef.current = currentPayloadStr;
        const timeNow = getFormattedTime();
        setLastSavedTime(timeNow);
        setCurrentStep('factors');
        setMaxStepReachedIndex((prev) => Math.max(prev, 1));
        navigate(`/evaluaciones/${evaluationId}/factores`);
        setIsSaving(false);
        return;
      }

      // 1. Crear nuevo Software en la Base de Datos
      const swResponse = await fetch('/api/v1/software/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: softwareForm.name.trim(),
          version: softwareForm.version?.trim() || null,
          description: softwareForm.description?.trim() || null,
        }),
      });

      const swData = await swResponse.json();
      if (!swResponse.ok) {
        toast.error(swData.detail || swData.name?.[0] || 'No se pudo registrar el software a evaluar.');
        setIsSaving(false);
        return;
      }

      setSoftwareId(swData.id);

      // 2. Obtener organización del usuario
      const userStr = localStorage.getItem('guiospro_user');
      const user = userStr ? JSON.parse(userStr) : null;
      let orgId = user?.organization;
      if (!orgId) {
        const orgRes = await fetch('/api/v1/organization/me/', { credentials: 'include' });
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          orgId = orgData.organization?.id;
        }
      }

      // 3. Crear Evaluación en la Base de Datos
      const autoEvalName =
        evaluationName.trim() ||
        `Evaluación de ${softwareForm.name.trim()}${softwareForm.version ? ` v${softwareForm.version.trim()}` : ''}`;

      const evalPayload: Record<string, any> = {
        name: autoEvalName,
        software: swData.id,
      };
      if (orgId) evalPayload.organization = orgId;
      if (user?.id) evalPayload.evaluator = user.id;

      const evalResponse = await fetch('/api/v1/evaluations/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(evalPayload),
      });

      const evalData = await evalResponse.json();
      if (!evalResponse.ok) {
        const errorMsg =
          evalData.detail ||
          evalData.name?.[0] ||
          evalData.non_field_errors?.[0] ||
          (typeof evalData === 'object' ? Object.values(evalData).flat().join(' ') : null) ||
          'Error al iniciar la evaluación.';
        toast.error(errorMsg);
        setIsSaving(false);
        return;
      }

      setEvaluationId(evalData.id);
      lastSavedSoftwareRef.current = currentPayloadStr;
      const timeNow = getFormattedTime();
      setLastSavedTime(timeNow);

      toast.success('¡Software registrado! Pasando a ponderación de Factores...');
      onEvaluationCreated?.(evalData.id);
      setCurrentStep('factors');
      navigate(`/evaluaciones/${evalData.id}/factores`);
    } catch (err: any) {
      console.error('Error al guardar software:', err);
      toast.error('No se pudo guardar la información. Por favor, intente nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 9. PASO 2 -> PASO 3: Validación de Factores Predeterminados y Guardado
  // ──────────────────────────────────────────────────────────────────────────
  const performSaveFactors = async () => {
    if (!structure) return;

    setIsSaving(true);

    try {
      const currentFactorsStr = JSON.stringify(factorAssessments);

      // Si los factores no cambiaron desde el último guardado, pasar directo sin petición inútil
      if (evaluationId && currentFactorsStr === lastSavedFactorsRef.current) {
        setCurrentStep('subfactors');
      setMaxStepReachedIndex((prev) => Math.max(prev, 2));
      if (evaluationId) {
        navigate(`/evaluaciones/${evaluationId}/subfactores`);
      }
        navigate(`/evaluaciones/${evaluationId}/subfactores`);
        // Abrir la primera dimensión relevante por defecto
        if (relevantDimensions.length > 0) {
          setExpandedSubfactorDimensionId(relevantDimensions[0].id);
          if (relevantDimensions[0].factors.length > 0) {
            setExpandedSubfactorFactorId(relevantDimensions[0].factors[0].id);
          }
        }
        setIsSaving(false);
        return;
      }

      const payload = structure.dimensions.flatMap((dim) =>
        dim.factors.map((f) => {
          const fa = factorAssessments[f.id] || { decisionMakerValue: 1, scope: 'Interno' };
          return {
            factor_id: f.id,
            decision_maker_importance: fa.decisionMakerValue,
            scope: fa.scope,
          };
        })
      );

      if (evaluationId) {
        const res = await fetch(`/api/v1/evaluations/${evaluationId}/evaluate-factors/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ factors: payload }),
        });

        if (!res.ok) {
          const data = await res.json();
          toast.error(getApiErrorMessage(data, 'Error al registrar los factores.'));
          setIsSaving(false);
          return;
        }

        lastSavedFactorsRef.current = currentFactorsStr;
        const timeNow = getFormattedTime();
        setLastSavedTime(timeNow);
      }

      setCurrentStep('subfactors');
      setMaxStepReachedIndex((prev) => Math.max(prev, 2));
      if (evaluationId) {
        navigate(`/evaluaciones/${evaluationId}/subfactores`);
      }
      if (relevantDimensions.length > 0) {
        setExpandedSubfactorDimensionId(relevantDimensions[0].id);
        if (relevantDimensions[0].factors.length > 0) {
          setExpandedSubfactorFactorId(relevantDimensions[0].factors[0].id);
        }
      }
    } catch (err) {
      console.error('Error al guardar factores:', err);
      toast.error('No se pudieron guardar los factores. Por favor, intente nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFactorsAndContinue = () => {
    if (!structure) return;

    // Verificar qué factores conservan el valor predeterminado (no modificados explícitamente)
    const pendingFactors: DbFactorItem[] = [];
    structure.dimensions.forEach((dim) => {
      dim.factors.forEach((f) => {
        const fa = factorAssessments[f.id];
        if (!fa || fa.esPredeterminado || !fa.modificadoPorUsuario) {
          pendingFactors.push(f);
        }
      });
    });

    // Si existen factores con valor predeterminado y el usuario aún no los ha confirmado expresamente
    if (pendingFactors.length > 0 && !hasAcceptedDefaults) {
      setPendingConfirmationFactors(pendingFactors);
      setShowConfirmationModal(true);
      return;
    }

    // Todos confirmados o modificados: proceder normalmente
    performSaveFactors();
  };

  // Confirmar y continuar con los valores predeterminados (Opción 1 del modal)
  const handleConfirmDefaultsAndContinue = async () => {
    setShowConfirmationModal(false);
    setHasAcceptedDefaults(true);

    // Marcar los factores pendientes como confirmados
    setFactorAssessments((prev) => {
      const updated = { ...prev };
      pendingConfirmationFactors.forEach((f) => {
        if (updated[f.id]) {
          updated[f.id] = {
            ...updated[f.id],
            modificadoPorUsuario: true,
            esPredeterminado: false,
          };
        }
      });
      return updated;
    });

    await performSaveFactors();
  };

  // Cerrar modal para revisar factores (Opción 2 del modal)
  const handleCloseConfirmationModal = () => {
    setShowConfirmationModal(false);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 10. PASO 3 -> PASO 4: Guardar Subfactores y Calcular Evaluación
  // ──────────────────────────────────────────────────────────────────────────
  const saveCurrentSubfactors = async () => {
    if (!evaluationId || !structure) return;
    try {
      const subfactorsPayload = Object.entries(subfactorAssessments)
        .filter(([subId]) => {
          const numId = Number(subId);
          return relevantFactors.some((rf) => rf.subfactors?.some((sf) => sf.id === numId));
        })
        .map(([subId, val]) => ({
          subfactor_id: Number(subId),
          value: val,
        }));

      if (subfactorsPayload.length > 0) {
        await fetch(`/api/v1/evaluations/${evaluationId}/evaluate-subfactors/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ subfactors: subfactorsPayload }),
        });
        lastSavedSubfactorsRef.current = JSON.stringify(subfactorAssessments);
        setLastSavedTime(getFormattedTime());
      }
    } catch (e) {
      console.error('Error auto-guardando subfactores:', e);
    }
  };

  const handleSaveSubfactorsAndCalculate = async () => {
    // Si no hay factores relevantes ni subfactores por evaluar, no ejecutar cálculo
    if (relevantDimensions.length === 0) {
      return;
    }

    // Validar que todos los subfactores de los factores relevantes tengan calificación
    const missing: string[] = [];
    relevantFactors.forEach((f) => {
      f.subfactors?.forEach((sub) => {
        if (!subfactorAssessments[sub.id]) {
          missing.push(`${f.name}: ${sub.name}`);
        }
      });
    });

    if (missing.length > 0) {
      toast.warning(
        `Faltan ${missing.length} subfactores por valorar antes de calcular la recomendación.`
      );
      return;
    }

    setIsSaving(true);

    if (evaluationId && structure) {
      try {
        // 1. Asegurar persistencia completa de Factores en la BD antes del cálculo
        const factorsPayload = structure.dimensions.flatMap((dim) =>
          dim.factors.map((f) => {
            const fa = factorAssessments[f.id] || { decisionMakerValue: 1, scope: 'Interno' };
            return {
              factor_id: f.id,
              decision_maker_importance: fa.decisionMakerValue,
              scope: fa.scope,
            };
          })
        );

        const factorsRes = await fetch(`/api/v1/evaluations/${evaluationId}/evaluate-factors/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ factors: factorsPayload }),
        });

        if (!factorsRes.ok) {
          const errData = await factorsRes.json();
          toast.error(getApiErrorMessage(errData, 'Error al guardar los factores de la evaluación.'));
          setIsSaving(false);
          return;
        }
        lastSavedFactorsRef.current = JSON.stringify(factorAssessments);

        // 2. Guardar subfactores en BD (solo los que pertenecen a factores relevantes)
        const subfactorsPayload = Object.entries(subfactorAssessments)
          .filter(([subId]) => {
            const numId = Number(subId);
            return relevantFactors.some((rf) => rf.subfactors?.some((sf) => sf.id === numId));
          })
          .map(([subId, val]) => ({
            subfactor_id: Number(subId),
            value: val,
          }));

        const subRes = await fetch(`/api/v1/evaluations/${evaluationId}/evaluate-subfactors/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ subfactors: subfactorsPayload }),
        });

        if (!subRes.ok) {
          const errData = await subRes.json();
          toast.error(getApiErrorMessage(errData, 'Error al guardar las valoraciones de subfactores.'));
          setIsSaving(false);
          return;
        }

        lastSavedSubfactorsRef.current = JSON.stringify(subfactorAssessments);

        // 3. Ejecutar cálculo completo en BD
        const calcRes = await fetch(`/api/v1/evaluations/${evaluationId}/calculate/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (calcRes.ok) {
          const calcData: CalculationResponse = await calcRes.json();
          setCalculationResult(calcData);
          const timeNow = getFormattedTime();
          setLastSavedTime(timeNow);
          setCurrentStep('results');
          setMaxStepReachedIndex((prev) => Math.max(prev, 3));
          if (evaluationId) {
            navigate(`/evaluaciones/${evaluationId}/resultados`);
          }
        } else {
          const errData = await calcRes.json();
          toast.error(getApiErrorMessage(errData, 'Error al calcular los resultados.'));
        }
      } catch (err) {
        console.error('Error en cálculo:', err);
        toast.error('No se pudieron calcular los resultados. Por favor, intente nuevamente.');
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsSaving(false);
      setCurrentStep('results');
      if (evaluationId) {
        navigate(`/evaluaciones/${evaluationId}/resultados`);
      }
    }
  };

  const steps: StepItem[] = [
    { key: 'software', label: 'Software', stepNumber: 1 },
    { key: 'factors', label: 'Factores', stepNumber: 2 },
    { key: 'subfactors', label: 'Subfactores', stepNumber: 3 },
    { key: 'results', label: 'Resultados', stepNumber: 4 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);
  const suggestedName = `Evaluación de ${softwareForm.name.trim() || 'Nextcloud'}`;

  // Estado de carga (skeleton) mientras se consulta la metodología y el borrador reciente
  // para evitar que el formulario en blanco parpadee antes de que aparezca el modal
  if (isLoadingStructure || isCheckingDraft) {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 font-sans select-none animate-pulse" aria-busy="true" aria-label="Cargando...">
        {/* Skeleton de pasos */}
        <div className="grid grid-cols-4 gap-3 sm:gap-6 pt-1">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex flex-col">
              <div className="w-full h-1 rounded-full mb-2 bg-[#D5ECEC]" />
              <div className="h-4 w-20 bg-[#D5ECEC]/60 rounded" />
            </div>
          ))}
        </div>

        {/* Skeleton de tarjeta principal */}
        <div className="bg-white rounded-[24px] border border-[#D5ECEC] p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-6 w-52 bg-[#D5ECEC]/70 rounded-md" />
              <div className="h-3.5 w-80 bg-[#D5ECEC]/40 rounded-md" />
            </div>
            <GuiosProSpinner size="sm" />
          </div>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <div className="h-3.5 w-32 bg-[#D5ECEC]/50 rounded" />
              <div className="h-11 w-full bg-[#F6F5F3] rounded-[14px] border border-[#D5ECEC]/50" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="h-3.5 w-24 bg-[#D5ECEC]/50 rounded" />
                <div className="h-11 w-full bg-[#F6F5F3] rounded-[14px] border border-[#D5ECEC]/50" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 bg-[#D5ECEC]/50 rounded" />
                <div className="h-11 w-full bg-[#F6F5F3] rounded-[14px] border border-[#D5ECEC]/50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="h-3.5 w-24 bg-[#D5ECEC]/50 rounded" />
              <div className="h-24 w-full bg-[#F6F5F3] rounded-[14px] border border-[#D5ECEC]/50" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 font-sans">
      {/* ── Encabezado Principal y Barra de Progreso ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#2B3F4C] tracking-tight">
              {currentStep === 'factors' || currentStep === 'subfactors'
                ? evaluationName.trim() || (softwareForm.name.trim() ? `Evaluación de ${softwareForm.name.trim()}` : suggestedName)
                : currentStep === 'results' || isEvaluationFinalized
                ? evaluationName.trim() || `Resultados de ${softwareForm.name.trim() || 'Software'}`
                : 'Nueva evaluación'}
            </h1>
            <p className="text-xs text-[#4F6170] mt-0.5">
              Paso {currentStepIndex + 1} de {steps.length} — {steps[currentStepIndex].label}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Indicador de última modificación / autoguardado */}
            {isAutosaving ? (
              <div className="flex items-center gap-1.5 text-xs text-[#5B4A12] bg-[#F9E8A0] px-3 py-1 rounded-full font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#B8531A] animate-pulse" />
                <span>Guardando...</span>
              </div>
            ) : lastSavedTime ? (
              <div className="flex items-center gap-1.5 text-xs text-[#1F3340] bg-white border border-[#D5ECEC] px-3 py-1 rounded-full font-medium">
                <span className="w-2 h-2 rounded-full bg-[#1F7A4D]" />
                <span>Última modificación: {lastSavedTime}</span>
              </div>
            ) : null}

            <div className="px-3 py-1 rounded-full bg-[#F9E8A0] text-[#5B4A12] font-bold text-xs">
              {progressPercentage}% completado
            </div>
          </div>
        </div>

        {/* Barra de progreso global delgada */}
        <div className="w-full h-1.5 bg-[#D5ECEC] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#F7A35F] transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* ── Selector de Pestañas con Rayas Superiores ── */}
      <div className="grid grid-cols-4 gap-3 sm:gap-6 select-none pt-1">
        {steps.map((step, idx) => {
          const isActive = currentStep === step.key;
          const isReachable = isEvaluationFinalized || idx <= maxStepReachedIndex;
          const isCompleted = idx < currentStepIndex || (isReachable && !isActive);

          return (
            <button
              key={step.key}
              type="button"
              disabled={!isReachable}
              onClick={async () => {
                // Solo permitir navegar en las pestañas que ya se han alcanzado
                if (isReachable && !isActive) {
                  if (!isEvaluationFinalized) {
                    if (currentStep === 'factors' && evaluationId && structure) {
                      await performSaveFactors();
                    } else if (currentStep === 'subfactors' && evaluationId) {
                      await saveCurrentSubfactors();
                    }
                  }
                  setCurrentStep(step.key);
                  if (evaluationId) {
                    navigate(`/evaluaciones/${evaluationId}/${STEP_KEY_TO_SLUG[step.key]}`);
                  }
                }
              }}
              className={`flex flex-col text-left transition-all ${
                isActive
                  ? 'cursor-default'
                  : isReachable
                  ? 'opacity-85 hover:opacity-100 cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'
              }`}
            >
              {/* Raya encima de la palabra de la pestaña: celestito si está completada, naranja si está activa, menta si no alcanzada */}
              <div
                className={`w-full h-1 rounded-full mb-2 transition-colors ${
                  isActive
                    ? 'bg-[#F7A35F]'
                    : isCompleted
                    ? 'bg-[#7FBFC1]'
                    : 'bg-[#D5ECEC]'
                }`}
              />
              {/* Palabra de la pestaña */}
              <span
                className={`text-xs sm:text-sm transition-colors ${
                  isActive
                    ? 'text-[#2B3F4C] font-bold'
                    : isReachable
                    ? 'text-[#2B3F4C] font-semibold'
                    : 'text-[#4F6170] font-medium'
                }`}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Banner de solo lectura cuando la evaluación ha sido finalizada */}
      {isEvaluationFinalized && (
        <div className="w-full bg-[#D5ECEC]/60 border border-[#7FBFC1]/60 rounded-[16px] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#16303B]">
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#7FBFC1] text-[#16303B] flex items-center justify-center font-bold text-xs shrink-0">
              ✓
            </span>
            <span className="leading-snug">
              <strong>Evaluación finalizada:</strong> Se encuentra en modo de <strong>solo lectura</strong>. No es posible editar software, factores ni subfactores.
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold bg-white text-[#16303B] px-2.5 py-1 rounded-full border border-[#7FBFC1]/40 shrink-0">
            Solo lectura
          </span>
        </div>
      )}

      {/* Indicador de carga de estructura desde BD */}
      {isLoadingStructure && (
        <div className="bg-white rounded-[24px] p-12 border border-[#D5ECEC] text-center shadow-none flex flex-col items-center justify-center">
          <GuiosProSpinner size="lg" label="Cargando dimensiones, factores y subfactores..." />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PESTAÑA 1: SOFTWARE (Registro Inicial / Edición)
          ══════════════════════════════════════════════════════════════════════ */}
      {!isLoadingStructure && currentStep === 'software' && (
        <form onSubmit={handleSaveSoftwareAndStart} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Columna Izquierda: 2 Tarjetas Blancas */}
            <div className="lg:col-span-2 space-y-5">
              
              {/* Tarjeta 1: Identificación del software */}
              <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] shadow-none space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[14px] bg-[#F9E8A0] text-[#5B4A12] flex items-center justify-center font-bold shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-serif text-[#2B3F4C]">Identificación del software</h2>
                    <p className="text-xs text-[#4F6170]">Datos básicos del paquete o sistema de software libre.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Nombre del software */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#2B3F4C] flex items-center justify-between">
                      <span>Nombre del software <span className="text-[#B8531A] font-bold">*</span></span>
                      <span className="text-[10px] font-bold text-[#7A3E0A] bg-[#FDE2C8] px-2 py-0.5 rounded-full">Obligatorio</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none font-mono text-xs font-bold">
                        &lt;/&gt;
                      </span>
                      <input
                        type="text"
                        name="name"
                        value={softwareForm.name}
                        onChange={handleChange}
                        disabled={isEvaluationFinalized}
                        placeholder="Nextcloud"
                        className={`w-full rounded-[14px] border pl-10 pr-3.5 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition ${
                          errors.name ? 'border-red-400 bg-red-50/30' : 'border-[#D5ECEC] bg-white hover:border-[#B4D6D6]'
                        } ${isEvaluationFinalized ? 'bg-[#F6F5F3] text-[#4F6170] cursor-not-allowed border-[#D5ECEC]' : ''}`}
                      />
                    </div>
                    {errors.name && <p className="text-[11px] text-red-500">{errors.name}</p>}
                  </div>

                  {/* Versión */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#2B3F4C]">
                      Versión <span className="text-[#4F6170] font-normal text-xs">(opcional)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        name="version"
                        value={softwareForm.version}
                        onChange={handleChange}
                        disabled={isEvaluationFinalized}
                        placeholder="Ej. 30.0, 7.6 Comunidad"
                        className={`w-full rounded-[14px] border border-[#D5ECEC] bg-white pl-10 pr-3.5 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 hover:border-[#B4D6D6] transition ${
                          isEvaluationFinalized ? 'bg-[#F6F5F3] text-[#4F6170] cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tarjeta 2: Descripción y alcance */}
              <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] shadow-none space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[14px] bg-[#F9E8A0] text-[#5B4A12] flex items-center justify-center font-bold shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-serif text-[#2B3F4C]">Descripción y alcance</h2>
                    <p className="text-xs text-[#4F6170]">Contexto sobre el propósito del software en la empresa.</p>
                  </div>
                </div>

                <div className="space-y-4 pt-1">
                  {/* Descripción del software */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#2B3F4C]">
                      Descripción del software <span className="text-[#4F6170] font-normal text-xs">(opcional)</span>
                    </label>
                    <textarea
                      name="description"
                      value={softwareForm.description}
                      onChange={handleChange}
                      disabled={isEvaluationFinalized}
                      rows={4}
                      placeholder="Detalla qué necesidad cubre este software, su función principal o por qué se considera para adopción..."
                      className={`w-full rounded-[14px] border border-[#D5ECEC] bg-white p-3.5 text-sm text-[#2B3F4C] placeholder-[#4F6170]/60 focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 hover:border-[#B4D6D6] transition resize-none ${
                        isEvaluationFinalized ? 'bg-[#F6F5F3] text-[#4F6170] cursor-not-allowed' : ''
                      }`}
                    />
                  </div>

                  {/* Nombre de la evaluación */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#2B3F4C] flex items-center justify-between">
                      <span>Nombre de la evaluación <span className="text-[#B8531A] font-bold">*</span></span>
                      <span className="text-[10px] font-bold text-[#7A3E0A] bg-[#FDE2C8] px-2 py-0.5 rounded-full">Obligatorio</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        value={evaluationName}
                        onChange={(e) => {
                          if (!isEvaluationFinalized) {
                            setEvaluationName(e.target.value);
                            scheduleAutosave();
                          }
                        }}
                        disabled={isEvaluationFinalized}
                        placeholder={`Ej. ${suggestedName}`}
                        className={`w-full rounded-[14px] border pl-10 pr-3.5 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition ${
                          errors.evaluationName ? 'border-red-400 bg-red-50/30' : 'border-[#D5ECEC] bg-white hover:border-[#B4D6D6]'
                        } ${isEvaluationFinalized ? 'bg-[#F6F5F3] text-[#4F6170] cursor-not-allowed border-[#D5ECEC]' : ''}`}
                      />
                    </div>
                    {errors.evaluationName && <p className="text-[11px] text-red-500">{errors.evaluationName}</p>}

                    {/* Botón de sugerencia ✦ Usar sugerido */}
                    {!isEvaluationFinalized && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEvaluationName(suggestedName);
                            scheduleAutosave();
                          }}
                          className="inline-flex items-center gap-1.5 bg-[#D5ECEC] hover:bg-[#BFE0E0] text-[#2B3F4C] text-xs font-semibold px-3 py-1.5 rounded-[12px] transition cursor-pointer"
                        >
                          <span>✦</span>
                          <span>Usar sugerido: {suggestedName}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Vista Previa Naranja e Info Box Menta */}
            <div className="space-y-4">
              
              {/* Tarjeta VISTA PREVIA en Naranja #F7A35F */}
              <div className="bg-[#F7A35F] text-[#1F3340] rounded-[24px] p-6 shadow-none space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#1F3340]/80 tracking-widest uppercase">
                    VISTA PREVIA
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#1F7A4D]">
                    <span className="w-2 h-2 rounded-full bg-[#1F7A4D]" />
                    {isEvaluationFinalized ? 'Finalizada' : 'En edición'}
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="w-11 h-11 rounded-[14px] bg-white flex items-center justify-center font-mono font-bold text-xs text-[#1F3340] border border-white/60">
                    &lt;/&gt;
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-2xl text-[#1F3340] leading-snug">
                      {softwareForm.name.trim() || 'Nextcloud'}
                    </h3>
                    <p className="text-xs text-[#1F3340]/80 mt-0.5">
                      {softwareForm.version ? `Versión ${softwareForm.version}` : 'Versión no especificada'}
                    </p>
                  </div>

                  <div className="pt-1">
                    <span className="inline-block bg-white/90 text-[#1F3340] text-xs font-semibold px-3 py-1 rounded-full">
                      Paso 1: Software libre
                    </span>
                  </div>

                  <div className="pt-3 border-t border-[#1F3340]/15 space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#1F3340]/70">
                      Evaluación
                    </span>
                    <p className="text-sm font-bold text-[#1F3340] truncate">
                      {evaluationName.trim() || suggestedName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tarjeta Informativa en Menta #D5ECEC */}
              <div className="bg-[#D5ECEC] rounded-[24px] p-5 shadow-none flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-transparent border border-[#2B3F4C]/40 text-[#2B3F4C] flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs text-[#1F3340] leading-relaxed font-medium">
                  Al guardar el software se creará la evaluación y pasarás directamente a ponderar los factores metodológicos.
                </p>
              </div>

            </div>
          </div>

          {/* Botones de acción centrados */}
          <div className="flex items-center justify-center gap-3 pt-6">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="bg-white border border-[#2B3F4C] text-[#2B3F4C] hover:bg-[#F6F5F3] font-semibold py-2.5 px-7 rounded-[14px] text-sm transition shadow-none cursor-pointer"
            >
              Cancelar
            </button>
            {isEvaluationFinalized ? (
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('factors');
                  if (evaluationId) navigate(`/evaluaciones/${evaluationId}/factores`);
                }}
                className="bg-[#7FBFC1] hover:bg-[#6FAEB0] text-[#16303B] font-semibold py-2.5 px-7 rounded-[14px] text-sm transition shadow-none cursor-pointer flex items-center gap-2"
              >
                <span>Continuar a Factores</span>
                <span className="font-bold">&rarr;</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSaving}
                className="bg-[#7FBFC1] hover:bg-[#6FAEB0] text-[#16303B] font-semibold py-2.5 px-7 rounded-[14px] text-sm transition shadow-none cursor-pointer flex items-center gap-2"
              >
                {isSaving ? 'Guardando...' : 'Guardar y continuar'}
                <span className="font-bold">&rarr;</span>
              </button>
            )}
          </div>
        </form>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PESTAÑA 2: FACTORES RELEVANTES (Acordeón estricto y valores predeterminados)
          ══════════════════════════════════════════════════════════════════════ */}
      {!isLoadingStructure && currentStep === 'factors' && (!structure || structure.dimensions.length === 0) && (
        <div className="p-8 text-center bg-white rounded-[24px] border border-[#D5ECEC] shadow-none">
          <p className="text-sm font-medium text-[#2B3F4C]">No hay dimensiones ni factores a evaluar</p>
        </div>
      )}

      {!isLoadingStructure && currentStep === 'factors' && structure && structure.dimensions.length > 0 && (
        <div className="w-full space-y-5">
          <div>
            <h2 className="text-3xl font-serif text-[#2B3F4C] tracking-tight">Factores relevantes</h2>
            <p className="text-xs text-[#4F6170] mt-1">
              Determina qué factores son relevantes para analizar la adopción de{' '}
              <span className="font-semibold text-[#2B3F4C]">
                {softwareForm.name.trim() || 'Software'}
              </span>
              . Indica su importancia y clasifica el alcance.
            </p>
          </div>

          {showInfoBanner && (
            <div className="bg-[#D5ECEC]/50 border border-[#B4D6D6] rounded-[24px] p-4 flex items-start justify-between gap-3 text-xs text-[#2B3F4C] transition-all">
              <div className="leading-relaxed">
                <span className="font-bold text-[#16303B]">Cómo funciona:</span> la importancia relativa combina la
                sugerida por el sistema con la que tú eliges. Si cambias tu importancia, la relativa se recalcula al instante.
              </div>
              <button
                type="button"
                onClick={() => setShowInfoBanner(false)}
                className="text-[#4F6170] hover:text-[#2B3F4C] p-0.5 rounded-md transition cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {/* Acordeón de Dimensiones: Solo una abierta a la vez */}
          <div className="space-y-4">
            {structure.dimensions.map((dim) => {
              const isExpanded = expandedDimensionId === dim.id;

              return (
                <div
                  key={dim.id}
                  className="bg-white rounded-[24px] border border-[#D5ECEC] shadow-none overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => toggleDimension(dim.id)}
                    className="w-full p-5 flex items-center justify-between text-left hover:bg-[#F6F5F3] transition cursor-pointer select-none"
                  >
                    <div>
                      <h3 className="text-xl font-serif text-[#2B3F4C]">{dim.name}</h3>
                      <p className="text-xs text-[#4F6170] mt-0.5">{dim.factors.length} factores</p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-[#4F6170] transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="p-6 pt-0 space-y-4 border-t border-[#D5ECEC]">
                      {dim.factors.map((factor) => {
                        const fa = factorAssessments[factor.id] || {
                          decisionMakerValue: 1,
                          scope: 'Interno',
                          modificadoPorUsuario: false,
                          esPredeterminado: true,
                        };
                        const suggestedVal = factor.suggested_importance?.value || 3;
                        const suggestedLabel = factor.suggested_importance?.label || 'Importante';

                        // Cálculo matemático oficial: floor((IS + D) / 2)
                        const relativeVal = Math.floor((suggestedVal + fa.decisionMakerValue) / 2);

                        return (
                          <div
                            key={factor.id}
                            className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] shadow-none space-y-5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <h4 className="text-xl font-serif text-[#2B3F4C] tracking-tight">{factor.name}</h4>
                                <p className="text-xs text-[#4F6170] mt-1 leading-relaxed">{factor.description}</p>
                              </div>

                              {/* Indicador sutil de estado predeterminado */}
                              {fa.esPredeterminado && (
                                <span className="text-[10px] font-bold text-[#7A3E0A] bg-[#FDE2C8] px-2.5 py-0.5 rounded-full">
                                  Predeterminado
                                </span>
                              )}
                            </div>

                            {/* Fórmula interactiva */}
                            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
                              <div className="bg-[#F6F5F3] border border-[#D5ECEC] rounded-[14px] px-4 py-2.5 min-w-[130px] flex-1 sm:flex-initial">
                                <span className="block text-[10px] text-[#4F6170] font-medium">Sugerida · sistema</span>
                                <span className="block text-xs sm:text-sm font-bold text-[#2B3F4C] mt-0.5">
                                  {suggestedLabel}
                                </span>
                              </div>

                              <span className="text-[#4F6170] font-bold text-base select-none">+</span>

                              <div className="bg-[#F6F5F3] border border-[#D5ECEC] rounded-[14px] px-4 py-2.5 min-w-[130px] flex-1 sm:flex-initial">
                                <span className="block text-[10px] text-[#4F6170] font-medium">Tu importancia · decisor</span>
                                <span className="block text-xs sm:text-sm font-bold text-[#2B3F4C] mt-0.5">
                                  {factorScaleMap.get(fa.decisionMakerValue) || 'Irrelevante'}
                                </span>
                              </div>

                              <span className="text-[#4F6170] font-bold text-base select-none">=</span>

                              <div className="bg-[#F9E8A0] border border-[#FBB982] rounded-[14px] px-4 py-2.5 min-w-[130px] flex-1 sm:flex-initial">
                                <span className="block text-[10px] text-[#5B4A12] font-semibold">Relativa · resultado</span>
                                <span className="block text-xs sm:text-sm font-bold text-[#5B4A12] mt-0.5">
                                  {factorScaleMap.get(relativeVal) || relativeVal}
                                </span>
                              </div>
                            </div>

                            {/* Selector de importancia (desde escala de BD con «Irrelevante» por defecto) */}
                            <div className="space-y-2 pt-1">
                              <label className="block text-xs font-semibold text-[#2B3F4C]">
                                Elige la importancia de este factor para tu organización
                              </label>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {structure.scales.factor.map((lvl) => {
                                  const isSelected = fa.decisionMakerValue === lvl.value;
                                  return (
                                    <button
                                      key={lvl.value}
                                      type="button"
                                      disabled={isEvaluationFinalized}
                                      onClick={() => !isEvaluationFinalized && handleUpdateFactorImportance(factor.id, lvl.value)}
                                      className={`py-2.5 px-4 rounded-[14px] text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                                        isEvaluationFinalized ? 'cursor-default' : 'cursor-pointer'
                                      } ${
                                        isSelected
                                          ? 'border-2 border-[#7FBFC1] bg-[#D5ECEC]/40 text-[#16303B] shadow-none'
                                          : isEvaluationFinalized
                                          ? 'border border-[#D5ECEC] bg-[#F6F5F3] text-[#4F6170]'
                                          : 'border border-[#D5ECEC] bg-white text-[#2B3F4C] hover:border-[#B4D6D6]'
                                      }`}
                                    >
                                      {isSelected && <span>✓</span>}
                                      <span>{lvl.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Selector de Alcance (desde BD) */}
                            <div className="space-y-2 pt-1">
                              <label className="block text-xs font-semibold text-[#2B3F4C]">Alcance del factor</label>
                              <div className="flex items-center gap-6 text-sm text-[#2B3F4C]">
                                {structure.scopes.map((sc) => (
                                  <label key={sc.id} className={`flex items-center gap-2 font-medium select-none ${isEvaluationFinalized ? 'cursor-default' : 'cursor-pointer'}`}>
                                    <input
                                      type="radio"
                                      name={`scope-${factor.id}`}
                                      checked={fa.scope === sc.name}
                                      disabled={isEvaluationFinalized}
                                      onChange={() => !isEvaluationFinalized && handleUpdateFactorScope(factor.id, sc.name)}
                                      className={`w-4 h-4 text-[#7FBFC1] accent-[#7FBFC1] ${isEvaluationFinalized ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                    />
                                    <span>{sc.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Botones de navegación */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => {
                setCurrentStep('software');
                if (evaluationId) navigate(`/evaluaciones/${evaluationId}/software`);
              }}
              className="px-5 py-2.5 text-xs font-semibold text-[#2B3F4C] bg-white hover:bg-[#D5ECEC]/30 border border-[#D5ECEC] rounded-[14px] transition cursor-pointer flex items-center gap-2"
            >
              ← Volver a Software
            </button>
            {isEvaluationFinalized ? (
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('subfactors');
                  if (evaluationId) navigate(`/evaluaciones/${evaluationId}/subfactores`);
                }}
                className="px-6 py-2.5 text-xs font-semibold text-[#16303B] bg-[#7FBFC1] hover:bg-[#6FAEB0] rounded-[14px] transition shadow-none cursor-pointer flex items-center gap-2"
              >
                <span>Continuar a Subfactores ({relevantFactors.length} relevantes)</span>
                →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveFactorsAndContinue}
                disabled={isSaving}
                className="px-6 py-2.5 text-xs font-semibold text-[#16303B] bg-[#7FBFC1] hover:bg-[#6FAEB0] rounded-[14px] transition shadow-none cursor-pointer flex items-center gap-2"
              >
                <span>{isSaving ? 'Guardando...' : `Continuar a Subfactores (${relevantFactors.length} relevantes)`}</span>
                →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PESTAÑA 3: SUBFACTORES (Acordeón jerárquico estricto y filtro de irrelevantes)
          ══════════════════════════════════════════════════════════════════════ */}
      {!isLoadingStructure && currentStep === 'subfactors' && structure && (
        <div className="w-full space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-3xl font-serif text-[#2B3F4C] tracking-tight">Evaluación de subfactores</h2>
              <p className="text-xs text-[#4F6170] mt-1">
                Valora cada subfactor para los{' '}
                <span className="font-semibold text-[#2B3F4C]">{relevantFactors.length} factores relevantes</span>{' '}
                (los factores calificados como irrelevantes han sido omitidos).
              </p>
            </div>
            <div className="text-xs font-bold text-[#5B4A12] bg-[#F9E8A0] px-3.5 py-1.5 rounded-full">
              Subfactores valorados:{' '}
              <span>
                {ratedRelevantSubfactorsCount} / {totalRelevantSubfactors}
              </span>
            </div>
          </div>

          {relevantDimensions.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-[24px] border border-[#D5ECEC] space-y-2">
              <p className="text-sm font-bold text-[#2B3F4C]">No hay factores relevantes para evaluar en este paso.</p>
              <p className="text-xs text-[#4F6170]">
                Todos los factores fueron calificados como Irrelevantes o no alcanzaron relevancia. Puedes volver al paso anterior para ajustar las importancias.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {relevantDimensions.map((dim) => {
                const isDimExpanded = expandedSubfactorDimensionId === dim.id;

                return (
                  <div
                    key={dim.id}
                    className="bg-white rounded-[24px] border border-[#D5ECEC] shadow-none overflow-hidden transition-all"
                  >
                    {/* Cabecera de Dimensión (Padre) */}
                    <button
                      type="button"
                      onClick={() => toggleSubfactorDimension(dim.id)}
                      className="w-full p-5 flex items-center justify-between text-left hover:bg-[#F6F5F3] transition cursor-pointer select-none bg-[#F6F5F3]/50"
                    >
                      <div>
                        <h3 className="text-xl font-serif text-[#2B3F4C]">{dim.name}</h3>
                        <p className="text-xs text-[#4F6170] mt-0.5">
                          {dim.factors.length} factores relevantes en esta dimensión
                        </p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-[#4F6170] transition-transform duration-200 ${
                          isDimExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Factores hijos: Acordeón estricto dentro de la dimensión */}
                    {isDimExpanded && (
                      <div className="p-5 space-y-4 border-t border-[#D5ECEC]">
                        {dim.factors.map((factor) => {
                          const isFactorExpanded = expandedSubfactorFactorId === factor.id;
                          const fa = factorAssessments[factor.id] || { decisionMakerValue: 2, scope: 'Interno' };
                          const subfactors = factor.subfactors || [];
                          const ratedForThisFactor = subfactors.filter((s) => subfactorAssessments[s.id]).length;
                          const isComplete = ratedForThisFactor === subfactors.length && subfactors.length > 0;

                          return (
                            <div
                              key={factor.id}
                              className="bg-white rounded-[24px] border border-[#D5ECEC] shadow-none overflow-hidden"
                            >
                              {/* Cabecera del factor (Hijo de la dimensión) */}
                              <button
                                type="button"
                                onClick={() => toggleSubfactorFactor(factor.id)}
                                className="w-full p-4 flex items-center justify-between text-left hover:bg-[#F6F5F3] transition cursor-pointer select-none"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2.5">
                                    <h4 className="text-base font-serif text-[#2B3F4C]">{factor.name}</h4>
                                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#D5ECEC] text-[#16303B]">
                                      Alcance: {fa.scope}
                                    </span>
                                    {isComplete ? (
                                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#D5ECEC] text-[#1F7A4D]">
                                        ✓ Completo ({ratedForThisFactor}/{subfactors.length})
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FDE2C8] text-[#7A3E0A]">
                                        Pendiente ({ratedForThisFactor}/{subfactors.length})
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-[#4F6170]">{factor.description}</p>
                                </div>
                                <svg
                                  className={`w-4 h-4 text-[#4F6170] transition-transform duration-200 ${
                                    isFactorExpanded ? 'rotate-180' : ''
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>

                              {/* Subfactores para evaluar */}
                              {isFactorExpanded && (
                                <div className="p-4 pt-0 space-y-3.5 border-t border-[#D5ECEC]">
                                  {subfactors.map((sub, sIdx) => {
                                    const currentScore = subfactorAssessments[sub.id];

                                    return (
                                      <div
                                        key={sub.id}
                                        className="p-4 rounded-[14px] bg-[#F6F5F3]/70 border border-[#D5ECEC] space-y-2.5"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <p className="text-xs font-semibold text-[#2B3F4C]">
                                            <span className="text-[#4F6170] mr-1.5">{sIdx + 1}.</span>
                                            {sub.name}
                                          </p>
                                          {currentScore && (
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#F9E8A0] text-[#5B4A12] whitespace-nowrap">
                                              Valor: {currentScore} — {subfactorScaleMap.get(currentScore)}
                                            </span>
                                          )}
                                        </div>

                                        {/* Opciones de valoración de subfactor desde la escala en BD */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                          {structure.scales.subfactor.map((sLvl) => {
                                            const isSelected = currentScore === sLvl.value;
                                            return (
                                              <button
                                                key={sLvl.value}
                                                type="button"
                                                disabled={isEvaluationFinalized}
                                                onClick={() => !isEvaluationFinalized && handleUpdateSubfactorScore(sub.id, sLvl.value)}
                                                className={`p-2.5 rounded-[14px] text-xs font-medium transition-all text-left flex items-start gap-2 ${
                                                  isEvaluationFinalized ? 'cursor-default' : 'cursor-pointer'
                                                } ${
                                                  isSelected
                                                    ? 'border-2 border-[#7FBFC1] bg-[#D5ECEC]/50 text-[#16303B] font-bold shadow-none'
                                                    : isEvaluationFinalized
                                                    ? 'border border-[#D5ECEC] bg-[#F6F5F3] text-[#4F6170]'
                                                    : 'border border-[#D5ECEC] bg-white text-[#2B3F4C] hover:border-[#B4D6D6]'
                                                }`}
                                              >
                                                <span
                                                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5 ${
                                                    isSelected
                                                      ? 'bg-[#16303B] text-white'
                                                      : 'border border-[#B4D6D6] text-[#4F6170]'
                                                  }`}
                                                >
                                                  {sLvl.value}
                                                </span>
                                                <span className="leading-tight">{sLvl.label}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Botones de navegación */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => {
                setCurrentStep('factors');
                if (evaluationId) navigate(`/evaluaciones/${evaluationId}/factores`);
              }}
              className="px-5 py-2.5 text-xs font-semibold text-[#2B3F4C] bg-white hover:bg-[#D5ECEC]/30 border border-[#D5ECEC] rounded-[14px] transition cursor-pointer flex items-center gap-2"
            >
              ← Volver a Factores
            </button>
            {isEvaluationFinalized ? (
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('results');
                  if (evaluationId) navigate(`/evaluaciones/${evaluationId}/resultados`);
                }}
                className="px-6 py-2.5 text-xs font-semibold rounded-[14px] transition shadow-none flex items-center gap-2 bg-[#7FBFC1] hover:bg-[#6FAEB0] text-[#16303B] cursor-pointer"
              >
                <span>Ver Resultados</span>
                →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveSubfactorsAndCalculate}
                disabled={isSaving || relevantDimensions.length === 0}
                className={`px-6 py-2.5 text-xs font-semibold rounded-[14px] transition shadow-none flex items-center gap-2 ${
                  isSaving || relevantDimensions.length === 0
                    ? 'bg-[#D5ECEC]/60 text-[#4F6170] cursor-not-allowed opacity-60'
                    : 'bg-[#7FBFC1] hover:bg-[#6FAEB0] text-[#16303B] cursor-pointer'
                }`}
              >
                <span>{isSaving ? 'Calculando resultados...' : 'Calcular y Ver Resultados'}</span>
                →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PESTAÑA 4: RESULTADOS, FODA Y RECOMENDACIÓN (Consultados de BD)
          ══════════════════════════════════════════════════════════════════════ */}
      {!isLoadingStructure && currentStep === 'results' && (
        <div className="w-full space-y-6">
          {calculationResult ? (
            <>
              {/* ── Tarjetas Métricas FODA Superiores (4 en fila) ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Fortalezas (Celestito) */}
                <div className="bg-[#7FBFC1] border border-[#6EB2B4] rounded-[20px] p-5 shadow-none flex items-center justify-between sm:flex-col sm:items-start sm:justify-center">
                  <span className="text-3xl sm:text-4xl font-serif font-bold text-[#16303B] leading-none">
                    {resultsFodaCounts.Fortalezas}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#16303B] mt-1 sm:mt-2">
                    FORTALEZAS
                  </span>
                </div>

                {/* Oportunidades (Amarillito) */}
                <div className="bg-[#F9E8A0] border border-[#F2D879] rounded-[20px] p-5 shadow-none flex items-center justify-between sm:flex-col sm:items-start sm:justify-center">
                  <span className="text-3xl sm:text-4xl font-serif font-bold text-[#5B4A12] leading-none">
                    {resultsFodaCounts.Oportunidades}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B4A12] mt-1 sm:mt-2">
                    OPORTUNIDADES
                  </span>
                </div>

                {/* Debilidades (Naranja) */}
                <div className="bg-[#F7A35F] border border-[#EE924A] rounded-[20px] p-5 shadow-none flex items-center justify-between sm:flex-col sm:items-start sm:justify-center">
                  <span className="text-3xl sm:text-4xl font-serif font-bold text-white leading-none">
                    {resultsFodaCounts.Debilidades}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white mt-1 sm:mt-2">
                    DEBILIDADES
                  </span>
                </div>

                {/* Amenazas (Naranja/Rojo Oscuro - Terracota #B84318) */}
                <div className="bg-[#B84318] border border-[#A03812] rounded-[20px] p-5 shadow-none flex items-center justify-between sm:flex-col sm:items-start sm:justify-center">
                  <span className="text-3xl sm:text-4xl font-serif font-bold text-white leading-none">
                    {resultsFodaCounts.Amenazas}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white mt-1 sm:mt-2">
                    AMENAZAS
                  </span>
                </div>
              </div>

              {/* ── Barra de Búsqueda, Filtros y Colapso ── */}
              <div className="bg-white rounded-[22px] border border-[#EBEBE8] p-4 sm:p-5 shadow-none space-y-3.5">
                {/* Fila de búsqueda y botón Contraer todo */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.15z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={resultsSearchQuery}
                      onChange={(e) => setResultsSearchQuery(e.target.value)}
                      placeholder="Buscar por factor, dimensión o clasificación..."
                      className="w-full pl-10 pr-4 py-2 bg-[#F8F9FA] rounded-full text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] focus:border-[#7FBFC1] transition placeholder:text-gray-400"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={toggleAllResultsDimensions}
                    className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-full text-xs font-medium text-[#2B3F4C] transition cursor-pointer self-end sm:self-auto shrink-0 shadow-none"
                  >
                    {isAllResultsCollapsed ? 'Expandir todo' : 'Contraer todo'}
                  </button>
                </div>

                {/* Fila de Filtros y Contador */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {(['Todos', 'Fortalezas', 'Oportunidades', 'Debilidades', 'Amenazas'] as const).map((filterKey) => {
                      const count = filterKey === 'Todos' ? resultsFodaCounts.total : resultsFodaCounts[filterKey];
                      const isSelected = resultsFodaFilter === filterKey;
                      return (
                        <button
                          key={filterKey}
                          type="button"
                          onClick={() => setResultsFodaFilter(filterKey)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer shadow-none ${
                            isSelected
                              ? 'bg-[#243642] text-white'
                              : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {filterKey} · {count}
                        </button>
                      );
                    })}
                  </div>

                  <span className="text-xs text-gray-400 font-medium">
                    Mostrando {totalFilteredFactorsCount} de {resultsFodaCounts.total} factores
                  </span>
                </div>
              </div>

              {/* ── Tarjetas Colapsables por Dimensión ── */}
              <div className="space-y-4">
                {filteredResultsGroups.map((group) => {
                  const isCollapsed = !!collapsedResultsDimensions[group.dimensionId];

                  return (
                    <div
                      key={group.dimensionId}
                      className="bg-white rounded-[22px] border border-[#EBEBE8] p-5 shadow-none space-y-4"
                    >
                      {/* Cabecera Colapsable de la Dimensión */}
                      <div
                        onClick={() => toggleResultsDimension(group.dimensionId)}
                        className="w-full flex items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          {/* Icono amarillo/ocre en caja cuadrada redondeada */}
                          <div className="w-10 h-10 rounded-xl bg-[#FDF6E2] border border-[#F5E6B3] flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-[#8C6D1F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                              <line x1="8" y1="21" x2="16" y2="21" />
                              <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                          </div>

                          <div>
                            <h3 className="text-lg font-serif font-bold text-[#243642] tracking-tight">
                              {group.dimensionName}
                            </h3>
                            <p className="text-xs text-gray-400 font-medium mt-0.5">
                              {group.counts.total} {group.counts.total === 1 ? 'factor' : 'factores'} · {group.counts.F} F · {group.counts.O} O · {group.counts.D} D · {group.counts.A} A
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {/* Badge de atención si hay debilidades o amenazas */}
                          {group.requiresAttentionCount > 0 && (
                            <span className="bg-[#FDF0E6] text-[#B84318] border border-[#F9D0BC] text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                              {group.requiresAttentionCount} {group.requiresAttentionCount === 1 ? 'requiere atención' : 'requieren atención'}
                            </span>
                          )}

                          {/* Flecha colapsable chevron */}
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-50 border border-gray-100 transition">
                            <svg
                              className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Tabla de Factores (Visible cuando no está colapsado) */}
                      {!isCollapsed && (
                        <div className="overflow-x-auto pt-1">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-gray-100 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                                <th className="py-2.5 px-4 font-semibold">FACTOR</th>
                                <th className="py-2.5 px-4 font-semibold text-center">POND. MEDIA</th>
                                <th className="py-2.5 px-4 font-semibold text-center">ALCANCE</th>
                                <th className="py-2.5 px-4 font-semibold text-center">FODA</th>
                                <th className="py-2.5 px-4 font-semibold text-center">DETALLE</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {group.filteredFactors.map((factor) => {
                                const fodaKey = getFodaKey(factor);
                                const isCritical = fodaKey === 'Debilidades' || fodaKey === 'Amenazas';
                                const avgDisplay =
                                  factor.average_weighting_display ||
                                  (typeof factor.average_weighting === 'number'
                                    ? factor.average_weighting.toFixed(1).replace('.', ',')
                                    : '0,0');
                                const scopeDisplay =
                                  factor.scope_display ||
                                  (factor.scope?.toUpperCase() === 'INTERNO'
                                    ? 'Interno'
                                    : factor.scope?.toUpperCase() === 'EXTERNO'
                                    ? 'Externo'
                                    : factor.scope || 'Interno');

                                const isDetailExpanded = expandedFactorId === factor.factor_id;

                                // Metadatos para fórmula de fracción
                                const subCount =
                                  factor.subfactors && factor.subfactors.length > 0 ? factor.subfactors.length : 1;
                                const numeratorStr =
                                  factor.subfactors && factor.subfactors.length > 0
                                    ? factor.subfactors.map((s) => s.value).join(' + ')
                                    : '0';
                                const sumValues =
                                  factor.subfactors && factor.subfactors.length > 0
                                    ? factor.subfactors.reduce((acc, s) => acc + s.value, 0)
                                    : 0;

                                // Metadatos para matriz FODA 2x2
                                const isInterno = (factor.scope || '').toUpperCase() === 'INTERNO';
                                const isExterno = !isInterno;
                                const isHighPm = Number(factor.average_weighting ?? 0) >= 3;
                                const isLowPm = !isHighPm;

                                return (
                                  <React.Fragment key={factor.factor_id}>
                                    <tr
                                      className={`transition-colors ${
                                        isCritical
                                          ? 'bg-[#FFF5EE] border-l-4 border-l-[#C44D1E]'
                                          : 'bg-white hover:bg-gray-50/60'
                                      }`}
                                    >
                                      {/* FACTOR */}
                                      <td className="py-3.5 px-4">
                                        <span className="font-bold text-xs text-[#243642]">
                                          {factor.factor_name}
                                        </span>
                                      </td>

                                      {/* POND. MEDIA */}
                                      <td className="py-3.5 px-4 text-center">
                                        <span className="font-normal text-sm text-gray-700">
                                          {avgDisplay}
                                        </span>
                                      </td>

                                      {/* ALCANCE */}
                                      <td className="py-3.5 px-4 text-center">
                                        <span className="text-xs text-gray-600">
                                          {scopeDisplay}
                                        </span>
                                      </td>

                                      {/* FODA BADGE */}
                                      <td className="py-3.5 px-4 text-center">
                                        {fodaKey === 'Debilidades' && (
                                          <span className="inline-flex items-center gap-1 bg-[#F7A35F] text-white text-[11px] font-bold px-3 py-1 rounded-full">
                                            <span>⚠</span> Debilidad
                                          </span>
                                        )}
                                        {fodaKey === 'Amenazas' && (
                                          <span className="inline-flex items-center gap-1 bg-[#B84318] text-white text-[11px] font-bold px-3 py-1 rounded-full">
                                            <span>⚠</span> Amenaza
                                          </span>
                                        )}
                                        {fodaKey === 'Fortalezas' && (
                                          <span className="inline-flex items-center bg-[#7FBFC1] text-[#16303B] text-[11px] font-bold px-3 py-1 rounded-full">
                                            Fortaleza
                                          </span>
                                        )}
                                        {fodaKey === 'Oportunidades' && (
                                          <span className="inline-flex items-center bg-[#F9E8A0] text-[#5B4A12] text-[11px] font-bold px-3 py-1 rounded-full">
                                            Oportunidad
                                          </span>
                                        )}
                                        {fodaKey === 'Otro' && (
                                          <span className="inline-flex items-center bg-gray-100 text-gray-600 text-[11px] font-bold px-3 py-1 rounded-full">
                                            {factor.foda_classification || 'Evaluado'}
                                          </span>
                                        )}
                                      </td>

                                      {/* BOTÓN DETALLE (VER MÁS / OCULTAR) */}
                                      <td className="py-3.5 px-4 text-center">
                                        <button
                                          type="button"
                                          onClick={() => toggleFactorDetail(factor.factor_id)}
                                          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-[12px] transition cursor-pointer border ${
                                            isDetailExpanded
                                              ? 'bg-[#2B3F4C] text-white border-[#2B3F4C]'
                                              : 'bg-white hover:bg-[#F6F5F3] text-[#2B3F4C] border-[#D5ECEC] hover:border-[#7FBFC1]'
                                          }`}
                                        >
                                          <span>{isDetailExpanded ? 'Ocultar' : 'Ver más'}</span>
                                          <svg
                                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                              isDetailExpanded ? 'rotate-180 text-white' : 'text-[#4F6170]'
                                            }`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                      </td>
                                    </tr>

                                    {/* PANEL DESPLEGABLE: CÁLCULO PM + MATRIZ FODA CON INTERSECCIÓN */}
                                    {isDetailExpanded && (
                                      <tr className="bg-[#FAF9F7]/90 border-b border-[#D5ECEC]">
                                        <td colSpan={5} className="py-4 px-4 sm:px-6">
                                          <div className="bg-white rounded-[20px] p-4 sm:p-5 border border-[#D5ECEC] space-y-4 shadow-none">
                                            {/* Cabecera del desglose */}
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D5ECEC]/70 pb-3">
                                              <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-[#7FBFC1]" />
                                                <h5 className="text-xs font-bold font-serif text-[#2B3F4C] tracking-wide uppercase">
                                                  Detalle metodológico: {factor.factor_name}
                                                </h5>
                                              </div>
                                              <span className="text-[11px] text-[#4F6170]">
                                                Dimensión:{' '}
                                                <strong className="text-[#2B3F4C] font-semibold">
                                                  {group.dimensionName}
                                                </strong>
                                              </span>
                                            </div>

                                            {/* Grilla: Cálculo Pm (Izquierda) + Matriz FODA (Derecha) */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                                              {/* Panel 1: Cálculo de la Ponderación Media en formato fracción */}
                                              <div className="bg-[#F6F5F3] rounded-[16px] p-4 border border-[#D5ECEC] space-y-3.5">
                                                <div className="flex items-center justify-between">
                                                  <h6 className="text-xs font-bold text-[#2B3F4C] flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-[#7FBFC1] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-6 4h3m4 0h.01M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                                                    </svg>
                                                    <span>Cálculo de la ponderación media (Pm)</span>
                                                  </h6>
                                                  <span className="text-[10px] font-mono text-[#4F6170] bg-white px-2 py-0.5 rounded-[6px] border border-[#D5ECEC]">
                                                    n = {subCount}
                                                  </span>
                                                </div>

                                                {/* Representación visual de la fracción */}
                                                <div className="bg-white p-3.5 rounded-[14px] border border-[#D5ECEC] flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                                  <span className="font-serif italic font-bold text-lg text-[#2B3F4C]">
                                                    Pm =
                                                  </span>
                                                  <div className="inline-flex flex-col items-center justify-center">
                                                    <span className="border-b-2 border-[#2B3F4C] px-2 text-xs font-mono font-bold text-[#16303B]">
                                                      {numeratorStr}
                                                    </span>
                                                    <span className="px-2 pt-0.5 text-xs font-mono font-bold text-[#16303B]">
                                                      {subCount}
                                                    </span>
                                                  </div>
                                                  <span className="font-serif font-bold text-base text-[#2B3F4C]">
                                                    =
                                                  </span>
                                                  {subCount > 1 && (
                                                    <>
                                                      <div className="inline-flex flex-col items-center justify-center">
                                                        <span className="border-b-2 border-[#2B3F4C] px-1.5 text-xs font-mono font-bold text-[#4F6170]">
                                                          {sumValues}
                                                        </span>
                                                        <span className="px-1.5 pt-0.5 text-xs font-mono font-bold text-[#4F6170]">
                                                          {subCount}
                                                        </span>
                                                      </div>
                                                      <span className="font-serif font-bold text-base text-[#2B3F4C]">
                                                        =
                                                      </span>
                                                    </>
                                                  )}
                                                  <span className="font-mono font-bold text-sm text-[#16303B] bg-[#D5ECEC] px-3 py-1 rounded-[10px] border border-[#7FBFC1]">
                                                    {avgDisplay}
                                                  </span>
                                                </div>

                                                {/* Subfactores involucrados */}
                                                <div className="space-y-1.5 pt-0.5">
                                                  <span className="text-[11px] font-semibold text-[#4F6170]">
                                                    Subfactores que componen la ponderación:
                                                  </span>
                                                  {factor.subfactors && factor.subfactors.length > 0 ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                                                      {factor.subfactors.map((sf) => (
                                                        <div
                                                          key={sf.subfactor_id}
                                                          className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-white border border-[#D5ECEC] text-[11px]"
                                                        >
                                                          <span
                                                            className="text-[#2B3F4C] truncate font-medium"
                                                            title={sf.subfactor_name}
                                                          >
                                                            {sf.subfactor_name}
                                                          </span>
                                                          <span className="font-mono font-bold text-[#16303B] shrink-0 bg-[#F6F5F3] px-2 py-0.5 rounded-[6px] border border-[#D5ECEC] text-[10px]">
                                                            {sf.value}
                                                          </span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <p className="text-[11px] text-[#4F6170] italic">
                                                      No se evaluaron subfactores específicos.
                                                    </p>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Panel 2: Matriz de Decisión FODA con sombreado de fila, columna e intersección */}
                                              <div className="bg-[#F6F5F3] rounded-[16px] p-4 border border-[#D5ECEC] space-y-3.5">
                                                <div className="flex items-center justify-between">
                                                  <h6 className="text-xs font-bold text-[#2B3F4C] flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-[#7FBFC1] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                                    </svg>
                                                    <span>Matriz de clasificación FODA</span>
                                                  </h6>
                                                  <span className="text-[10px] font-semibold text-[#4F6170]">
                                                    Intersección: Alcance × Pm
                                                  </span>
                                                </div>

                                                {/* Tabla 2x2 con intersección sombreada */}
                                                <div className="overflow-x-auto">
                                                  <table className="w-full text-center border-collapse text-xs">
                                                    <thead>
                                                      <tr>
                                                        {/* Esquina superior izquierda requerida */}
                                                        <th className="p-2.5 text-[11px] font-bold text-[#4F6170] bg-white border border-[#D5ECEC] rounded-tl-[12px] w-1/3">
                                                          Pm / Impacto
                                                        </th>
                                                        {/* Columna Interno (sombreada si factor es Interno) */}
                                                        <th
                                                          className={`p-2.5 text-xs font-bold border border-[#D5ECEC] transition-colors w-1/3 ${
                                                            isInterno
                                                              ? 'bg-[#D5ECEC] text-[#16303B] font-extrabold border-b-2 border-[#7FBFC1]'
                                                              : 'bg-white text-[#4F6170]'
                                                          }`}
                                                        >
                                                          Interno
                                                          {isInterno && (
                                                            <span className="block text-[9px] font-bold text-[#16303B]">
                                                              ● Seleccionado
                                                            </span>
                                                          )}
                                                        </th>
                                                        {/* Columna Externo (sombreada si factor es Externo) */}
                                                        <th
                                                          className={`p-2.5 text-xs font-bold border border-[#D5ECEC] rounded-tr-[12px] transition-colors w-1/3 ${
                                                            isExterno
                                                              ? 'bg-[#D5ECEC] text-[#16303B] font-extrabold border-b-2 border-[#7FBFC1]'
                                                              : 'bg-white text-[#4F6170]'
                                                          }`}
                                                        >
                                                          Externo
                                                          {isExterno && (
                                                            <span className="block text-[9px] font-bold text-[#16303B]">
                                                              ● Seleccionado
                                                            </span>
                                                          )}
                                                        </th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {/* Fila Pm >= 3 */}
                                                      <tr>
                                                        <th
                                                          className={`p-2.5 text-xs font-bold text-left border border-[#D5ECEC] transition-colors ${
                                                            isHighPm
                                                              ? 'bg-[#D5ECEC] text-[#16303B] font-extrabold border-r-2 border-[#7FBFC1]'
                                                              : 'bg-white text-[#4F6170]'
                                                          }`}
                                                        >
                                                          <div className="flex items-center justify-between">
                                                            <span>Pm ≥ 3</span>
                                                            {isHighPm && (
                                                              <span className="text-[10px] text-[#16303B]">◀</span>
                                                            )}
                                                          </div>
                                                        </th>
                                                        {/* Celda Fortaleza */}
                                                        <td
                                                          className={`p-3 border border-[#D5ECEC] transition-all ${
                                                            isInterno && isHighPm
                                                              ? 'bg-[#D5ECEC] font-extrabold text-[#16303B] ring-2 ring-[#7FBFC1] shadow-sm'
                                                              : 'bg-white text-[#4F6170]'
                                                          }`}
                                                        >
                                                          <div className="flex flex-col items-center justify-center gap-0.5">
                                                            <span className="text-xs">Fortaleza</span>
                                                            {isInterno && isHighPm && (
                                                              <span className="text-[10px] font-bold text-[#16303B] bg-white px-2 py-0.5 rounded-full border border-[#7FBFC1]">
                                                                ✓ Intersección
                                                              </span>
                                                            )}
                                                          </div>
                                                        </td>
                                                        {/* Celda Oportunidad */}
                                                        <td
                                                          className={`p-3 border border-[#D5ECEC] transition-all ${
                                                            isExterno && isHighPm
                                                              ? 'bg-[#F9E8A0] font-extrabold text-[#5B4A12] ring-2 ring-[#D8C359] shadow-sm'
                                                              : 'bg-white text-[#4F6170]'
                                                          }`}
                                                        >
                                                          <div className="flex flex-col items-center justify-center gap-0.5">
                                                            <span className="text-xs">Oportunidad</span>
                                                            {isExterno && isHighPm && (
                                                              <span className="text-[10px] font-bold text-[#5B4A12] bg-white px-2 py-0.5 rounded-full border border-[#D8C359]">
                                                                ✓ Intersección
                                                              </span>
                                                            )}
                                                          </div>
                                                        </td>
                                                      </tr>

                                                      {/* Fila Pm < 3 */}
                                                      <tr>
                                                        <th
                                                          className={`p-2.5 text-xs font-bold text-left border border-[#D5ECEC] rounded-bl-[12px] transition-colors ${
                                                            isLowPm
                                                              ? 'bg-[#FDE2C8] text-[#7A3E0A] font-extrabold border-r-2 border-[#F7A35F]'
                                                              : 'bg-white text-[#4F6170]'
                                                          }`}
                                                        >
                                                          <div className="flex items-center justify-between">
                                                            <span>Pm &lt; 3</span>
                                                            {isLowPm && (
                                                              <span className="text-[10px] text-[#7A3E0A]">◀</span>
                                                            )}
                                                          </div>
                                                        </th>
                                                        {/* Celda Debilidad */}
                                                        <td
                                                          className={`p-3 border border-[#D5ECEC] transition-all ${
                                                            isInterno && isLowPm
                                                              ? 'bg-[#FDE2C8] font-extrabold text-[#7A3E0A] ring-2 ring-[#F7A35F] shadow-sm'
                                                              : 'bg-white text-[#4F6170]'
                                                          }`}
                                                        >
                                                          <div className="flex flex-col items-center justify-center gap-0.5">
                                                            <span className="text-xs">Debilidad</span>
                                                            {isInterno && isLowPm && (
                                                              <span className="text-[10px] font-bold text-[#7A3E0A] bg-white px-2 py-0.5 rounded-full border border-[#F7A35F]">
                                                                ✓ Intersección
                                                              </span>
                                                            )}
                                                          </div>
                                                        </td>
                                                        {/* Celda Amenaza */}
                                                        <td
                                                          className={`p-3 border border-[#D5ECEC] rounded-br-[12px] transition-all ${
                                                            isExterno && isLowPm
                                                              ? 'bg-[#FADBD0] font-extrabold text-[#721C00] ring-2 ring-[#B84318] shadow-sm'
                                                              : 'bg-white text-[#4F6170]'
                                                          }`}
                                                        >
                                                          <div className="flex flex-col items-center justify-center gap-0.5">
                                                            <span className="text-xs">Amenaza</span>
                                                            {isExterno && isLowPm && (
                                                              <span className="text-[10px] font-bold text-[#721C00] bg-white px-2 py-0.5 rounded-full border border-[#B84318]">
                                                                ✓ Intersección
                                                              </span>
                                                            )}
                                                          </div>
                                                        </td>
                                                      </tr>
                                                    </tbody>
                                                  </table>
                                                </div>

                                                {/* Explicación de la clasificación */}
                                                <div className="text-[11px] text-[#4F6170] bg-white p-2.5 rounded-[12px] border border-[#D5ECEC] flex flex-wrap items-center justify-between gap-2">
                                                  <div>
                                                    <span>Clasificación resultante: </span>
                                                    <strong className="text-[#2B3F4C] font-serif text-xs capitalize">
                                                      {factor.foda_classification || fodaKey}
                                                    </strong>
                                                  </div>
                                                  <span className="text-[10px] font-medium text-[#4F6170]/90">
                                                    {isInterno ? 'Interno' : 'Externo'} +{' '}
                                                    {isHighPm ? 'Pm ≥ 3' : 'Pm < 3'}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Estado vacío si no hay coincidencias con los filtros */}
                {filteredResultsGroups.length === 0 && (
                  <div className="p-8 text-center bg-white rounded-[22px] border border-gray-200 space-y-2">
                    <p className="text-xs font-semibold text-gray-600">
                      No se encontraron factores con los filtros aplicados.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setResultsSearchQuery('');
                        setResultsFodaFilter('Todos');
                      }}
                      className="text-xs font-bold text-[#7FBFC1] hover:underline cursor-pointer"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                )}
              </div>

              {/* ── Tarjeta de Recomendación General (Sin fondo azul, adaptada a la categoría metodológica) ── */}
              {(() => {
                const cat = calculationResult.recommendation.categoria;
                const isNoAdopt = cat === 'C';
                const isAdopt = cat === 'A';

                // Variables de color según categoría
                const containerClass = isNoAdopt
                  ? 'bg-[#FDF2EC] border border-[#F4B89F]'
                  : isAdopt
                  ? 'bg-[#D9F0DC] border border-[#BCE2C2]'
                  : 'bg-[#F9E8A0] border border-[#F2D879]';

                const iconBgClass = isNoAdopt
                  ? 'bg-[#B84318]'
                  : isAdopt
                  ? 'bg-[#1F5A2E]'
                  : 'bg-[#5B4A12]';

                const iconSymbol = isNoAdopt ? '✕' : '✓';

                const labelColor = isNoAdopt
                  ? 'text-[#BD4414]'
                  : isAdopt
                  ? 'text-[#1F5A2E]'
                  : 'text-[#5B4A12]';

                const titleColor = isNoAdopt
                  ? 'text-[#7A280B]'
                  : isAdopt
                  ? 'text-[#1F5A2E]'
                  : 'text-[#5B4A12]';

                const textColor = isNoAdopt
                  ? 'text-[#633526]'
                  : isAdopt
                  ? 'text-[#1F5A2E]'
                  : 'text-[#5B4A12]';

                const btnPrimaryClass = isNoAdopt
                  ? 'bg-[#B84318] hover:bg-[#9E3612] text-white'
                  : isAdopt
                  ? 'bg-[#1F5A2E] hover:bg-[#164724] text-white'
                  : 'bg-[#5B4A12] hover:bg-[#43360D] text-white';

                const btnSecondaryClass = isNoAdopt
                  ? 'bg-white hover:bg-white/80 text-[#B84318] border border-[#B84318]'
                  : isAdopt
                  ? 'bg-white hover:bg-white/80 text-[#1F5A2E] border border-[#1F5A2E]'
                  : 'bg-white hover:bg-white/80 text-[#5B4A12] border border-[#5B4A12]';

                return (
                  <div className={`${containerClass} rounded-[24px] p-6 sm:p-8 space-y-4 shadow-none`}>
                    <div className="flex items-center gap-3.5">
                      <div className={`w-10 h-10 rounded-full ${iconBgClass} flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm`}>
                        {iconSymbol}
                      </div>
                      <div>
                        <span className={`block text-[10px] font-extrabold uppercase tracking-wider ${labelColor}`}>
                          RECOMENDACIÓN {isNoAdopt ? '' : 'GENERAL'}
                        </span>
                        <h3 className={`text-2xl sm:text-3xl font-serif font-bold ${titleColor} tracking-tight`}>
                          {calculationResult.recommendation.titulo || (isNoAdopt ? 'No se debe adoptar' : isAdopt ? 'Adoptar' : 'Es posible adoptar')}
                        </h3>
                      </div>
                    </div>

                    <p className={`text-sm ${textColor} leading-relaxed font-normal`}>
                      {calculationResult.recommendation.texto}
                    </p>

                    {/* Pills de factores críticos desfavorables (Diseño exacto de la imagen 2 del PDF) */}
                    {isNoAdopt &&
                      calculationResult.recommendation.factores_desfavorables_criticos &&
                      calculationResult.recommendation.factores_desfavorables_criticos.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {calculationResult.recommendation.factores_desfavorables_criticos.map((fc, i) => (
                            <span
                              key={i}
                              className="bg-white border border-[#F4B89F] text-[#7A280B] text-xs font-medium px-3.5 py-1 rounded-full shadow-2xs"
                            >
                              {fc.nombre}
                            </span>
                          ))}
                        </div>
                      )}

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleOpenAiRecommendation(false)}
                        className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer flex items-center gap-2 ${btnPrimaryClass}`}
                      >
                        <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                        </svg>
                        <span>Ampliar recomendación con IA</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportPdf}
                        className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer flex items-center gap-2 ${btnSecondaryClass}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Exportar PDF
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── Botones de navegación finales ── */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep('subfactors');
                    if (evaluationId) navigate(`/evaluaciones/${evaluationId}/subfactores`);
                  }}
                  className="px-5 py-2.5 text-xs font-semibold text-[#2B3F4C] bg-white hover:bg-gray-50 border border-gray-200 rounded-[14px] transition cursor-pointer flex items-center gap-2 shadow-none"
                >
                  ← Anterior
                </button>
                {isEvaluationFinalized ? (
                  <div className="px-6 py-2.5 text-xs font-semibold text-[#16303B] bg-[#D5ECEC] rounded-[14px] flex items-center gap-2 cursor-default select-none border border-[#7FBFC1]/30">
                    <svg className="w-4 h-4 text-[#1F7A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Evaluación finalizada</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowFinalizeModal(true)}
                    className="px-6 py-2.5 text-xs font-semibold text-[#1F3340] bg-[#F7A35F] hover:bg-[#EE944D] rounded-[14px] transition shadow-none cursor-pointer flex items-center gap-2"
                  >
                    Finalizar evaluación
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-white rounded-[24px] border border-[#D5ECEC] shadow-none space-y-3">
              <p className="text-sm font-bold text-[#2B3F4C]">Aún no se han calculado los resultados.</p>
              <p className="text-xs text-[#4F6170]">
                Completa la valoración de los subfactores en el paso anterior y presiona «Calcular y Ver Resultados».
              </p>
              <button
                type="button"
                onClick={() => setCurrentStep('subfactors')}
                className="mt-3 px-6 py-2.5 text-xs font-semibold text-[#16303B] bg-[#7FBFC1] hover:bg-[#6FAEB0] rounded-[14px] transition cursor-pointer"
              >
                Ir a Subfactores
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CUADRO DE CONFIRMACIÓN (Modal de Factores Predeterminados)
          ══════════════════════════════════════════════════════════════════════ */}
      {showConfirmationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F3340]/40 backdrop-blur-xs select-none">
          <div className="w-full max-w-lg bg-white rounded-[24px] border border-[#D5ECEC] shadow-none p-6 sm:p-7 space-y-5 animate-in fade-in duration-200">
            {/* Encabezado del Modal */}
            <div className="space-y-1.5">
              <div className="w-10 h-10 rounded-[14px] bg-[#F9E8A0] text-[#5B4A12] flex items-center justify-center font-bold text-lg mb-3">
                !
              </div>
              <h3 className="text-2xl font-serif text-[#2B3F4C] leading-snug">
                Valoraciones pendientes de confirmación
              </h3>
              <p className="text-xs sm:text-sm text-[#4F6170] leading-relaxed">
                Algunos factores conservan la valoración predeterminada de «Irrelevante». Revisa los siguientes factores o confirma si deseas continuar con los valores actuales.
              </p>
            </div>

            {/* Lista dinámica de factores pendientes con etiqueta Predeterminado */}
            <div className="space-y-1.5">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-[#4F6170]">
                Factores con valor del sistema ({pendingConfirmationFactors.length})
              </span>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-[#D5ECEC] rounded-[16px] p-2.5 bg-[#F6F5F3]/50">
                {pendingConfirmationFactors.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-2.5 rounded-[12px] bg-white border border-[#D5ECEC]"
                  >
                    <span className="text-xs font-semibold text-[#2B3F4C] truncate mr-2">
                      {f.name}
                    </span>
                    <span className="text-[10px] font-bold text-[#7A3E0A] bg-[#FDE2C8] px-2 py-0.5 rounded-full shrink-0">
                      Predeterminado
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Acciones del Modal */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCloseConfirmationModal}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#2B3F4C] bg-white hover:bg-[#F6F5F3] border border-[#2B3F4C] rounded-[14px] transition cursor-pointer"
              >
                Revisar factores
              </button>
              <button
                type="button"
                onClick={handleConfirmDefaultsAndContinue}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#16303B] bg-[#7FBFC1] hover:bg-[#6FAEB0] rounded-[14px] transition shadow-none cursor-pointer"
              >
                Continuar con valores predeterminados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CUADRO DE DIÁLOGO: EVALUACIÓN SIN TERMINAR (Borrador más reciente)
          ══════════════════════════════════════════════════════════════════════ */}
      {showDraftModal && unfinishedDraft && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-modal-title"
          aria-describedby="draft-modal-description"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F3340]/40 backdrop-blur-xs select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-white rounded-[24px] border border-[#D5ECEC] shadow-xl p-6 sm:p-7 space-y-5 animate-in fade-in duration-200"
          >
            {/* Botón de cierre (X) para volver al Panel Principal */}
            <button
              type="button"
              onClick={() => {
                setShowDraftModal(false);
                navigate('/dashboard');
              }}
              title="Volver al Panel principal"
              aria-label="Cerrar y volver al Panel principal"
              className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-[#F6F5F3] hover:bg-[#D5ECEC] text-[#4F6170] hover:text-[#16303B] transition-colors flex items-center justify-center cursor-pointer border border-[#D5ECEC]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Encabezado del Modal */}
            <div className="space-y-2 pr-8">
              <div className="w-10 h-10 rounded-[14px] bg-[#F9E8A0] text-[#5B4A12] flex items-center justify-center font-bold text-lg mb-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 id="draft-modal-title" className="text-2xl font-serif text-[#2B3F4C] leading-snug">
                Tienes una evaluación sin terminar
              </h3>
              <p id="draft-modal-description" className="text-xs sm:text-sm text-[#4F6170] leading-relaxed">
                <strong className="text-[#2B3F4C] font-semibold">{unfinishedDraft.name}</strong> ({unfinishedDraft.software_name}), paso {unfinishedDraft.step_number} de 4. ¿Quieres continuar con ella o empezar una nueva? Podrás retomar la anterior más tarde desde el Panel principal.
              </p>
            </div>

            {/* Acciones del Modal */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleStartNew}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#2B3F4C] bg-white hover:bg-[#F6F5F3] border border-[#D5ECEC] rounded-[14px] transition cursor-pointer"
              >
                Empezar nueva
              </button>
              <button
                ref={continueButtonRef}
                type="button"
                onClick={handleContinueDraft}
                className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold text-[#16303B] bg-[#7FBFC1] hover:bg-[#6FAEB0] rounded-[14px] transition shadow-none cursor-pointer"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CUADRO DE DIÁLOGO: CONFIRMAR FINALIZACIÓN DE EVALUACIÓN
          ══════════════════════════════════════════════════════════════════════ */}
      {showFinalizeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="finalize-modal-title"
          aria-describedby="finalize-modal-description"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F3340]/40 backdrop-blur-xs select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-[24px] border border-[#D5ECEC] shadow-xl p-6 sm:p-7 space-y-5 animate-in fade-in duration-200"
          >
            {/* Encabezado del Modal con ícono de advertencia */}
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-[14px] bg-[#FDE2C8] text-[#B8531A] flex items-center justify-center font-bold text-lg mb-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 id="finalize-modal-title" className="text-2xl font-serif text-[#2B3F4C] leading-snug">
                ¿Estás seguro de finalizar la evaluación?
              </h3>
              <p id="finalize-modal-description" className="text-xs sm:text-sm text-[#4F6170] leading-relaxed">
                Una vez finalizada no podrás volverla a editar. Las pestañas de software, factores y subfactores quedarán bloqueadas en modo de solo lectura.
              </p>
            </div>

            {/* Acciones del Modal */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                disabled={isFinalizing}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#2B3F4C] bg-white hover:bg-[#F6F5F3] border border-[#D5ECEC] rounded-[14px] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalize}
                disabled={isFinalizing}
                className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold text-[#1F3340] bg-[#F7A35F] hover:bg-[#EE944D] rounded-[14px] transition shadow-none cursor-pointer flex items-center justify-center gap-2"
              >
                {isFinalizing ? (
                  <>
                    <GuiosProSpinner size="xs" />
                    <span>Finalizando...</span>
                  </>
                ) : (
                  <span>Finalizar evaluación</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AMPLIAR RECOMENDACIÓN CON IA (GROQ) ── */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-[24px] max-w-2xl w-full p-6 sm:p-7 space-y-5 border border-[#D5ECEC] shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header del modal */}
            <div className="flex items-start justify-between gap-4 border-b border-[#D5ECEC]/70 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[16px] bg-[#D5ECEC] flex items-center justify-center text-[#16303B] shrink-0 shadow-2xs">
                  <svg className="w-6 h-6 text-[#16303B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                  </svg>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold tracking-wider text-[#7FBFC1]">
                    Metodología GUIOS • Inteligencia Artificial
                  </span>
                  <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#2B3F4C] tracking-tight">
                    Ampliación de recomendación con IA
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-[#F6F5F3] transition cursor-pointer"
                title="Cerrar modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Pestañas de Navegación */}
            <div className="flex items-center gap-2 border-b border-[#D5ECEC]/60 pb-1">
              <button
                type="button"
                onClick={() => setAiActiveTab('interpretacion')}
                className={`px-4 py-2 rounded-t-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
                  aiActiveTab === 'interpretacion'
                    ? 'bg-[#7FBFC1] text-[#16303B] shadow-2xs'
                    : 'bg-transparent text-[#4F6170] hover:text-[#2B3F4C] hover:bg-[#F6F5F3]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                <span>Interpretación de la recomendación</span>
              </button>

              <button
                type="button"
                onClick={() => setAiActiveTab('factores')}
                className={`px-4 py-2 rounded-t-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
                  aiActiveTab === 'factores'
                    ? 'bg-[#7FBFC1] text-[#16303B] shadow-2xs'
                    : 'bg-transparent text-[#4F6170] hover:text-[#2B3F4C] hover:bg-[#F6F5F3]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <span>Análisis de factores</span>
              </button>
            </div>

            {/* Contenido según el estado: Loading, Error o Datos */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[220px]">
              {aiLoading ? (
                <div className="py-14 flex flex-col items-center justify-center text-center space-y-4">
                  <GuiosProSpinner size="xl" />
                  <div className="space-y-1">
                    <h4 className="text-base font-serif font-bold text-[#2B3F4C]">
                      Analizando resultados con la IA de Groq...
                    </h4>
                    <p className="text-xs text-[#4F6170] max-w-sm">
                      Consultando modelos de IA, procesando la matriz FODA y sintetizando la interpretación según las reglas metodológicas GUIOS.
                    </p>
                  </div>
                </div>
              ) : aiError ? (
                <div className="p-5 rounded-[18px] bg-red-50 border border-red-200 text-red-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-semibold text-sm">No se pudo obtener el análisis con IA</span>
                  </div>
                  <p className="text-xs text-red-700 leading-relaxed">
                    {aiError}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenAiRecommendation(true)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-[12px] transition cursor-pointer"
                  >
                    Reintentar análisis con IA
                  </button>
                </div>
              ) : aiAnalysis ? (
                <>
                  {/* PESTAÑA 1: INTERPRETACIÓN */}
                  {aiActiveTab === 'interpretacion' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="bg-[#F6F5F3] border border-[#D5ECEC] rounded-[18px] p-5 sm:p-6 space-y-3">
                        <div className="flex items-center justify-between gap-2 border-b border-[#D5ECEC]/80 pb-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#D5ECEC] text-[#16303B]">
                            Interpretación metodológica
                          </span>
                          <span className="text-[11px] text-[#4F6170]">
                            Máximo 80 palabras
                          </span>
                        </div>
                        <p className="text-sm text-[#2B3F4C] leading-relaxed font-sans whitespace-pre-line">
                          {aiAnalysis.interpretacion}
                        </p>
                      </div>

                      {/* Nota de orientación metodológica */}
                      <div className="p-3.5 rounded-[14px] bg-[#D5ECEC]/30 border border-[#B4D6D6] text-xs text-[#2B3F4C] flex items-start gap-2.5">
                        <svg className="w-4 h-4 text-[#7FBFC1] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="leading-relaxed">
                          La interpretación sintetiza la decisión de adopción en base a los criterios del sistema y no contradice la recomendación oficial calculada.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA 2: ANÁLISIS DE FACTORES */}
                  {aiActiveTab === 'factores' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="bg-[#F6F5F3] border border-[#D5ECEC] rounded-[18px] p-5 sm:p-6 space-y-3">
                        <div className="flex items-center justify-between gap-2 border-b border-[#D5ECEC]/80 pb-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#F9E8A0] text-[#5B4A12]">
                            Factores más relevantes
                          </span>
                          <span className="text-[11px] text-[#4F6170]">
                            Máximo 120 palabras
                          </span>
                        </div>
                        <p className="text-sm text-[#2B3F4C] leading-relaxed font-sans whitespace-pre-line">
                          {aiAnalysis.analisis_factores}
                        </p>
                      </div>

                      {/* Nota explicativa de factores */}
                      <div className="p-3.5 rounded-[14px] bg-[#D5ECEC]/30 border border-[#B4D6D6] text-xs text-[#2B3F4C] flex items-start gap-2.5">
                        <svg className="w-4 h-4 text-[#7FBFC1] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="leading-relaxed">
                          Este análisis identifica los factores que condicionan la recomendación final según su clasificación FODA, dimensión y resultados de valoración técnica.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer del Modal */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#D5ECEC]/70">
              <div className="text-[11px] text-[#4F6170] flex items-center gap-2">
                {aiAnalysis && (
                  <>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D5ECEC]/60 text-[#16303B] font-mono text-[10px]">
                      {aiAnalysis.modelo_ia}
                    </span>
                    <span>•</span>
                    <span>{new Date(aiAnalysis.fecha_creacion).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {aiAnalysis && !aiLoading && (
                  <button
                    type="button"
                    onClick={() => handleOpenAiRecommendation(true)}
                    className="px-3.5 py-2 text-xs font-semibold text-[#2B3F4C] bg-white hover:bg-[#F6F5F3] border border-[#D5ECEC] rounded-[14px] transition cursor-pointer flex items-center gap-1.5"
                    title="Generar una nueva pasada de análisis con la IA de Groq"
                  >
                    <svg className="w-3.5 h-3.5 text-[#7FBFC1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    <span>Regenerar con IA</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#2B3F4C] hover:bg-[#1E2C35] rounded-[14px] transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Reporte PDF Imprimible (A4, 2 páginas, visible solo en exportación print) ── */}
      {calculationResult && (
        <EvaluationPdfReport
          evaluationName={evaluationName || `Evaluación de ${softwareForm.name || 'Software'}`}
          softwareName={softwareForm.name}
          decisorName={evaluatorName}
          completionDate={formatSpanishDate(evaluationEndDate)}
          organizationName={organizationName}
          fodaCounts={resultsFodaCounts}
          dimensionGroups={groupedResultsByDimension}
          recommendation={calculationResult.recommendation}
        />
      )}
    </div>
  );
};
