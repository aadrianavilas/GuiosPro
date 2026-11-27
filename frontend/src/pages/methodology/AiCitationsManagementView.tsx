import React, { useEffect, useState } from 'react';
import { AiCitationDetailModal } from '@/components/methodology/AiCitationDetailModal';
import { AiCitationRestoreModal } from '@/components/methodology/AiCitationRestoreModal';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

interface QueryListItem {
  id: number;
  query_date: string;
  start_period: string;
  end_period: string;
  total_factors: number;
  total_databases: number;
  status: string;
  status_display: string;
  user_display: string;
}

export const AiCitationsManagementView: React.FC = () => {
  const [queries, setQueries] = useState<QueryListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Modales
  const [selectedDetailQueryId, setSelectedDetailQueryId] = useState<number | null>(null);
  const [selectedRestoreQueryId, setSelectedRestoreQueryId] = useState<number | null>(null);

  const fetchQueries = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const res = await fetch(`/api/v1/methodology/ai-citations/queries/?${params.toString()}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data: QueryListItem[] = await res.json();
        setQueries(data);
      } else {
        setError('No fue posible cargar las consultas de IA.');
      }
    } catch (err) {
      console.error('Error cargando consultas de IA:', err);
      setError('Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQueries();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, dateFrom, dateTo]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'all' || dateFrom || dateTo);

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
      const datePart = d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const timePart = d.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${datePart} ${timePart}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* ── Banner Institucional de Metodología ── */}
      <div className="relative overflow-hidden rounded-[24px] bg-[#F7A35F] px-8 py-7 shadow-none border border-[#FBB982]/60">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#FBB982]/40 pointer-events-none" />
        <div className="absolute -bottom-16 right-24 w-40 h-40 rounded-full bg-[#FBB982]/30 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-block px-3 py-1 text-[11px] font-bold tracking-wider uppercase rounded-full bg-[#F9E8A0] text-[#5B4A12] mb-3">
              METODOLOGÍA GUIOS — GESTIÓN
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-medium text-[#2B3F4C] tracking-tight mb-2">
              Consulta Total de Citas con IA
            </h2>
            <p className="text-sm sm:text-base text-[#1F3340] leading-relaxed">
              Historial de consultas bibliométricas, registro de literatura científica y restauración de versiones metodológicas.
            </p>
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="bg-white/80 backdrop-blur-sm rounded-[16px] px-4 py-3 border border-[#FBB982] text-center shadow-none">
              <span className="text-2xl font-serif font-bold text-[#2B3F4C] block leading-none">
                {queries.length}
              </span>
              <span className="text-[10px] font-bold text-[#5B4A12] uppercase tracking-wider mt-1 block">
                Consultas
              </span>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-[16px] px-4 py-3 border border-[#FBB982] text-center shadow-none">
              <span className="text-2xl font-serif font-bold text-[#2B3F4C] block leading-none">
                {queries.filter((q) => q.status === 'COMPLETED').length}
              </span>
              <span className="text-[10px] font-bold text-[#5B4A12] uppercase tracking-wider mt-1 block">
                Completadas
              </span>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-[16px] px-4 py-3 border border-[#FBB982] text-center shadow-none">
              <span className="text-2xl font-serif font-bold text-[#2B3F4C] block leading-none">
                {queries.length > 0 ? (queries[0].total_databases || 4) : 4}
              </span>
              <span className="text-[10px] font-bold text-[#5B4A12] uppercase tracking-wider mt-1 block">
                Bases Científicas
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Buscador y Filtros ── */}
      <div className="bg-white rounded-[24px] p-5 border border-[#D5ECEC] shadow-2xs space-y-3">
          {/* Barra de Búsqueda */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.15z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por ID, usuario, factor o base científica..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#F6F5F3] hover:bg-gray-50 focus:bg-white rounded-xl text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtros Rápidos */}
          <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Filtros:
            </span>

            {/* Filtro Estado */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 bg-[#F6F5F3] rounded-xl text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition cursor-pointer"
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Completadas</option>
              <option value="partial">Parciales</option>
              <option value="failed">Fallidas</option>
            </select>

            {/* Fecha desde */}
            <div className="flex items-center gap-1.5 bg-[#F6F5F3] px-2.5 py-1 rounded-xl border border-gray-200">
              <span className="text-[10px] text-gray-400 font-bold">Desde:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-xs text-[#2B3F4C] focus:outline-none cursor-pointer"
              />
            </div>

            {/* Fecha hasta */}
            <div className="flex items-center gap-1.5 bg-[#F6F5F3] px-2.5 py-1 rounded-xl border border-gray-200">
              <span className="text-[10px] text-gray-400 font-bold">Hasta:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-xs text-[#2B3F4C] focus:outline-none cursor-pointer"
              />
            </div>

            {/* Limpiar Filtros */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-[#B8531A] hover:underline font-bold transition cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

      {/* ── Tabla Principal de Consultas (Imagen 1) ── */}
      <div className="bg-white rounded-[24px] border border-[#D5ECEC] shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center">
            <GuiosProSpinner size="lg" label="Cargando consultas de IA..." />
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm text-[#B8531A]">{error}</p>
            <button
              type="button"
              onClick={fetchQueries}
              className="px-4 py-2 bg-[#D5ECEC] hover:bg-[#7FBFC1] text-[#16303B] rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        ) : queries.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#D5ECEC]/50 flex items-center justify-center text-[#243642]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="font-serif text-lg font-bold text-[#2B3F4C]">
              {hasActiveFilters ? 'No hay resultados para estos filtros' : 'No se han registrado consultas con IA'}
            </h3>
            <p className="text-xs text-[#4F6170] max-w-sm mx-auto">
              {hasActiveFilters
                ? 'Intenta ajustar los términos de búsqueda o limpiar los filtros seleccionados.'
                : 'Las búsquedas bibliométricas ejecutadas desde el panel de Dimensiones quedarán registradas aquí.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#D5ECEC] text-[#243642] text-[11px] font-bold tracking-wider uppercase border-b border-[#B8DFE0]">
                  <th className="py-3.5 px-5">FECHA CONSULTA</th>
                  <th className="py-3.5 px-4">PERIODO INICIO</th>
                  <th className="py-3.5 px-4">PERIODO FIN</th>
                  <th className="py-3.5 px-4 text-center">TOTAL FACTORES</th>
                  <th className="py-3.5 px-4 text-center">TOTAL BASES</th>
                  <th className="py-3.5 px-4">USUARIO</th>
                  <th className="py-3.5 px-5 text-right font-semibold">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {queries.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/70 transition">
                    {/* Fecha de Consulta */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-400 font-bold text-[11px]">
                          #{item.id}
                        </span>
                        <span className="font-bold text-xs text-[#243642]">
                          {formatDateTime(item.query_date)}
                        </span>
                      </div>
                    </td>

                    {/* Periodo Inicio */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-gray-600 font-medium">
                      {formatDate(item.start_period)}
                    </td>

                    {/* Periodo Fin */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-gray-600 font-medium">
                      {formatDate(item.end_period)}
                    </td>

                    {/* Total Factores */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F6F5F3] text-[#243642] border border-gray-200">
                        {item.total_factors}
                      </span>
                    </td>

                    {/* Total Bases */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D5ECEC]/60 text-[#16303B]">
                        {item.total_databases}
                      </span>
                    </td>

                    {/* Usuario */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-xs text-[#243642]">
                        {item.user_display}
                      </span>
                    </td>

                    {/* Acciones: Ver detalle (ojo) y Restaurar (flecha) */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Botón Ver Detalle (Ojo) */}
                        <button
                          type="button"
                          onClick={() => setSelectedDetailQueryId(item.id)}
                          title="Ver detalle completo de la consulta"
                          className="w-8 h-8 rounded-xl bg-white hover:bg-[#D5ECEC] border border-gray-200 hover:border-[#7FBFC1] text-[#243642] flex items-center justify-center transition shadow-2xs cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>

                        {/* Botón Restaurar (Flecha / Restaurar versión) */}
                        <button
                          type="button"
                          onClick={() => setSelectedRestoreQueryId(item.id)}
                          title="Restaurar esta versión de citas en los factores"
                          className="w-8 h-8 rounded-xl bg-[#F7A35F]/20 hover:bg-[#F7A35F] text-[#B8531A] hover:text-white border border-[#F7A35F]/40 flex items-center justify-center transition shadow-2xs cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de Detalle de Consulta ── */}
      <AiCitationDetailModal
        isOpen={Boolean(selectedDetailQueryId)}
        onClose={() => setSelectedDetailQueryId(null)}
        queryId={selectedDetailQueryId}
      />

      {/* ── Modal de Restaurar Versión ── */}
      <AiCitationRestoreModal
        isOpen={Boolean(selectedRestoreQueryId)}
        onClose={() => setSelectedRestoreQueryId(null)}
        queryId={selectedRestoreQueryId}
        onSuccess={fetchQueries}
      />
    </div>
  );
};