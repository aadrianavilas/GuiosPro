import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

export interface InProgressEvaluation {
  id: number;
  name: string;
  state: string;
  start_date: string;
  end_date: string | null;
  created_at?: string;
  updated_at?: string;
  organization: {
    id: number;
    business_name: string;
    commercial_name?: string;
    sector?: string;
    city?: string;
    country?: string;
  } | null;
  software: {
    id: number;
    name: string;
    version?: string;
    description?: string;
  } | null;
  step_number: number;
  step_slug: string;
  step_name: string;
  progress_percentage: number;
}

export const InProgressEvaluationsSection: React.FC = () => {
  const navigate = useNavigate();

  const [evaluations, setEvaluations] = useState<InProgressEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Cargar evaluaciones en curso desde el backend
  useEffect(() => {
    let isMounted = true;

    const fetchInProgress = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const res = await fetch('/api/v1/evaluations/?state=in_progress', {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('No se pudieron consultar las evaluaciones en curso.');
        }

        const storedUser = JSON.parse(localStorage.getItem('guiospro_user') || '{}');
        const currentUserId = storedUser?.id;
        const currentUsername = storedUser?.username;

        const data: InProgressEvaluation[] = await res.json();
        if (isMounted) {
          // Filtrar adicionalmente en el cliente para garantizar que solo se muestren las no completadas y del usuario actual
          const inProgress = Array.isArray(data)
            ? data.filter((item) => {
                const notCompleted = item.state !== 'COM' && item.state !== 'completada';
                if (!notCompleted) return false;
                const evalUser = (item as any).evaluator;
                if (evalUser && (currentUserId || currentUsername)) {
                  if (typeof evalUser === 'object') {
                    if (currentUserId && evalUser.id && evalUser.id !== currentUserId) return false;
                    if (currentUsername && evalUser.username && evalUser.username !== currentUsername) return false;
                  } else if (typeof evalUser === 'number' && currentUserId) {
                    if (evalUser !== currentUserId) return false;
                  }
                }
                return true;
              })
            : [];
          setEvaluations(inProgress);
        }
      } catch (err: any) {
        console.error('Error cargando evaluaciones en curso:', err);
        if (isMounted) {
          setErrorMessage('No se pudieron cargar las evaluaciones en curso.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchInProgress();

    return () => {
      isMounted = false;
    };
  }, []);

  // Formato legible de fecha en español
  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return 'Sin fecha';
    try {
      // Si viene como YYYY-MM-DD
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Filtrado reactivo por texto y fecha
  const filteredEvaluations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = startOfToday - 30 * 24 * 60 * 60 * 1000;

    return evaluations.filter((item) => {
      // 1. Filtro por buscador (nombre evaluación, software, organización)
      if (q) {
        const evalName = (item.name || '').toLowerCase();
        const swName = (item.software?.name || '').toLowerCase();
        const orgCommercial = (item.organization?.commercial_name || '').toLowerCase();
        const orgBusiness = (item.organization?.business_name || '').toLowerCase();
        const matchesSearch =
          evalName.includes(q) ||
          swName.includes(q) ||
          orgCommercial.includes(q) ||
          orgBusiness.includes(q);

        if (!matchesSearch) return false;
      }

      // 2. Filtro por fecha específica del calendario
      if (dateFilter) {
        const itemDateStr = (item.start_date || item.created_at || '').split('T')[0];
        if (itemDateStr !== dateFilter) {
          return false;
        }
      }

      // 3. Filtro por preset de fecha (hoy, semana, mes)
      if (datePreset !== 'all') {
        const rawDate = item.start_date || item.created_at;
        if (!rawDate) return false;
        const itemTime = new Date(rawDate).getTime();

        if (datePreset === 'today') {
          if (itemTime < startOfToday) return false;
        } else if (datePreset === 'week') {
          if (itemTime < sevenDaysAgo) return false;
        } else if (datePreset === 'month') {
          if (itemTime < thirtyDaysAgo) return false;
        }
      }

      return true;
    });
  }, [evaluations, searchQuery, dateFilter, datePreset]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateFilter('');
    setDatePreset('all');
  };

  return (
    <div className="space-y-4 pt-2">
      {/* ── Encabezado de la Sección ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h3 className="text-2xl font-serif text-[#2B3F4C] tracking-tight">
              Evaluaciones en curso
            </h3>
            {!isLoading && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D5ECEC] text-[#16303B]">
                {evaluations.length}
              </span>
            )}
          </div>
          <p className="text-xs text-[#4F6170]">
            Retoma y continúa tus evaluaciones activas en el paso donde te quedaste.
          </p>
        </div>

        {/* Botón rápido para nueva evaluación si hay lista */}
        {evaluations.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/evaluaciones/nueva', { state: { fromClick: true, t: Date.now() } })}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16303B] bg-[#7FBFC1] hover:bg-[#6FAEB0] px-4 py-2 rounded-[14px] transition cursor-pointer shadow-none"
          >
            <span>+ Nueva evaluación</span>
          </button>
        )}
      </div>

      {/* ── Barra de Búsqueda y Filtros de Fecha ── */}
      <div className="bg-white rounded-[20px] p-4 border border-[#D5ECEC] shadow-none space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Campo de Búsqueda */}
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por evaluación, software libre u organización..."
              className="w-full pl-10 pr-3.5 py-2 text-xs text-[#2B3F4C] bg-[#F6F5F3] border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] focus:ring-1 focus:ring-[#7FBFC1] transition placeholder-[#4F6170]/70"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4F6170] hover:text-[#2B3F4C] text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro por Fecha (Selector de Calendario) */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setDatePreset('all');
                }}
                className="py-2 px-3 text-xs text-[#2B3F4C] bg-[#F6F5F3] border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition cursor-pointer"
                title="Filtrar por fecha específica"
              />
            </div>

            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="text-[11px] font-semibold text-[#7A3E0A] hover:underline cursor-pointer"
              >
                Limpiar fecha
              </button>
            )}
          </div>
        </div>

        {/* Filtros Rápidos de Fecha (Pills) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#D5ECEC]/60 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-medium text-[#4F6170] mr-1">Rango:</span>
            {(
              [
                { key: 'all', label: 'Todas' },
                { key: 'today', label: 'Hoy' },
                { key: 'week', label: 'Últimos 7 días' },
                { key: 'month', label: 'Últimos 30 días' },
              ] as const
            ).map((p) => {
              const isActive = datePreset === p.key && !dateFilter;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setDatePreset(p.key);
                    setDateFilter('');
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-[#2B3F4C] text-white font-semibold'
                      : 'bg-[#F6F5F3] text-[#4F6170] hover:text-[#2B3F4C] hover:bg-[#D5ECEC]/50 border border-[#D5ECEC]'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-[#4F6170] font-medium">
            Mostrando <span className="font-bold text-[#2B3F4C]">{filteredEvaluations.length}</span> de{' '}
            <span className="font-bold text-[#2B3F4C]">{evaluations.length}</span> en curso
          </div>
        </div>
      </div>

      {/* ── Mensaje de Error si lo hubiere ── */}
      {errorMessage && (
        <div className="p-3.5 rounded-[14px] bg-[#FDE2C8] border border-[#FBB982] text-xs text-[#7A3E0A] font-semibold flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-[#7A3E0A] font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Estado de Carga (Spinner GuiosPro) ── */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center">
          <GuiosProSpinner size="lg" label="Cargando evaluaciones en curso..." />
        </div>
      )}

      {/* ── Estado Vacío: Sin ninguna evaluación en curso ── */}
      {!isLoading && evaluations.length === 0 && (
        <div className="bg-white rounded-[24px] p-10 border border-[#D5ECEC] text-center space-y-3.5">
          <div className="w-14 h-14 rounded-[16px] bg-[#D5ECEC] text-[#16303B] flex items-center justify-center mx-auto">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h4 className="text-lg font-serif text-[#2B3F4C]">No tienes evaluaciones en curso</h4>
            <p className="text-xs text-[#4F6170] max-w-md mx-auto">
              Todas tus evaluaciones previas han sido finalizadas o aún no has creado una. Puedes iniciar una nueva evaluación cuando lo desees.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/evaluaciones/nueva', { state: { fromClick: true, t: Date.now() } })}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-[#7FBFC1] hover:bg-[#6FAEB0] text-[#16303B] font-semibold text-xs transition cursor-pointer shadow-none"
          >
            <span>Crear nueva evaluación</span>
            <span>→</span>
          </button>
        </div>
      )}

      {/* ── Estado Vacío: Búsqueda sin coincidencias ── */}
      {!isLoading && evaluations.length > 0 && filteredEvaluations.length === 0 && (
        <div className="bg-white rounded-[24px] p-8 border border-[#D5ECEC] text-center space-y-2">
          <p className="text-xs font-semibold text-[#2B3F4C]">
            No se encontraron evaluaciones en curso con los filtros aplicados.
          </p>
          <p className="text-[11px] text-[#4F6170]">
            Prueba ajustando el término de búsqueda o cambiando el filtro de fecha.
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs font-bold text-[#7FBFC1] hover:underline cursor-pointer pt-1"
          >
            Restablecer filtros
          </button>
        </div>
      )}

      {/* ── Cuadrícula de Tarjetas de Evaluaciones en Curso ── */}
      {!isLoading && filteredEvaluations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvaluations.map((item) => {
            const orgName =
              item.organization?.commercial_name ||
              item.organization?.business_name ||
              'Organización no asignada';
            const locationStr = [item.organization?.city, item.organization?.country]
              .filter(Boolean)
              .join(', ');

            return (
              <div
                key={item.id}
                onClick={() => navigate(`/evaluaciones/${item.id}/${item.step_slug || 'factores'}`)}
                className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] hover:border-[#7FBFC1] hover:shadow-sm transition-all flex flex-col justify-between group cursor-pointer"
              >
                <div className="space-y-4">
                  {/* Fila superior: Ícono y Badge de Estado */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-[14px] bg-[#F9E8A0] text-[#5B4A12] flex items-center justify-center font-mono font-bold text-xs shrink-0 border border-[#F9E8A0]">
                      &lt;/&gt;
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FDE2C8] text-[#7A3E0A]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#B8531A] animate-pulse" />
                      En curso
                    </span>
                  </div>

                  {/* Nombre de la Evaluación y Software Libre */}
                  <div className="space-y-1">
                    <h4 className="text-lg font-serif text-[#2B3F4C] font-bold leading-snug group-hover:text-[#B8531A] transition line-clamp-2">
                      {item.name}
                    </h4>
                    <p className="text-xs text-[#4F6170] flex items-center gap-1.5 font-medium">
                      <span className="font-semibold text-[#2B3F4C]">
                        {item.software?.name || 'Software'}
                      </span>
                      {item.software?.version && (
                        <span className="text-[#4F6170]/80">· v{item.software.version}</span>
                      )}
                    </p>
                  </div>

                  {/* Detalles de la Organización */}
                  <div className="bg-[#F6F5F3] rounded-[16px] p-3.5 border border-[#D5ECEC] space-y-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <svg
                        className="w-3.5 h-3.5 text-[#7FBFC1] shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
                        />
                      </svg>
                      <span className="font-semibold text-[#2B3F4C] truncate" title={orgName}>
                        {orgName}
                      </span>
                    </div>
                    {locationStr && (
                      <p className="text-[11px] text-[#4F6170] pl-5 truncate">
                        {locationStr}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-[#4F6170]/80 pl-5 pt-0.5">
                      <span>Inicio: {formatDate(item.start_date || item.created_at)}</span>
                      {item.updated_at && (
                        <span>Actualizada: {formatDate(item.updated_at)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sección Inferior: Barra de Progreso y Botón Continuar */}
                <div className="pt-4 mt-4 border-t border-[#D5ECEC]/70 space-y-3">
                  {/* Barra de Progreso con Porcentaje (Si llegó a resultados debe mostrar 100%) */}
                  {(() => {
                    const itemProgress = item.step_number === 4 || item.step_slug === 'resultados' || item.progress_percentage >= 90 ? 100 : item.progress_percentage;
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#2B3F4C] text-[11px]">
                            {item.step_name || 'En progreso'}
                          </span>
                          <span className="font-bold text-[#B8531A] text-xs">
                            {itemProgress}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#D5ECEC] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#F7A35F] rounded-full transition-all duration-300"
                            style={{ width: `${itemProgress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#4F6170]">
                          <span>Paso {item.step_number} de 4</span>
                          <span>
                            {item.step_number === 1 && 'Software libre'}
                            {item.step_number === 2 && 'Ponderar factores'}
                            {item.step_number === 3 && 'Valorar subfactores'}
                            {item.step_number === 4 && 'Resultados y FODA'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Botón de acción */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/evaluaciones/${item.id}/${item.step_slug || 'factores'}`);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-[14px] bg-[#7FBFC1] hover:bg-[#6FAEB0] text-[#16303B] font-semibold text-xs transition cursor-pointer shadow-none"
                  >
                    <span>Continuar evaluación</span>
                    <span className="font-bold">→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
