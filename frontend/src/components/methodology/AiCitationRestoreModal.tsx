import React, { useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

interface MatchingFactor {
  factor_id: number;
  current_name: string;
  historical_name: string;
  name_changed: boolean;
  current_citations: number;
  citations_to_apply: number;
  dimension_name: string;
}

interface DeletedFactor {
  factor_id: number | null;
  historical_name: string;
  citations_in_query: number;
}

interface RestorePreviewData {
  query_id: number;
  query_date: string;
  can_restore: boolean;
  empty_reason: string;
  matching_factors: MatchingFactor[];
  deleted_factors: DeletedFactor[];
  total_matching: number;
  total_deleted: number;
}

interface AiCitationRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  queryId: number | null;
  onSuccess: () => void;
}

export const AiCitationRestoreModal: React.FC<AiCitationRestoreModalProps> = ({
  isOpen,
  onClose,
  queryId,
  onSuccess,
}) => {
  const toast = useToast();
  const [preview, setPreview] = useState<RestorePreviewData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !queryId) {
      setPreview(null);
      setError(null);
      return;
    }

    const fetchPreview = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(
          `/api/v1/methodology/ai-citations/queries/${queryId}/restore-preview/`,
          {
            credentials: 'include',
          }
        );
        if (res.ok) {
          const data: RestorePreviewData = await res.json();
          setPreview(data);
        } else {
          setError('No fue posible cargar la vista previa de restauración.');
        }
      } catch (err) {
        console.error('Error cargando preview de restauración:', err);
        setError('Error al conectar con el servidor.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreview();
  }, [isOpen, queryId]);

  if (!isOpen) return null;

  const handleExecuteRestore = async () => {
    if (!queryId || !preview?.can_restore) return;

    try {
      setIsRestoring(true);
      const res = await fetch(
        `/api/v1/methodology/ai-citations/queries/${queryId}/restore/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );

      const data = await res.json();
      if (res.ok) {
        toast.success(
          data.message || `Se restauraron ${preview.total_matching} factores y se recalculó la importancia metodológica.`
        );
        onSuccess();
        onClose();
      } else {
        toast.error(data.error || 'Error al restaurar los valores de citas.');
      }
    } catch (err) {
      console.error('Error ejecutando restauración:', err);
      toast.error('No se pudo completar la restauración.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-xs animate-fade-in font-sans">
      <div className="bg-white rounded-[24px] max-w-3xl w-full p-6 sm:p-7 space-y-5 border border-[#D5ECEC] shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between border-b border-[#D5ECEC]/80 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F7A35F]/20 border border-[#F7A35F]/40 flex items-center justify-center text-[#B8531A] shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#2B3F4C] leading-tight">
                Restaurar versión
              </h2>
              <p className="text-xs text-[#4F6170] mt-0.5">
                Restaura las citas bibliográficas a partir de la consulta #{queryId}
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

        {/* ── Orientación / Nota ── */}
        <div className="bg-[#D5ECEC]/30 border border-[#B4D6D6] rounded-[16px] p-3.5 text-xs text-[#16303B] leading-relaxed shrink-0">
          <p className="font-medium">
            <strong>Orientación:</strong> Los nombres actuales se mantienen como están en el sistema.
            Al restaurar esta versión se actualizarán únicamente las cantidades del <strong>total de citas (TC)</strong> de los factores que coinciden por ID y se recalculará automáticamente la importancia metodológica (cuartiles GUIOS).
          </p>
        </div>

        {/* ── Cuerpo del Modal ── */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5 min-h-[200px]">
          {isLoading ? (
            <div className="h-44 flex items-center justify-center">
              <GuiosProSpinner size="lg" label="Cargando vista previa de restauración..." />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-[#B8531A] bg-[#FFF8F3] rounded-[18px] border border-[#F7A35F]">
              {error}
            </div>
          ) : !preview ? null : (
            <>
              {/* Alerta de bloqueo si ningún factor existe */}
              {!preview.can_restore ? (
                <div className="bg-[#FFF1F0] border border-[#FFA39E] rounded-[18px] p-5 text-center space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#FFCCC7] flex items-center justify-center text-[#CF1322]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 7.5h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-sm text-[#CF1322]">
                    No se puede restaurar esta versión
                  </h4>
                  <p className="text-xs text-[#A8071A]">
                    {preview.empty_reason || 'Ninguno de los factores existe actualmente. No se puede restaurar esta versión.'}
                  </p>
                </div>
              ) : (
                /* ── Comparativa: Valor Actual vs Valor a Aplicar (Imagen 2) ── */
                <div className="border border-gray-200 rounded-[18px] overflow-hidden">
                  <div className="grid grid-cols-2 bg-[#D5ECEC] border-b border-[#B8DFE0] text-[11px] font-bold text-[#243642] uppercase tracking-wider">
                    <div className="py-3 px-5 border-r border-[#B8DFE0]">VALOR ACTUAL</div>
                    <div className="py-3 px-5">VALOR A APLICAR</div>
                  </div>

                  <div className="divide-y divide-gray-100 text-xs">
                    {preview.matching_factors.map((item) => (
                      <div
                        key={item.factor_id}
                        className="grid grid-cols-2 hover:bg-gray-50/70 transition items-center"
                      >
                        {/* Columna Izquierda: Valor Actual */}
                        <div className="py-3.5 px-5 border-r border-gray-100 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-[#243642] truncate">
                                {item.current_name}
                              </span>
                              {item.name_changed && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FDF0E6] text-[#B8531A] border border-[#FBB982]">
                                  (Nombre actualizado)
                                </span>
                              )}
                            </div>
                            {item.dimension_name && (
                              <span className="text-[10px] text-gray-400 block mt-0.5">
                                {item.dimension_name}
                              </span>
                            )}
                          </div>
                          <span className="font-serif font-bold text-sm text-gray-500 shrink-0">
                            {item.current_citations}
                          </span>
                        </div>

                        {/* Columna Derecha: Valor a Aplicar */}
                        <div className="py-3.5 px-5 flex items-center justify-between gap-2 bg-[#F6F5F3]/30">
                          <div className="min-w-0">
                            <span className="font-bold text-[#16303B] truncate block">
                              {item.historical_name}
                            </span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              Versión histórica
                            </span>
                          </div>
                          <span className="font-serif font-bold text-base text-[#243642] px-2.5 py-0.5 rounded-lg bg-[#D5ECEC]/60 border border-[#B4D6D6] shrink-0">
                            {item.citations_to_apply}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Factores Eliminados (si existen) ── */}
              {preview.deleted_factors.length > 0 && (
                <div className="bg-[#FFF8F3] border border-[#F7A35F]/60 rounded-[18px] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#B8531A]">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>
                      Factores eliminados que no se van a restaurar ({preview.deleted_factors.length}):
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8C3A0A]">
                    Estos factores formaban parte de la consulta histórica pero ya no existen en la metodología actual. No serán modificados ni recuperados.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {preview.deleted_factors.map((df, idx) => (
                      <span
                        key={idx}
                        className="bg-white border border-[#FBB982] text-[#8C3A0A] px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
                      >
                        <span className="line-through">{df.historical_name}</span>
                        <span className="text-[10px] text-gray-400 font-mono font-normal">
                          (TC: {df.citations_in_query})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Botones de Acción ── */}
        <div className="flex items-center justify-end gap-3 border-t border-[#D5ECEC]/80 pt-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="px-5 py-2.5 text-xs font-semibold text-[#2B3F4C] bg-white hover:bg-gray-50 border border-gray-200 rounded-[14px] transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleExecuteRestore}
            disabled={!preview?.can_restore || isRestoring || isLoading}
            className={`px-6 py-2.5 text-xs font-bold rounded-[14px] transition flex items-center gap-2 ${
              preview?.can_restore && !isRestoring && !isLoading
                ? 'bg-[#243642] hover:bg-[#16303B] text-white shadow-xs cursor-pointer'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isRestoring ? (
              <>
                <GuiosProSpinner size="xs" />
                <span>Restaurando...</span>
              </>
            ) : (
              <span>Restaurar</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};