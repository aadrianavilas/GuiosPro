import React, { useEffect, useState, useMemo } from 'react';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

interface BibliographicReference {
  id?: number;
  titulo: string;
  autores: string;
  anio: number;
  base_datos: string;
  url: string; // Pantalla del resumen del archivo
  pdf_url?: string; // Link directo del archivo PDF
  resumen?: string; // Resumen/abstract del artículo científico
  doi?: string;
  factor_name?: string;
  factor_id?: number | null;
}

const getAbstractScreenUrl = (ref?: { url?: string; pdf_url?: string; titulo?: string }): string => {
  if (!ref) return '#';
  if (ref.url && ref.url.includes('arxiv.org/abs/')) return ref.url;
  if (ref.pdf_url && ref.pdf_url.includes('arxiv.org/pdf/')) {
    return ref.pdf_url.replace('/pdf/', '/abs/').replace('.pdf', '');
  }
  if (ref.url && !ref.url.includes('doi.org')) return ref.url;
  return ref.titulo ? `https://scholar.google.com/scholar?q=${encodeURIComponent(ref.titulo)}` : '#';
};

const getPdfFileUrl = (ref?: { url?: string; pdf_url?: string }): string | null => {
  if (!ref) return null;
  if (ref.pdf_url) return ref.pdf_url;
  if (ref.url && ref.url.includes('arxiv.org/abs/')) {
    return ref.url.replace('/abs/', '/pdf/') + '.pdf';
  }
  return null;
};

interface DatabaseResult {
  id: number;
  database_name: string;
  query_status: string;
  query_status_display: string;
}

interface FactorResult {
  id: number;
  factor_id: number | null;
  factor_name: string;
  current_factor_name: string | null;
  dimension_name: string;
  total_citations: number;
  result_status: string;
  result_status_display: string;
  factor_exists: boolean;
  bibliographic_references?: BibliographicReference[];
}

interface QueryDetail {
  id: number;
  query_date: string;
  start_period: string;
  end_period: string;
  total_factors: number;
  total_databases: number;
  status: string;
  status_display: string;
  user_display: string;
  database_results: DatabaseResult[];
  factor_results: FactorResult[];
  all_bibliographic_references?: BibliographicReference[];
}

interface AiCitationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  queryId: number | null;
}

