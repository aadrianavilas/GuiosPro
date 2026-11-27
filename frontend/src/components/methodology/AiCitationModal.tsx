import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';
import type { DimensionTreeItem, FactorItem } from '@/pages/methodology/DimensionsManagementView';

export interface ScientificDbItem {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface BibliographicReference {
  id?: number;
  titulo: string;
  autores: string;
  anio: number;
  base_datos: string;
  url: string; // Pantalla del resumen del archivo (ej: https://arxiv.org/abs/...)
  pdf_url?: string; // Link directo del archivo PDF (ej: https://arxiv.org/pdf/...pdf)
  resumen?: string; // Resumen/abstract del artículo científico
  doi?: string;
  factor_name?: string;
  factor_id?: number | null;
}

export const getAbstractScreenUrl = (ref?: { url?: string; pdf_url?: string; titulo?: string }): string => {
  if (!ref) return '#';
  if (ref.url && ref.url.includes('arxiv.org/abs/')) return ref.url;
  if (ref.pdf_url && ref.pdf_url.includes('arxiv.org/pdf/')) {
    return ref.pdf_url.replace('/pdf/', '/abs/').replace('.pdf', '');
  }
  if (ref.url && !ref.url.includes('doi.org')) return ref.url;
  return ref.titulo ? `https://scholar.google.com/scholar?q=${encodeURIComponent(ref.titulo)}` : '#';
};

export const getPdfFileUrl = (ref?: { url?: string; pdf_url?: string }): string | null => {
  if (!ref) return null;
  if (ref.pdf_url) return ref.pdf_url;
  if (ref.url && ref.url.includes('arxiv.org/abs/')) {
    return ref.url.replace('/abs/', '/pdf/') + '.pdf';
  }
  return null;
};

export const getAccessibleArticleUrl = (ref?: { url?: string; pdf_url?: string; titulo?: string }): string => {
  return getAbstractScreenUrl(ref);
};

export interface AiCitationResultItem {
  factor_id: number;
  factor_name: string;
  total_citations: number;
  status: string;
  referencias?: BibliographicReference[];
}

interface AiCitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  dimensions: DimensionTreeItem[];
  onApplySuccess: () => void;
}

type Step = 1 | 2 | 3 | 4;

