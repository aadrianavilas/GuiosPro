import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/context/ToastContext';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

export interface CompletedEvaluation {
  id: number;
  name: string;
  state: string;
  start_date: string;
  end_date: string | null;
  created_at?: string;
  updated_at?: string;
  recommendation_category?: 'A' | 'B' | 'C' | null;
  recommendation_text?: string | null;
  recommendation_title?: string;
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
  evaluator?: {
    id?: number;
    username?: string;
    email?: string;
  } | number | null;
  step_number: number;
  step_slug: string;
  step_name: string;
  progress_percentage: number;
}

export const EvaluationHistoryView: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [evaluations, setEvaluations] = useState<CompletedEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filtros
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateField, setDateField] = useState<'end_date' | 'start_date'>('end_date');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'name_asc' | 'name_desc' | 'software_asc'>('recent');

  // Paginación (10 evaluaciones por página)
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Consultar evaluaciones finalizadas desde el backend
  useEffect(() => {
    let isMounted = true;

    const fetchCompleted = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/v1/evaluations/?state=completed', {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('No se pudieron consultar las evaluaciones finalizadas.');
        }

        const storedUser = JSON.parse(localStorage.getItem('guiospro_user') || '{}');
        const currentUserId = storedUser?.id;
        const currentUsername = storedUser?.username;

        const data: CompletedEvaluation[] = await res.json();
        if (isMounted) {
          // Filtrar rigurosamente solo las completadas del usuario actual
          const completedOnly = Array.isArray(data)
            ? data.filter((item) => {
                const isCompleted = item.state === 'COM' || item.state === 'completada';
                if (!isCompleted) return false;
                const evalUser = item.evaluator;
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
          setEvaluations(completedOnly);
        }
      } catch (err: any) {
        console.error('Error cargando historial de evaluaciones:', err);
        if (isMounted) {
          toast.error('No se pudieron cargar las evaluaciones finalizadas. Intente nuevamente.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchCompleted();

    return () => {
      isMounted = false;
    };
  }, []);

  // Formato de fechas amigable (ej: 17 nov 2026)
  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Conteo de métricas para las 4 tarjetas superiores
  const counts = useMemo(() => {
    let countA = 0;
    let countB = 0;
    let countC = 0;

    evaluations.forEach((item) => {
      if (item.recommendation_category === 'A') countA++;
      else if (item.recommendation_category === 'B') countB++;
      else if (item.recommendation_category === 'C') countC++;
    });

    return {
      all: evaluations.length,
      A: countA,
      B: countB,
      C: countC,
    };
  }, [evaluations]);

  // Filtrado y ordenamiento de evaluaciones
  const filteredEvaluations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const result = evaluations.filter((item) => {
      // 1. Filtro por tarjeta de categoría FODA (Todas, Adoptar, Es posible adoptar, No se debe adoptar)
      if (categoryFilter !== 'ALL') {
        if (item.recommendation_category !== categoryFilter) {
          return false;
        }
      }

      // 2. Filtro por texto de búsqueda (nombre evaluación o software)
      if (q) {
        const evalName = (item.name || '').toLowerCase();
        const swName = (item.software?.name || '').toLowerCase();
        const orgName = (item.organization?.commercial_name || item.organization?.business_name || '').toLowerCase();
        if (!evalName.includes(q) && !swName.includes(q) && !orgName.includes(q)) {
          return false;
        }
      }

      // 3. Filtro por fechas Desde / Hasta
      const targetDateStr =
        dateField === 'end_date'
          ? item.end_date || item.updated_at || ''
          : item.start_date || item.created_at || '';

      const targetDay = targetDateStr.split('T')[0];

      if (dateFrom && targetDay) {
        if (targetDay < dateFrom) return false;
      }

      if (dateTo && targetDay) {
        if (targetDay > dateTo) return false;
      }

      return true;
    });

    // 4. Ordenamiento
    result.sort((a, b) => {
      if (sortBy === 'recent') {
        const dateA = a.end_date || a.updated_at || a.start_date || '';
        const dateB = b.end_date || b.updated_at || b.start_date || '';
        return dateB.localeCompare(dateA);
      }
      if (sortBy === 'oldest') {
        const dateA = a.end_date || a.updated_at || a.start_date || '';
        const dateB = b.end_date || b.updated_at || b.start_date || '';
        return dateA.localeCompare(dateB);
      }
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '');
      }
      if (sortBy === 'software_asc') {
        const swA = a.software?.name || '';
        const swB = b.software?.name || '';
        return swA.localeCompare(swB);
      }
      return 0;
    });

    return result;
  }, [evaluations, categoryFilter, searchQuery, dateField, dateFrom, dateTo, sortBy]);

  // Ajustar página actual si la búsqueda reduce el número de páginas
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchQuery, dateField, dateFrom, dateTo, sortBy]);

  // Paginación (10 elementos por página)
  const totalPages = Math.ceil(filteredEvaluations.length / ITEMS_PER_PAGE) || 1;
  const paginatedEvaluations = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEvaluations.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredEvaluations, currentPage]);

  const handleRowClick = (evalId: number) => {
    navigate(`/evaluaciones/${evalId}/resultados`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      {/* ── Encabezado Principal ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2B3F4C] tracking-tight">
            Historial de evaluaciones
          </h1>
          <p className="text-xs text-[#4F6170]">
            Todas las evaluaciones que has finalizado como decisor.
          </p>
        </div>

        {!isLoading && (
          <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold bg-[#F9E8A0] text-[#5B4A12]">
            {evaluations.length} {evaluations.length === 1 ? 'evaluación' : 'evaluaciones'}
          </span>
        )}
      </div>

      {/* ── 4 Tarjetas Métricas Superiores (Filtro Rápido por Recomendación) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Todas */}
        <button
          type="button"
          onClick={() => setCategoryFilter('ALL')}
          className={`rounded-[20px] p-5 text-left transition cursor-pointer flex items-center justify-between shadow-none ${
            categoryFilter === 'ALL'
              ? 'bg-white border-2 border-[#2B3F4C] ring-2 ring-[#2B3F4C]/10'
              : 'bg-white border border-[#D5ECEC] hover:border-[#7FBFC1]'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl font-serif font-bold text-[#2B3F4C]">
              {counts.all}
            </span>
            <span className="text-sm font-semibold text-[#2B3F4C]">
              Todas
            </span>
          </div>
        </button>

        {/* Adoptar (A) */}
        <button
          type="button"
          onClick={() => setCategoryFilter('A')}
          className={`rounded-[20px] p-5 text-left transition cursor-pointer flex items-center justify-between shadow-none ${
            categoryFilter === 'A'
              ? 'bg-[#DDF4E4] border-2 border-[#1F7A4D] ring-2 ring-[#1F7A4D]/20'
              : 'bg-[#DDF4E4]/80 border border-[#A7E3B6] hover:bg-[#DDF4E4]'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border border-[#1F7A4D] flex items-center justify-center text-[11px] shrink-0 font-bold text-[#1F7A4D]">
              ✓
            </span>
            <span className="text-3xl font-serif font-bold text-[#1F7A4D]">
              {counts.A}
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#1F7A4D]">
              Adoptar
            </span>
          </div>
        </button>

        {/* Es posible adoptar (B) */}
        <button
          type="button"
          onClick={() => setCategoryFilter('B')}
          className={`rounded-[20px] p-5 text-left transition cursor-pointer flex items-center justify-between shadow-none ${
            categoryFilter === 'B'
              ? 'bg-[#F9E8A0] border-2 border-[#B8531A] ring-2 ring-[#B8531A]/20'
              : 'bg-[#F9E8A0]/80 border border-[#F6D76D] hover:bg-[#F9E8A0]'
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0 text-[#5B4A12]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-3xl font-serif font-bold text-[#5B4A12]">
              {counts.B}
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#5B4A12]">
              Es posible adoptar
            </span>
          </div>
        </button>

        {/* No se debe adoptar (C) */}
        <button
          type="button"
          onClick={() => setCategoryFilter('C')}
          className={`rounded-[20px] p-5 text-left transition cursor-pointer flex items-center justify-between shadow-none ${
            categoryFilter === 'C'
              ? 'bg-[#FDE2C8] border-2 border-[#B84318] ring-2 ring-[#B84318]/20'
              : 'bg-[#FDE2C8]/80 border border-[#FBB982] hover:bg-[#FDE2C8]'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border border-[#B84318] flex items-center justify-center text-[11px] shrink-0 font-bold text-[#B84318]">
              ✕
            </span>
            <span className="text-3xl font-serif font-bold text-[#B84318]">
              {counts.C}
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#B84318]">
              No se debe adoptar
            </span>
          </div>
        </button>
      </div>

      {/* ── Contenedor Principal: Filtros y Tabla de Evaluaciones ── */}
      <div className="bg-white rounded-[24px] border border-[#D5ECEC] p-6 space-y-5 shadow-none">
        {/* Fila 1 de Filtros: Buscar, Filtrar por, Desde, Hasta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
          {/* Buscar */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#2B3F4C]">Buscar</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nombre de la evaluación o softwa..."
                className="w-full pl-9 pr-3.5 py-2 text-xs text-[#2B3F4C] bg-white border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition placeholder-[#4F6170]/60"
              />
            </div>
          </div>

          {/* Filtrar fecha por */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#2B3F4C]">Filtrar fecha por</label>
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as 'end_date' | 'start_date')}
              className="w-full py-2 px-3 text-xs text-[#2B3F4C] bg-white border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition cursor-pointer"
            >
              <option value="end_date">Fecha de finalización</option>
              <option value="start_date">Fecha de inicio</option>
            </select>
          </div>

          {/* Desde */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#2B3F4C]">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full py-2 px-3 text-xs text-[#2B3F4C] bg-white border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition cursor-pointer"
            />
          </div>

          {/* Hasta */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#2B3F4C]">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full py-2 px-3 text-xs text-[#2B3F4C] bg-white border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition cursor-pointer"
            />
          </div>
        </div>

        {/* Fila 2: Ordenar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-col gap-1.5 max-w-xs w-full">
            <label className="text-xs font-semibold text-[#2B3F4C]">Ordenar</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full py-2 px-3 text-xs text-[#2B3F4C] bg-white border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition cursor-pointer"
            >
              <option value="recent">Más recientes primero</option>
              <option value="oldest">Más antiguas primero</option>
              <option value="name_asc">Nombre (A - Z)</option>
              <option value="name_desc">Nombre (Z - A)</option>
              <option value="software_asc">Software (A - Z)</option>
            </select>
          </div>

          {(searchQuery || dateFrom || dateTo || categoryFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDateFrom('');
                setDateTo('');
                setCategoryFilter('ALL');
              }}
              className="text-xs font-semibold text-[#7A3E0A] hover:underline self-end pb-2 cursor-pointer"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>

        {/* Contador de resultados */}
        <div className="pt-2 border-t border-[#D5ECEC]/70 flex items-center justify-between text-xs text-[#4F6170]">
          <p>
            Mostrando <span className="font-bold text-[#2B3F4C]">{filteredEvaluations.length}</span> de{' '}
            <span className="font-bold text-[#2B3F4C]">{evaluations.length}</span> evaluaciones
          </p>
          {totalPages > 1 && (
            <p>
              Página <span className="font-bold text-[#2B3F4C]">{currentPage}</span> de{' '}
              <span className="font-bold text-[#2B3F4C]">{totalPages}</span>
            </p>
          )}
        </div>

        {/* ── Estado de Carga (Spinner GuiosPro) ── */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center">
            <GuiosProSpinner size="lg" label="Cargando historial de evaluaciones..." />
          </div>
        )}

        {/* ── Estado Vacío: Sin evaluaciones finalizadas ── */}
        {!isLoading && evaluations.length === 0 && (
          <div className="py-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-[16px] bg-[#D5ECEC] text-[#16303B] flex items-center justify-center mx-auto">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-serif text-[#2B3F4C]">Aún no tienes evaluaciones finalizadas</h4>
              <p className="text-xs text-[#4F6170] max-w-md mx-auto">
                Cuando completes y finalices una evaluación, aparecerá registrada en este historial permanente para consulta y exportación.
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
          <div className="py-10 text-center space-y-2">
            <p className="text-xs font-semibold text-[#2B3F4C]">
              No se encontraron evaluaciones con los filtros aplicados.
            </p>
            <p className="text-[11px] text-[#4F6170]">
              Prueba cambiando el término de búsqueda o limpiando las fechas seleccionadas.
            </p>
          </div>
        )}

        {/* ── Tabla de Evaluaciones Finalizadas ── */}
        {!isLoading && paginatedEvaluations.length > 0 && (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D5ECEC] text-[11px] font-bold text-[#4F6170] uppercase tracking-wider">
                  <th className="py-3 px-3">EVALUACIÓN</th>
                  <th className="py-3 px-3">SOFTWARE</th>
                  <th className="py-3 px-3">INICIO</th>
                  <th className="py-3 px-3">FINALIZACIÓN</th>
                  <th className="py-3 px-3">RECOMENDACIÓN</th>
                  <th className="py-3 px-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5ECEC]/60 text-xs">
                {paginatedEvaluations.map((item) => {
                  const recCat = item.recommendation_category;
                  const recTitle = item.recommendation_title || (
                    recCat === 'A' ? 'Adoptar' : recCat === 'B' ? 'Es posible adoptar' : recCat === 'C' ? 'No se debe adoptar' : 'Finalizada'
                  );

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleRowClick(item.id)}
                      className="hover:bg-[#F6F5F3]/70 transition-colors cursor-pointer group"
                    >
                      {/* Evaluación */}
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-[#2B3F4C] group-hover:text-[#B8531A] transition-colors line-clamp-1">
                          {item.name}
                        </span>
                      </td>

                      {/* Software */}
                      <td className="py-3.5 px-3 text-[#4F6170] font-medium whitespace-nowrap">
                        {item.software?.name || 'Software'}
                      </td>

                      {/* Inicio */}
                      <td className="py-3.5 px-3 text-[#4F6170] whitespace-nowrap">
                        {formatDate(item.start_date || item.created_at)}
                      </td>

                      {/* Finalización */}
                      <td className="py-3.5 px-3 text-[#4F6170] whitespace-nowrap">
                        {formatDate(item.end_date || item.updated_at)}
                      </td>

                      {/* Recomendación FODA */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {recCat === 'A' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#DDF4E4] text-[#1F7A4D] border border-[#A7E3B6]">
                            <span className="w-3.5 h-3.5 rounded-full border border-[#1F7A4D] flex items-center justify-center text-[9px] shrink-0 font-bold">
                              ✓
                            </span>
                            <span>{recTitle}</span>
                          </span>
                        )}
                        {recCat === 'B' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F9E8A0] text-[#5B4A12] border border-[#F6D76D]">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>{recTitle}</span>
                          </span>
                        )}
                        {recCat === 'C' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FDE2C8] text-[#B84318] border border-[#FBB982]">
                            <span className="w-3.5 h-3.5 rounded-full border border-[#B84318] flex items-center justify-center text-[9px] shrink-0 font-bold">
                              ✕
                            </span>
                            <span>{recTitle}</span>
                          </span>
                        )}
                        {!recCat && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#D5ECEC] text-[#16303B]">
                            {recTitle}
                          </span>
                        )}
                      </td>

                      {/* Botón Acción (Flecha) */}
                      <td className="py-3.5 px-2 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(item.id);
                          }}
                          className="w-8 h-8 rounded-full border border-[#D5ECEC] text-[#4F6170] hover:text-[#2B3F4C] hover:border-[#7FBFC1] hover:bg-white inline-flex items-center justify-center transition cursor-pointer shadow-none"
                          title="Ver resultados de la evaluación"
                        >
                          →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Paginación (10 evaluaciones por página) ── */}
        {!isLoading && totalPages > 1 && (
          <div className="pt-4 border-t border-[#D5ECEC]/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none">
            <span className="text-[#4F6170]">
              Página <strong className="text-[#2B3F4C]">{currentPage}</strong> de{' '}
              <strong className="text-[#2B3F4C]">{totalPages}</strong> ({filteredEvaluations.length} total)
            </span>

            <div className="flex items-center gap-1.5">
              {/* Botón Anterior */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 rounded-[12px] font-semibold border transition ${
                  currentPage === 1
                    ? 'border-[#D5ECEC] bg-[#F6F5F3] text-[#4F6170]/40 cursor-not-allowed'
                    : 'border-[#D5ECEC] bg-white text-[#2B3F4C] hover:bg-[#F6F5F3] cursor-pointer'
                }`}
              >
                ← Anterior
              </button>

              {/* Botones de Páginas */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isSelected = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-[12px] font-semibold text-xs transition cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#2B3F4C] text-white shadow-none'
                        : 'bg-white border border-[#D5ECEC] text-[#2B3F4C] hover:bg-[#F6F5F3]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Botón Siguiente */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 rounded-[12px] font-semibold border transition ${
                  currentPage === totalPages
                    ? 'border-[#D5ECEC] bg-[#F6F5F3] text-[#4F6170]/40 cursor-not-allowed'
                    : 'border-[#D5ECEC] bg-white text-[#2B3F4C] hover:bg-[#F6F5F3] cursor-pointer'
                }`}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