export const AiCitationDetailModal: React.FC<AiCitationDetailModalProps> = ({
  isOpen,
  onClose,
  queryId,
}) => {
  const [activeTab, setActiveTab] = useState<'factors' | 'databases' | 'references' | 'summary'>('factors');
  const [data, setData] = useState<QueryDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFactorId, setSelectedFactorId] = useState<number | null>(null);
  const [refSearch, setRefSearch] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !queryId) {
      setData(null);
      setError(null);
      setActiveTab('factors');
      setSelectedFactorId(null);
      setRefSearch('');
      return;
    }

    const fetchDetail = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/v1/methodology/ai-citations/queries/${queryId}/`, {
          credentials: 'include',
        });
        if (res.ok) {
          const detailData: QueryDetail = await res.json();
          setData(detailData);
          if (detailData.factor_results && detailData.factor_results.length > 0) {
            setSelectedFactorId(detailData.factor_results[0].id);
          }
        } else {
          setError('No fue posible cargar el detalle de la consulta.');
        }
      } catch (err) {
        console.error('Error cargando detalle de consulta IA:', err);
        setError('Error al conectar con el servidor.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, queryId]);

  // Lista consolidada de todas las referencias de todos los factores
  const consolidatedReferences = useMemo(() => {
    if (!data) return [];
    if (data.all_bibliographic_references && data.all_bibliographic_references.length > 0) {
      return data.all_bibliographic_references;
    }
    const list: BibliographicReference[] = [];
    (data.factor_results || []).forEach((f) => {
      (f.bibliographic_references || []).forEach((r) => {
        list.push({
          ...r,
          factor_name: f.factor_name,
          factor_id: f.factor_id,
        });
      });
    });
    return list;
  }, [data]);

  // Referencias filtradas para la pestaña global de referencias
  const filteredReferences = useMemo(() => {
    const q = refSearch.trim().toLowerCase();
    if (!q) return consolidatedReferences;
    return consolidatedReferences.filter((r) =>
      r.titulo?.toLowerCase().includes(q) ||
      r.autores?.toLowerCase().includes(q) ||
      r.base_datos?.toLowerCase().includes(q) ||
      r.factor_name?.toLowerCase().includes(q)
    );
  }, [consolidatedReferences, refSearch]);

  const selectedFactor = useMemo(() => {
    if (!data || !selectedFactorId) return null;
    return data.factor_results?.find((f) => f.id === selectedFactorId) || null;
  }, [data, selectedFactorId]);

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-xs animate-fade-in font-sans">
      <div className="bg-white rounded-[24px] max-w-4xl w-full p-6 sm:p-7 space-y-6 border border-[#D5ECEC] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between border-b border-[#D5ECEC]/80 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D5ECEC] flex items-center justify-center text-[#243642] shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#2B3F4C] leading-tight">
                Detalle de consulta con IA
              </h2>
              <p className="text-xs text-[#4F6170] mt-0.5">
                Consulta #{queryId} • Registro histórico bibliométrico
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* ── Navegación por Pestañas ── */}
        <div className="flex items-center gap-2 border-b border-gray-100 pb-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('factors')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'factors'
                ? 'bg-[#243642] text-white shadow-xs'
                : 'bg-[#F6F5F3] text-[#4F6170] hover:bg-[#D5ECEC]/50 hover:text-[#243642]'
            }`}
          >
            <span>Factores y Citas</span>
            {data && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'factors' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {data.factor_results?.length || 0}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('references')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'references'
                ? 'bg-[#243642] text-white shadow-xs'
                : 'bg-[#F6F5F3] text-[#4F6170] hover:bg-[#D5ECEC]/50 hover:text-[#243642]'
            }`}
          >
            <span>Referencias Bibliográficas</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === 'references' ? 'bg-white/20 text-white' : 'bg-[#D5ECEC] text-[#16303B]'
            }`}>
              {consolidatedReferences.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('databases')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'databases'
                ? 'bg-[#243642] text-white shadow-xs'
                : 'bg-[#F6F5F3] text-[#4F6170] hover:bg-[#D5ECEC]/50 hover:text-[#243642]'
            }`}
          >
            <span>Bases Científicas</span>
            {data && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'databases' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {data.database_results?.length || 0}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-[#243642] text-white shadow-xs'
                : 'bg-[#F6F5F3] text-[#4F6170] hover:bg-[#D5ECEC]/50 hover:text-[#243642]'
            }`}
          >
            Resumen General
          </button>
        </div>

        {/* ── Contenido de las Pestañas ── */}
        <div className="flex-1 overflow-y-auto pr-1 min-h-[300px]">
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <GuiosProSpinner size="lg" label="Cargando detalle de la consulta..." />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-[#B8531A] bg-[#FFF8F3] rounded-[18px] border border-[#F7A35F]">
              {error}
            </div>
          ) : !data ? null : (
            <>
              {/* PESTAÑA 1: FACTORES Y CITAS (CON DETALLE DE REFERENCIAS AL HACER CLIC) */}
              {activeTab === 'factors' && (
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-[18px] overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#D5ECEC] text-[#243642] text-[11px] font-bold tracking-wider uppercase border-b border-[#B8DFE0]">
                          <th className="py-3 px-5">FACTOR INVESTIGADO</th>
                          <th className="py-3 px-5 text-center">ESTADO</th>
                          <th className="py-3 px-5 text-right font-semibold">TOTAL CITAS (TC)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.factor_results?.map((item) => {
                          const isSelected = selectedFactorId === item.id;
                          return (
                            <tr
                              key={item.id}
                              onClick={() => setSelectedFactorId(item.id)}
                              className={`transition cursor-pointer ${
                                isSelected
                                  ? 'bg-[#EBF7F7] border-l-4 border-l-[#7FBFC1]'
                                  : 'hover:bg-gray-50/70'
                              }`}
                            >
                              <td className="py-3.5 px-5">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-[#7FBFC1]' : 'bg-transparent'}`} />
                                  <div>
                                    <span className="block font-bold text-xs text-[#243642]">
                                      {item.factor_name}
                                    </span>
                                    {item.dimension_name && (
                                      <span className="block text-[10px] text-gray-400 font-medium mt-0.5">
                                        {item.dimension_name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    item.result_status === 'valid'
                                      ? 'bg-[#D9F0DC] text-[#1F5A2E]'
                                      : item.result_status === 'partial'
                                      ? 'bg-[#F9E8A0] text-[#5B4A12]'
                                      : 'bg-[#FFEBE5] text-[#B8531A]'
                                  }`}
                                >
                                  {item.result_status_display || item.result_status}
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

                  {/* Panel inferior de referencias del factor seleccionado */}
                  {selectedFactor && (
                    <div className="bg-[#F6F5F3] border border-[#D5ECEC] rounded-[20px] p-4.5 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-[#D5ECEC] pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📚</span>
                          <div>
                            <h4 className="font-bold text-xs text-[#243642]">
                              Referencias bibliográficas de: <span className="text-[#B8421A]">{selectedFactor.factor_name}</span>
                            </h4>
                            <p className="text-[10px] text-[#4F6170]">
                              {selectedFactor.total_citations} artículos científicos consultados indexados en bases seleccionadas
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold bg-[#D5ECEC] text-[#16303B] px-2.5 py-1 rounded-full">
                          {selectedFactor.bibliographic_references?.length || 0} registradas
                        </span>
                      </div>

                      {(!selectedFactor.bibliographic_references || selectedFactor.bibliographic_references.length === 0) ? (
                        <p className="text-xs text-gray-400 italic py-3 text-center">
                          No se registraron referencias bibliográficas detalladas para este factor.
                        </p>
                      ) : (
                        <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                          {selectedFactor.bibliographic_references.map((ref, idx) => (
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
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#B8421A] hover:bg-[#9B3714] text-white text-[10px] font-bold transition shrink-0 shadow-2xs"
                                      title="Abrir directamente el archivo PDF del artículo"
                                    >
                                      <span>📄 Ver archivo (PDF)</span>
                                      <span className="text-[9px]">↗</span>
                                    </a>
                                  )}
                                  <a
                                    href={getAbstractScreenUrl(ref)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D5ECEC] hover:bg-[#7FBFC1] text-[#16303B] text-[10px] font-bold transition shrink-0 shadow-2xs"
                                    title="Abrir la pantalla oficial con el resumen del archivo"
                                  >
                                    <span>📑 Pantalla de resumen</span>
                                    <span className="text-[9px]">↗</span>
                                  </a>
                                </div>
                              </div>

                              {ref.resumen && (
                                <p className="text-[11px] text-[#4F6170] bg-[#F6F5F3] p-2 rounded-lg border border-[#D5ECEC]/70 leading-relaxed italic">
                                  <strong className="text-[#243642] not-italic font-semibold">Resumen: </strong>
                                  {ref.resumen}
                                </p>
                              )}

                              <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-wrap">
                                <span className="font-medium text-gray-700">{ref.autores}</span>
                                <span>•</span>
                                <span className="bg-gray-100 px-2 py-0.5 rounded-md font-semibold text-gray-600">
                                  {ref.anio}
                                </span>
                                <span>•</span>
                                <span className="bg-[#F9E8A0]/70 text-[#5B4A12] px-2 py-0.5 rounded-md font-bold">
                                  {ref.base_datos}
                                </span>
                                {ref.doi && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-gray-400 text-[9px] truncate max-w-[200px]">
                                      DOI: {ref.doi}
                                    </span>
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

              {/* PESTAÑA 2: TODAS LAS REFERENCIAS BIBLIOGRÁFICAS (GLOBAL) */}
              {activeTab === 'references' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 bg-[#F6F5F3] p-3 rounded-[16px] border border-[#D5ECEC]">
                    <div className="flex items-center gap-2 flex-1">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={refSearch}
                        onChange={(e) => setRefSearch(e.target.value)}
                        placeholder="Buscar por título, autor, base o factor..."
                        className="w-full bg-transparent text-xs text-[#243642] placeholder-gray-400 outline-none"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-[#4F6170] shrink-0">
                      {filteredReferences.length} de {consolidatedReferences.length} referencias
                    </span>
                  </div>

                  {filteredReferences.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400 bg-gray-50 rounded-[16px] border border-gray-200">
                      No se encontraron referencias bibliográficas que coincidan con la búsqueda.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                      {filteredReferences.map((ref, idx) => (
                        <div
                          key={ref.id ? `${ref.factor_id}-${ref.id}` : idx}
                          className="bg-white rounded-[16px] p-3.5 border border-gray-200 hover:border-[#7FBFC1] transition shadow-2xs space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 flex-1">
                              {ref.factor_name && (
                                <span className="inline-block text-[10px] font-bold bg-[#D5ECEC] text-[#16303B] px-2 py-0.5 rounded-full">
                                  Factor: {ref.factor_name}
                                </span>
                              )}
                              <h5 className="font-bold text-xs text-[#243642] leading-snug">
                                {ref.titulo}
                              </h5>
                            </div>
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

                          <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-wrap pt-1 border-t border-gray-100">
                            <span className="font-medium text-gray-700">{ref.autores}</span>
                            <span>•</span>
                            <span className="bg-gray-100 px-2 py-0.5 rounded-md font-semibold text-gray-600">
                              Año {ref.anio}
                            </span>
                            <span>•</span>
                            <span className="bg-[#F9E8A0] text-[#5B4A12] px-2 py-0.5 rounded-md font-bold">
                              {ref.base_datos}
                            </span>
                            {ref.doi && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-gray-400 text-[9px] truncate max-w-[240px]">
                                  DOI: {ref.doi}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PESTAÑA 3: BASES CIENTÍFICAS */}
              {activeTab === 'databases' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.database_results?.map((db) => (
                      <div
                        key={db.id}
                        className="bg-white rounded-[16px] p-4 border border-gray-200 hover:border-[#7FBFC1] transition shadow-2xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#D5ECEC] flex items-center justify-center text-[#16303B] font-bold text-xs">
                            {db.database_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-[#243642]">
                              {db.database_name}
                            </span>
                            <span className="block text-[10px] text-gray-400">
                              Base indexada
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            db.query_status === 'completed'
                              ? 'bg-[#D9F0DC] text-[#1F5A2E]'
                              : 'bg-[#FFEBE5] text-[#B8531A]'
                          }`}
                        >
                          {db.query_status_display || db.query_status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PESTAÑA 4: RESUMEN GENERAL */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#F6F5F3] p-3.5 rounded-[16px] border border-gray-200">
                      <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Factores
                      </span>
                      <span className="text-xl font-bold font-serif text-[#243642]">
                        {data.total_factors}
                      </span>
                    </div>

                    <div className="bg-[#F6F5F3] p-3.5 rounded-[16px] border border-gray-200">
                      <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Bases Datos
                      </span>
                      <span className="text-xl font-bold font-serif text-[#243642]">
                        {data.total_databases}
                      </span>
                    </div>

                    <div className="bg-[#F6F5F3] p-3.5 rounded-[16px] border border-gray-200">
                      <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Periodo Inicio
                      </span>
                      <span className="text-xs font-bold text-[#243642] mt-1 block">
                        {formatDate(data.start_period)}
                      </span>
                    </div>

                    <div className="bg-[#F6F5F3] p-3.5 rounded-[16px] border border-gray-200">
                      <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Periodo Fin
                      </span>
                      <span className="text-xs font-bold text-[#243642] mt-1 block">
                        {formatDate(data.end_period)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-[16px] border border-gray-200 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">Fecha y hora de ejecución:</span>
                      <span className="font-semibold text-[#243642]">
                        {formatDateTime(data.query_date)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">Usuario que ejecutó la consulta:</span>
                      <span className="font-semibold text-[#243642]">
                        {data.user_display}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">Estado de la consulta:</span>
                      <span className="font-semibold text-[#1F5A2E]">
                        {data.status_display}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Total de referencias bibliográficas:</span>
                      <span className="font-bold text-[#B8421A]">
                        {consolidatedReferences.length} artículos indexados
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end border-t border-[#D5ECEC]/80 pt-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-[#243642] hover:bg-[#16303B] rounded-[14px] transition cursor-pointer shadow-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