export const AiCitationModal: React.FC<AiCitationModalProps> = ({
  isOpen,
  onClose,
  dimensions,
  onApplySuccess,
}) => {
  const toast = useToast();

  // Paso actual (1: Factores, 2: Periodo y Bases, 3: Resumen, 4: Resultados)
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // ── PASO 1: Selección de Factores ──
  const [factorSearch, setFactorSearch] = useState<string>('');
  const [dimensionFilter, setDimensionFilter] = useState<string>('all');
  const [selectedFactorIds, setSelectedFactorIds] = useState<number[]>([]);
  const [isDragOverFactors, setIsDragOverFactors] = useState<boolean>(false);

  // ── PASO 2: Periodo y Bases Científicas ──
  const [startPeriod, setStartPeriod] = useState<string>('2020-01-01');
  const [endPeriod, setEndPeriod] = useState<string>('2025-12-31');
  const [scientificDatabases, setScientificDatabases] = useState<ScientificDbItem[]>([]);
  const [dbSearch, setDbSearch] = useState<string>('');
  const [selectedDbNames, setSelectedDbNames] = useState<string[]>([
    'Scopus',
    'IEEE Xplore',
    'Web of Science',
    'ScienceDirect',
  ]);
  const [isDragOverDbs, setIsDragOverDbs] = useState<boolean>(false);

  // ── PASO 3 y 4: Carga, Consulta y Resultados ──
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [queryId, setQueryId] = useState<number | null>(null);
  const [resultsList, setResultsList] = useState<AiCitationResultItem[]>([]);
  const [allReferences, setAllReferences] = useState<BibliographicReference[]>([]);
  const [selectedResultFactorId, setSelectedResultFactorId] = useState<number | null>(null);
  const [resultTab, setResultTab] = useState<'factors' | 'references'>('factors');
  const [refSearch, setRefSearch] = useState<string>('');
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // Cargar bases de datos científicas desde el backend al abrir
  useEffect(() => {
    if (!isOpen) return;

    const fetchDatabases = async () => {
      try {
        const res = await fetch('/api/v1/methodology/scientific-databases/', {
          credentials: 'include',
        });
        if (res.ok) {
          const data: ScientificDbItem[] = await res.json();
          setScientificDatabases(data);
          if (data.length > 0 && selectedDbNames.length === 0) {
            setSelectedDbNames(data.map((d) => d.name));
          }
        }
      } catch (err) {
        console.error('Error cargando bases científicas:', err);
      }
    };

    fetchDatabases();
  }, [isOpen]);

  // Lista plana de todos los factores disponibles con referencia a su dimensión
  const allFactors = useMemo(() => {
    const list: Array<{ factor: FactorItem; dimensionName: string; dimensionId: number }> = [];
    dimensions.forEach((dim) => {
      (dim.factors || []).forEach((f) => {
        list.push({
          factor: f,
          dimensionName: dim.name,
          dimensionId: dim.id,
        });
      });
    });
    return list;
  }, [dimensions]);

  // Factores disponibles para arrastrar (excluyendo los ya seleccionados)
  const availableFactors = useMemo(() => {
    return allFactors.filter((item) => {
      if (selectedFactorIds.includes(item.factor.id)) return false;

      if (dimensionFilter !== 'all' && String(item.dimensionId) !== dimensionFilter) {
        return false;
      }

      if (factorSearch.trim()) {
        const query = factorSearch.toLowerCase().trim();
        const fName = item.factor.name.toLowerCase();
        const dName = item.dimensionName.toLowerCase();
        return fName.includes(query) || dName.includes(query);
      }

      return true;
    });
  }, [allFactors, selectedFactorIds, dimensionFilter, factorSearch]);

  // Factores seleccionados ordenados
  const selectedFactors = useMemo(() => {
    return allFactors.filter((item) => selectedFactorIds.includes(item.factor.id));
  }, [allFactors, selectedFactorIds]);

  // Bases de datos disponibles (excluyendo seleccionadas)
  const availableDatabases = useMemo(() => {
    return scientificDatabases.filter((db) => {
      if (selectedDbNames.includes(db.name)) return false;
      if (dbSearch.trim()) {
        const q = dbSearch.toLowerCase().trim();
        return db.name.toLowerCase().includes(q) || (db.description || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [scientificDatabases, selectedDbNames, dbSearch]);

  // Factor de resultados seleccionado para inspeccionar sus referencias
  const selectedResultFactor = useMemo(() => {
    if (!selectedResultFactorId) return resultsList[0] || null;
    return resultsList.find((item) => item.factor_id === selectedResultFactorId) || resultsList[0] || null;
  }, [resultsList, selectedResultFactorId]);

  // Referencias globales filtradas por buscador
  const filteredAllReferences = useMemo(() => {
    const q = refSearch.trim().toLowerCase();
    if (!q) return allReferences;
    return allReferences.filter(
      (r) =>
        r.titulo?.toLowerCase().includes(q) ||
        r.autores?.toLowerCase().includes(q) ||
        r.base_datos?.toLowerCase().includes(q) ||
        r.factor_name?.toLowerCase().includes(q)
    );
  }, [allReferences, refSearch]);

  // ── Drag & Drop Handlers para Factores ──
  const handleDragStartFactor = (e: React.DragEvent, factorId: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'factor', id: factorId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropFactor = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverFactors(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'factor' && typeof data.id === 'number') {
        if (!selectedFactorIds.includes(data.id)) {
          setSelectedFactorIds((prev) => [...prev, data.id]);
        }
      }
    } catch (err) {
      console.warn('Error en drop de factor:', err);
    }
  };

  const addFactor = (factorId: number) => {
    if (!selectedFactorIds.includes(factorId)) {
      setSelectedFactorIds((prev) => [...prev, factorId]);
    }
  };

  const removeFactor = (factorId: number) => {
    setSelectedFactorIds((prev) => prev.filter((id) => id !== factorId));
  };

  const selectAllFactors = () => {
    setSelectedFactorIds(allFactors.map((f) => f.factor.id));
  };

  const clearSelectedFactors = () => {
    setSelectedFactorIds([]);
  };

  // ── Drag & Drop Handlers para Bases Científicas ──
  const handleDragStartDb = (e: React.DragEvent, dbName: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'db', name: dbName }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropDb = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDbs(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'db' && data.name) {
        if (!selectedDbNames.includes(data.name)) {
          setSelectedDbNames((prev) => [...prev, data.name]);
        }
      }
    } catch (err) {
      console.warn('Error en drop de base de datos:', err);
    }
  };

  const addDb = (dbName: string) => {
    if (!selectedDbNames.includes(dbName)) {
      setSelectedDbNames((prev) => [...prev, dbName]);
    }
  };

  const removeDb = (dbName: string) => {
    setSelectedDbNames((prev) => prev.filter((name) => name !== dbName));
  };

  const selectAllDbs = () => {
    setSelectedDbNames(scientificDatabases.map((db) => db.name));
  };

  // ── Ejecutar Consulta a la IA ──
  const handleExecuteAiQuery = async () => {
    if (selectedFactorIds.length === 0) {
      toast.warning('Selecciona al menos un factor para consultar.');
      return;
    }
    if (selectedDbNames.length === 0) {
      toast.warning('Selecciona al menos una base de datos científica.');
      return;
    }

    try {
      setIsQuerying(true);
      const res = await fetch('/api/v1/methodology/ai-citations/query/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          start_period: startPeriod,
          end_period: endPeriod,
          database_names: selectedDbNames,
          factor_ids: selectedFactorIds,
        }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.resultados)) {
        setQueryId(data.query_id || null);
        setResultsList(data.resultados);
        const allRefs: BibliographicReference[] = Array.isArray(data.todas_las_referencias) && data.todas_las_referencias.length > 0
          ? data.todas_las_referencias
          : data.resultados.flatMap((item: any) =>
              (item.referencias || []).map((r: any) => ({
                ...r,
                factor_name: item.factor_name,
                factor_id: item.factor_id,
              }))
            );
        setAllReferences(allRefs);
        if (data.resultados.length > 0) {
          setSelectedResultFactorId(data.resultados[0].factor_id);
        }
        setResultTab('factors');
        setCurrentStep(4);
        toast.success('Búsqueda bibliográfica completada exitosamente por la IA.');
      } else {
        const errorMsg = data?.error || data?.message || 'Error al consultar la IA. Revisa las credenciales de Groq.';
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error('Error al ejecutar consulta de IA:', err);
      toast.error('Ocurrió un error al conectar con el servidor.');
    } finally {
      setIsQuerying(false);
    }
  };

  // ── Aplicar Resultados a los Factores en BD ──
  const handleApplyResults = async () => {
    if (resultsList.length === 0) return;

    try {
      setIsApplying(true);
      const factorsPayload = resultsList.map((item) => ({
        factor_id: item.factor_id,
        total_citations: item.total_citations,
      }));

      const res = await fetch('/api/v1/methodology/ai-citations/apply/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query_id: queryId,
          factors: factorsPayload,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(
          `Se actualizaron ${data.updated_count || factorsPayload.length} factores correctamente y se recalculó la importancia metodológica.`
        );
        onApplySuccess();
        handleClose();
      } else {
        toast.error(data?.error || data?.message || 'Error al aplicar las citas a los factores.');
      }
    } catch (err: any) {
      console.error('Error aplicando citas:', err);
      toast.error('No se pudieron aplicar los cambios.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setSelectedFactorIds([]);
    setIsQuerying(false);
    setIsApplying(false);
    setResultsList([]);
    setAllReferences([]);
    setSelectedResultFactorId(null);
    setResultTab('factors');
    setRefSearch('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-xs animate-fade-in font-sans">
      <div className="bg-white rounded-[24px] max-w-4xl w-full p-6 sm:p-7 space-y-6 border border-[#D5ECEC] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* ── Encabezado del Modal con Indicador de Pasos ── */}
        <div className="flex items-center justify-between border-b border-[#D5ECEC]/80 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F7A35F]/20 border border-[#F7A35F]/40 flex items-center justify-center text-[#B8531A] shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#2B3F4C] leading-tight">
                {currentStep === 4 ? 'Total de citas' : 'Consultar con IA total de citas'}
              </h2>
              <p className="text-xs text-[#4F6170] mt-0.5">
                {currentStep === 1 && 'Paso 1: Selecciona los factores a investigar'}
                {currentStep === 2 && 'Paso 2: Periodo y bases de datos científicas'}
                {currentStep === 3 && 'Paso 3: Confirma el resumen antes de consultar'}
                {currentStep === 4 && 'Paso 4: Revisa y aplica los totales de citas calculados'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isQuerying || isApplying}
            className="text-gray-400 hover:text-[#2B3F4C] p-2 rounded-xl hover:bg-gray-100 transition cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── CUERPO DEL MODAL (SEGÚN EL PASO) ── */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* ══════════════════════════════════════════════════════════════════
              PASO 1: SELECCIÓN DE FACTORES (DRAG & DROP)
              ══════════════════════════════════════════════════════════════════ */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ── Columna Izquierda: Factores Disponibles ── */}
                <div className="bg-[#F8F9FA] border border-gray-200 rounded-[18px] p-4 flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#2B3F4C]">
                      Factores disponibles ({availableFactors.length})
                    </span>
                    {availableFactors.length > 0 && (
                      <button
                        type="button"
                        onClick={selectAllFactors}
                        className="text-[11px] font-semibold text-[#B8531A] hover:underline cursor-pointer"
                      >
                        Seleccionar todos
                      </button>
                    )}
                  </div>

                  {/* Buscador y Filtro por Dimensión */}
                  <div className="space-y-2">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.15z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={factorSearch}
                        onChange={(e) => setFactorSearch(e.target.value)}
                        placeholder="Buscar factor..."
                        className="w-full pl-9 pr-3 py-2 bg-white rounded-xl text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition"
                      />
                    </div>

                    <select
                      value={dimensionFilter}
                      onChange={(e) => setDimensionFilter(e.target.value)}
                      className="w-full py-1.5 px-3 bg-white rounded-xl text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition"
                    >
                      <option value="all">Todas las dimensiones</option>
                      {dimensions.map((dim) => (
                        <option key={dim.id} value={dim.id}>
                          {dim.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Lista de Cards de Factores Disponibles */}
                  <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1">
                    {availableFactors.length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-400 font-medium">
                        {factorSearch ? 'No se encontraron factores con ese nombre.' : 'Todos los factores han sido seleccionados.'}
                      </div>
                    ) : (
                      availableFactors.map(({ factor, dimensionName }) => (
                        <div
                          key={factor.id}
                          draggable
                          onDragStart={(e) => handleDragStartFactor(e, factor.id)}
                          className="bg-white border border-gray-200 hover:border-[#7FBFC1] rounded-[14px] p-2.5 flex items-center justify-between gap-2 shadow-2xs hover:shadow-xs transition cursor-grab active:cursor-grabbing select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Drag handle matrix */}
                            <span className="text-gray-300 hover:text-gray-500 font-mono text-sm leading-none shrink-0">
                              ⋮⋮
                            </span>
                            <div className="min-w-0">
                              <span className="block text-xs font-bold text-[#243642] truncate">
                                {factor.name}
                              </span>
                              <span className="block text-[10px] text-gray-400 font-medium truncate">
                                {dimensionName}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => addFactor(factor.id)}
                            title="Agregar a la consulta"
                            className="w-6 h-6 rounded-lg bg-[#D5ECEC] hover:bg-[#7FBFC1] text-[#16303B] flex items-center justify-center text-xs font-bold transition shrink-0 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* ── Columna Derecha: Dropzone de Factores Seleccionados ── */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOverFactors(true);
                  }}
                  onDragLeave={() => setIsDragOverFactors(false)}
                  onDrop={handleDropFactor}
                  className={`border-2 border-dashed rounded-[18px] p-4 flex flex-col justify-between transition-colors ${
                    isDragOverFactors
                      ? 'border-[#F7A35F] bg-[#FFF8F3]'
                      : selectedFactors.length > 0
                      ? 'border-[#B4D6D6] bg-white'
                      : 'border-gray-200 bg-[#FAF9F8]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#2B3F4C]">
                        Factores a consultar con IA ({selectedFactors.length})
                      </span>
                      {selectedFactors.length > 0 && (
                        <button
                          type="button"
                          onClick={clearSelectedFactors}
                          className="text-[11px] font-semibold text-gray-400 hover:text-red-600 transition cursor-pointer"
                        >
                          Quitar todos
                        </button>
                      )}
                    </div>

                    {selectedFactors.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-14 text-center space-y-2 select-none">
                        <div className="w-12 h-12 rounded-full bg-[#F7A35F]/15 text-[#B8531A] flex items-center justify-center">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                          </svg>
                        </div>
                        <p className="text-sm font-bold text-[#2B3F4C]">
                          Arrastra los factores para la IA
                        </p>
                        <p className="text-xs text-gray-400 max-w-xs">
                          Arrastra las tarjetas desde la columna izquierda o haz clic en el botón (+) para agregarlos a la búsqueda.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1">
                        {selectedFactors.map(({ factor, dimensionName }) => (
                          <div
                            key={factor.id}
                            className="bg-[#FFFBF8] border border-[#F9D0BC] rounded-[14px] p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="min-w-0">
                              <span className="block text-xs font-bold text-[#7A3618] truncate">
                                {factor.name}
                              </span>
                              <span className="block text-[10px] text-gray-400 font-medium truncate">
                                {dimensionName}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFactor(factor.id)}
                              title="Remover"
                              className="w-6 h-6 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition shrink-0 cursor-pointer text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 text-right">
                    <span className="text-[11px] text-gray-400 font-medium">
                      {selectedFactors.length} {selectedFactors.length === 1 ? 'factor listo' : 'factores listos'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              PASO 2: PERIODO Y BASES CIENTÍFICAS
              ══════════════════════════════════════════════════════════════════ */}
          {currentStep === 2 && (
            <div className="space-y-5">
              {/* Sección Periodo de Búsqueda */}
              <div className="bg-[#F8F9FA] border border-gray-200 rounded-[18px] p-4 space-y-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#2B3F4C]">
                    Periodo de consulta
                  </h3>
                  <p className="text-xs text-[#4F6170] mt-0.5">
                    Establece el intervalo de publicación de los artículos científicos a contabilizar (fechas inclusivas).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#2B3F4C] mb-1">
                      Fecha de inicio (dd/mm/aaaa)
                    </label>
                    <input
                      type="date"
                      value={startPeriod}
                      onChange={(e) => setStartPeriod(e.target.value)}
                      className="w-full py-2 px-3 bg-white rounded-xl text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#2B3F4C] mb-1">
                      Fecha de fin (dd/mm/aaaa)
                    </label>
                    <input
                      type="date"
                      value={endPeriod}
                      onChange={(e) => setEndPeriod(e.target.value)}
                      className="w-full py-2 px-3 bg-white rounded-xl text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition"
                    />
                  </div>
                </div>
              </div>

              {/* Sección Bases de Datos Científicas (Drag & Drop) */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-serif text-lg font-bold text-[#2B3F4C]">
                    Bases de datos científicas
                  </h3>
                  <span className="text-xs text-gray-400 font-medium">
                    {selectedDbNames.length} seleccionadas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bases Disponibles */}
                  <div className="bg-[#F8F9FA] border border-gray-200 rounded-[18px] p-4 flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#2B3F4C]">
                        Disponibles ({availableDatabases.length})
                      </span>
                      {availableDatabases.length > 0 && (
                        <button
                          type="button"
                          onClick={selectAllDbs}
                          className="text-[11px] font-semibold text-[#B8531A] hover:underline cursor-pointer"
                        >
                          Seleccionar todas
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={dbSearch}
                      onChange={(e) => setDbSearch(e.target.value)}
                      placeholder="Buscar base científica..."
                      className="w-full py-1.5 px-3 bg-white rounded-xl text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition"
                    />

                    <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1">
                      {availableDatabases.length === 0 ? (
                        <div className="p-5 text-center text-xs text-gray-400 font-medium">
                          {dbSearch ? 'No se encontraron coincidencias.' : 'Todas las bases están seleccionadas.'}
                        </div>
                      ) : (
                        availableDatabases.map((db) => (
                          <div
                            key={db.id}
                            draggable
                            onDragStart={(e) => handleDragStartDb(e, db.name)}
                            className="bg-white border border-gray-200 hover:border-[#7FBFC1] rounded-[14px] p-2.5 flex items-center justify-between gap-2 shadow-2xs hover:shadow-xs transition cursor-grab active:cursor-grabbing select-none"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-gray-300 font-mono text-sm leading-none shrink-0">
                                ⋮⋮
                              </span>
                              <div className="min-w-0">
                                <span className="block text-xs font-bold text-[#243642] truncate">
                                  {db.name}
                                </span>
                                {db.description && (
                                  <span className="block text-[10px] text-gray-400 truncate">
                                    {db.description}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => addDb(db.name)}
                              className="w-6 h-6 rounded-lg bg-[#D5ECEC] hover:bg-[#7FBFC1] text-[#16303B] flex items-center justify-center text-xs font-bold transition shrink-0 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Dropzone de Bases Científicas */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOverDbs(true);
                    }}
                    onDragLeave={() => setIsDragOverDbs(false)}
                    onDrop={handleDropDb}
                    className={`border-2 border-dashed rounded-[18px] p-4 flex flex-col justify-between transition-colors ${
                      isDragOverDbs
                        ? 'border-[#F7A35F] bg-[#FFF8F3]'
                        : selectedDbNames.length > 0
                        ? 'border-[#B4D6D6] bg-white'
                        : 'border-gray-200 bg-[#FAF9F8]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#2B3F4C]">
                          Bases a consultar ({selectedDbNames.length})
                        </span>
                        {selectedDbNames.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedDbNames([])}
                            className="text-[11px] font-semibold text-gray-400 hover:text-red-600 transition cursor-pointer"
                          >
                            Quitar todas
                          </button>
                        )}
                      </div>

                      {selectedDbNames.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 select-none">
                          <p className="text-sm font-bold text-[#2B3F4C]">
                            Arrastra las bases científicas para la IA
                          </p>
                          <p className="text-xs text-gray-400 max-w-xs">
                            Ejemplo: Scopus, IEEE Xplore, Web of Science, ScienceDirect.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1">
                          {selectedDbNames.map((dbName) => (
                            <div
                              key={dbName}
                              className="bg-[#FFFBF8] border border-[#F9D0BC] rounded-[14px] p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                            >
                              <span className="text-xs font-bold text-[#7A3618] truncate">
                                {dbName}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeDb(dbName)}
                                className="w-6 h-6 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition shrink-0 cursor-pointer text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              PASO 3: RESUMEN ANTES DE CONSULTAR A LA IA
              ══════════════════════════════════════════════════════════════════ */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="bg-[#D5ECEC]/30 border border-[#B4D6D6] rounded-[20px] p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">✨</span>
                  <h3 className="font-serif text-lg font-bold text-[#2B3F4C]">
                    Resumen de la consulta a realizar
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Periodo */}
                  <div className="bg-white rounded-[14px] p-3.5 border border-gray-200">
                    <span className="text-gray-400 font-bold block mb-1 uppercase tracking-wider text-[10px]">
                      Periodo de búsqueda
                    </span>
                    <span className="font-bold text-[#243642] text-sm">
                      {startPeriod} al {endPeriod}
                    </span>
                  </div>

                  {/* Bases Científicas */}
                  <div className="bg-white rounded-[14px] p-3.5 border border-gray-200">
                    <span className="text-gray-400 font-bold block mb-1 uppercase tracking-wider text-[10px]">
                      Bases científicas ({selectedDbNames.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedDbNames.map((name) => (
                        <span key={name} className="bg-[#D5ECEC] text-[#16303B] px-2 py-0.5 rounded-full text-[11px] font-bold">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Factores */}
                <div className="bg-white rounded-[14px] p-4 border border-gray-200 space-y-2">
                  <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">
                    Factores a investigar ({selectedFactors.length})
                  </span>
                  <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {selectedFactors.map(({ factor, dimensionName }) => (
                      <span
                        key={factor.id}
                        className="bg-[#F8F9FA] border border-gray-200 text-[#243642] px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
                      >
                        <span>{factor.name}</span>
                        <span className="text-[10px] text-gray-400 font-normal">({dimensionName})</span>
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-[#4F6170] leading-relaxed">
                  Al presionar <strong>«Consultar con IA»</strong>, el sistema enviará la solicitud al servicio de Groq
                  utilizando modelos de alta capacidad con fallback automático. Los resultados incluirán el conteo de artículos únicos verificados para cada factor.
                </p>
              </div>

              {isQuerying && (
                <div className="bg-[#FFF8F3] border border-[#F7A35F] rounded-[18px] p-6 text-center space-y-3">
                  <div className="flex flex-col items-center justify-center gap-3 text-[#B8531A]">
                    <GuiosProSpinner size="lg" />
                    <span className="font-bold text-sm">Consultando con IA... Por favor espera unos momentos</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Analizando artículos científicos y eliminando duplicados según los lineamientos metodológicos.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              PASO 4: RESULTADOS (TOTAL DE CITAS Y REFERENCIAS BIBLIOGRÁFICAS)
              ══════════════════════════════════════════════════════════════════ */}
          {currentStep === 4 && (
            <div className="space-y-4">
              {/* Pestañas de Navegación en Resultados */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setResultTab('factors')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      resultTab === 'factors'
                        ? 'bg-[#243642] text-white shadow-xs'
                        : 'bg-[#F6F5F3] text-[#4F6170] hover:bg-[#D5ECEC]/50 hover:text-[#243642]'
                    }`}
                  >
                    <span>Factores y Citas</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        resultTab === 'factors' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {resultsList.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResultTab('references')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      resultTab === 'references'
                        ? 'bg-[#243642] text-white shadow-xs'
                        : 'bg-[#F6F5F3] text-[#4F6170] hover:bg-[#D5ECEC]/50 hover:text-[#243642]'
                    }`}
                  >
                    <span>Referencias Bibliográficas</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        resultTab === 'references' ? 'bg-white/20 text-white' : 'bg-[#D5ECEC] text-[#16303B]'
                      }`}
                    >
                      {allReferences.length}
                    </span>
                  </button>
                </div>

                <span className="text-[11px] text-[#4F6170]">
                  {resultTab === 'factors'
                    ? 'Haz clic sobre un factor para ver sus fuentes abajo'
                    : 'Todas las fuentes bibliográficas consultadas por la IA'}
                </span>
              </div>

              {/* ── Vista Factores y Citas (con detalle al dar clic) ── */}
              {resultTab === 'factors' && (
                <div className="space-y-4">
                  <div className="bg-[#D5ECEC]/30 border border-[#B4D6D6] rounded-[18px] p-3 flex items-center justify-between text-xs text-[#16303B]">
                    <span>
                      ✓ <strong>{resultsList.length} factores</strong> investigados. Haz clic en cualquier fila para inspeccionar sus artículos científicos abajo.
                    </span>
                    <span className="text-[11px] text-gray-500 hidden sm:inline">
                      Se aplicarán al presionar «Aplicar».
                    </span>
                  </div>

                  {/* Tabla interactiva de Factores */}
                  <div className="border border-gray-200 rounded-[18px] overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#D5ECEC] text-[#243642] text-[11px] font-bold tracking-wider uppercase border-b border-[#B8DFE0]">
                          <th className="py-3 px-5 font-semibold">FACTOR</th>
                          <th className="py-3 px-5 font-semibold text-center">ESTADO</th>
                          <th className="py-3 px-5 font-semibold text-right">TOTAL CITAS (TC)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {resultsList.map((item) => {
                          const isSelected = selectedResultFactorId === item.factor_id;
                          return (
                            <tr
                              key={item.factor_id}
                              onClick={() => setSelectedResultFactorId(item.factor_id)}
                              className={`transition cursor-pointer ${
                                isSelected
                                  ? 'bg-[#EBF7F7] border-l-4 border-l-[#7FBFC1]'
                                  : 'hover:bg-gray-50/70'
                              }`}
                            >
                              <td className="py-3.5 px-5">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      isSelected ? 'bg-[#7FBFC1]' : 'bg-transparent'
                                    }`}
                                  />
                                  <span className="font-bold text-xs text-[#243642]">
                                    {item.factor_name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D9F0DC] text-[#1F5A2E]">
                                  {item.status === 'valid' ? 'Válido' : item.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <span className="inline-block px-3 py-1 font-serif font-bold text-base text-[#243642] bg-[#F6F5F3] rounded-lg border border-gray-200">
                                  {item.total_citations}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Panel inferior de referencias bibliográficas del factor seleccionado */}
                  {selectedResultFactor && (
                    <div className="bg-[#F6F5F3] border border-[#D5ECEC] rounded-[20px] p-4.5 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-[#D5ECEC] pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📚</span>
                          <div>
                            <h4 className="font-bold text-xs text-[#243642]">
                              Referencias bibliográficas de:{' '}
                              <span className="text-[#B8421A]">{selectedResultFactor.factor_name}</span>
                            </h4>
                            <p className="text-[10px] text-[#4F6170]">
                              {selectedResultFactor.total_citations} artículos científicos consultados indexados en bases seleccionadas
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold bg-[#D5ECEC] text-[#16303B] px-2.5 py-1 rounded-full">
                          {selectedResultFactor.referencias?.length || 0} registradas
                        </span>
                      </div>

                      {(!selectedResultFactor.referencias || selectedResultFactor.referencias.length === 0) ? (
                        <p className="text-xs text-gray-400 italic py-3 text-center">
                          No se registraron referencias bibliográficas detalladas para este factor.
                        </p>
                      ) : (
                        <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                          {selectedResultFactor.referencias.map((ref, idx) => (
                            <div
                              key={ref.id || idx}
                              className="bg-white rounded-[14px] p-3 border border-gray-200/90 shadow-2xs hover:border-[#7FBFC1] transition space-y-1.5"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <h5 className="font-bold text-xs text-[#243642] leading-snug flex-1">
                                  <span className="text-gray-400 font-mono text-[10px] mr-1.5">[{idx + 1}]</span>
                                  {ref.titulo}
                                </h5>
                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                  {getPdfFileUrl(ref) && (
                                    <a
                                      href={getPdfFileUrl(ref)!}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#B8421A] hover:bg-[#9B3714] rounded-lg transition shadow-2xs cursor-pointer"
                                      title="Abrir directamente el archivo PDF del artículo"
                                    >
                                      <span>📄 Ver archivo (PDF)</span>
                                      <span className="text-[10px]">↗</span>
                                    </a>
                                  )}
                                  <a
                                    href={getAbstractScreenUrl(ref)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#1F3340] bg-[#D5ECEC] hover:bg-[#7FBFC1] hover:text-white rounded-lg transition shadow-2xs cursor-pointer"
                                    title="Abrir la pantalla oficial con el resumen del archivo"
                                  >
                                    <span>📑 Pantalla de resumen</span>
                                    <span className="text-[10px]">↗</span>
                                  </a>
                                </div>
                              </div>
                              {ref.resumen && (
                                <p className="text-[11px] text-[#4F6170] bg-[#F6F5F3] p-2 rounded-lg border border-[#D5ECEC]/70 leading-relaxed italic">
                                  <strong className="text-[#243642] not-italic font-semibold">Resumen: </strong>
                                  {ref.resumen}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
                                <span className="font-medium text-gray-700">Autores: {ref.autores}</span>
                                <span className="text-gray-300">•</span>
                                <span className="font-semibold text-[#B8421A]">Año: {ref.anio}</span>
                                <span className="text-gray-300">•</span>
                                <span className="inline-block bg-[#F9E8A0]/60 text-[#5B4A12] px-2 py-0.5 rounded-md font-bold text-[10px]">
                                  {ref.base_datos}
                                </span>
                                {ref.doi && (
                                  <>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-gray-400 text-[10px] font-mono">DOI: {ref.doi}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Vista Pestaña de Todas las Referencias Bibliográficas ── */}
              {resultTab === 'references' && (
                <div className="space-y-3 animate-fade-in">
                  <div className="relative">
                    <input
                      type="text"
                      value={refSearch}
                      onChange={(e) => setRefSearch(e.target.value)}
                      placeholder="Buscar por título, autor, base de datos o factor..."
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-[12px] focus:outline-none focus:border-[#7FBFC1] bg-white text-[#243642]"
                    />
                    <svg
                      className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>

                  <div className="text-[11px] text-[#4F6170] flex items-center justify-between">
                    <span>
                      Mostrando {filteredAllReferences.length} de {allReferences.length} referencias bibliográficas
                    </span>
                  </div>

                  {filteredAllReferences.length === 0 ? (
                    <div className="bg-gray-50 rounded-[14px] p-6 text-center text-xs text-gray-400">
                      No se encontraron referencias que coincidan con la búsqueda.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {filteredAllReferences.map((ref, idx) => (
                        <div
                          key={ref.id || idx}
                          className="bg-white rounded-[14px] p-3 border border-gray-200 hover:border-[#7FBFC1] transition space-y-1.5 shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h5 className="font-bold text-xs text-[#243642] leading-snug flex-1">
                              <span className="text-gray-400 font-mono text-[10px] mr-1.5">[{idx + 1}]</span>
                              {ref.titulo}
                            </h5>
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                              {getPdfFileUrl(ref) && (
                                <a
                                  href={getPdfFileUrl(ref)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#B8421A] hover:bg-[#9B3714] rounded-lg transition shadow-2xs cursor-pointer"
                                  title="Abrir directamente el archivo PDF del artículo"
                                >
                                  <span>📄 Ver archivo (PDF)</span>
                                  <span className="text-[10px]">↗</span>
                                </a>
                              )}
                              <a
                                href={getAbstractScreenUrl(ref)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#1F3340] bg-[#D5ECEC] hover:bg-[#7FBFC1] hover:text-white rounded-lg transition shadow-2xs cursor-pointer"
                                title="Abrir la pantalla oficial con el resumen del archivo"
                              >
                                <span>📑 Pantalla de resumen</span>
                                <span className="text-[10px]">↗</span>
                              </a>
                            </div>
                          </div>
                          {ref.resumen && (
                            <p className="text-[11px] text-[#4F6170] bg-[#F6F5F3] p-2 rounded-lg border border-[#D5ECEC]/70 leading-relaxed italic">
                              <strong className="text-[#243642] not-italic font-semibold">Resumen: </strong>
                              {ref.resumen}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
                            {ref.factor_name && (
                              <span className="bg-[#D5ECEC]/70 text-[#16303B] px-2 py-0.5 rounded-full text-[10px] font-bold">
                                Factor: {ref.factor_name}
                              </span>
                            )}
                            <span className="font-medium text-gray-700">Autores: {ref.autores}</span>
                            <span className="text-gray-300">•</span>
                            <span className="font-semibold text-[#B8421A]">Año: {ref.anio}</span>
                            <span className="text-gray-300">•</span>
                            <span className="inline-block bg-[#F9E8A0]/60 text-[#5B4A12] px-2 py-0.5 rounded-md font-bold text-[10px]">
                              {ref.base_datos}
                            </span>
                            {ref.doi && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span className="text-gray-400 text-[10px] font-mono">DOI: {ref.doi}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── BOTONES DE ACCIÓN INFERIORES ── */}
        <div className="flex items-center justify-between border-t border-[#D5ECEC]/80 pt-4 shrink-0">
          <div>
            {currentStep > 1 && currentStep < 4 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as Step)}
                disabled={isQuerying}
                className="px-5 py-2.5 text-xs font-semibold text-[#2B3F4C] bg-white hover:bg-gray-50 border border-gray-200 rounded-[14px] transition cursor-pointer"
              >
                ← Atrás
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isQuerying || isApplying}
              className="px-5 py-2.5 text-xs font-semibold text-[#2B3F4C] bg-white hover:bg-gray-50 border border-gray-200 rounded-[14px] transition cursor-pointer"
            >
              Cancelar
            </button>

            {currentStep === 1 && (
              <button
                type="button"
                onClick={() => {
                  if (selectedFactorIds.length === 0) {
                    toast.warning('Selecciona al menos un factor antes de continuar.');
                    return;
                  }
                  setCurrentStep(2);
                }}
                disabled={selectedFactorIds.length === 0}
                className="px-6 py-2.5 text-xs font-semibold text-[#16303B] bg-[#7FBFC1] hover:bg-[#6FAEB0] disabled:opacity-50 disabled:cursor-not-allowed rounded-[14px] transition shadow-none cursor-pointer flex items-center gap-1.5"
              >
                <span>Siguiente</span>
                <span>→</span>
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                onClick={() => {
                  if (selectedDbNames.length === 0) {
                    toast.warning('Selecciona al menos una base de datos científica.');
                    return;
                  }
                  if (!startPeriod || !endPeriod || startPeriod > endPeriod) {
                    toast.warning('Verifica que el periodo de fechas sea válido.');
                    return;
                  }
                  setCurrentStep(3);
                }}
                disabled={selectedDbNames.length === 0 || !startPeriod || !endPeriod || startPeriod > endPeriod}
                className="px-6 py-2.5 text-xs font-semibold text-[#16303B] bg-[#7FBFC1] hover:bg-[#6FAEB0] disabled:opacity-50 disabled:cursor-not-allowed rounded-[14px] transition shadow-none cursor-pointer flex items-center gap-1.5"
              >
                <span>Siguiente</span>
                <span>→</span>
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleExecuteAiQuery}
                disabled={isQuerying}
                className="px-6 py-2.5 text-xs font-semibold text-[#1F3340] bg-[#F7A35F] hover:bg-[#EE944D] disabled:opacity-50 disabled:cursor-not-allowed rounded-[14px] transition shadow-none cursor-pointer flex items-center gap-2"
              >
                {isQuerying ? (
                  <>
                    <GuiosProSpinner size="xs" />
                    <span>Consultando IA...</span>
                  </>
                ) : (
                  <>
                    <span>Consultar con IA</span>
                    <span>✨</span>
                  </>
                )}
              </button>
            )}

            {currentStep === 4 && (
              <button
                type="button"
                onClick={handleApplyResults}
                disabled={isApplying}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-[#1F7A4D] hover:bg-[#18643E] disabled:opacity-50 disabled:cursor-not-allowed rounded-[14px] transition shadow-none cursor-pointer flex items-center gap-2"
              >
                {isApplying ? (
                  <>
                    <GuiosProSpinner size="xs" />
                    <span>Aplicando cambios...</span>
                  </>
                ) : (
                  <span>Aplicar</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
