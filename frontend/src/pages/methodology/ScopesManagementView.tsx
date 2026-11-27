import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

export interface ScopeItem {
  id: number;
  name: string;
  description: string | null;
}

export const ScopesManagementView: React.FC = () => {
  const toast = useToast();

  const [scopes, setScopes] = useState<ScopeItem[]>([]);
  const [selectedScopeId, setSelectedScopeId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal Editar
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingScope, setEditingScope] = useState<ScopeItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchScopes = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/v1/methodology/scopes/', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al cargar los alcances metodológicos.');
      const data: ScopeItem[] = await res.json();
      setScopes(data);

      if (data.length > 0) {
        setSelectedScopeId((prev) => {
          if (prev && data.some((s) => s.id === prev)) return prev;
          return data[0].id;
        });
      }
    } catch (err: any) {
      console.error('Error cargando alcances:', err);
      toast.error('No se pudieron cargar los alcances metodológicos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScopes();
  }, []);

  const selectedScope = useMemo(() => {
    return scopes.find((s) => s.id === selectedScopeId) || scopes[0] || null;
  }, [scopes, selectedScopeId]);

  const filteredScopes = useMemo(() => {
    if (!searchQuery.trim()) return scopes;
    const q = searchQuery.toLowerCase().trim();
    return scopes.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
    );
  }, [scopes, searchQuery]);

  const handleOpenEdit = (scope: ScopeItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingScope(scope);
    setFormName(scope.name);
    setFormDesc(scope.description || '');
    setModalError(null);
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setEditingScope(null);
    setModalError(null);
  };

  const handleSaveScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScope) return;

    if (!formName.trim()) {
      setModalError('El nombre del alcance es obligatorio.');
      return;
    }

    try {
      setIsSaving(true);
      setModalError(null);

      const res = await fetch(`/api/v1/methodology/scopes/${editingScope.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error al actualizar el alcance.');
      }

      toast.success('Alcance metodológico actualizado correctamente.');
      handleCloseModal();
      await fetchScopes();
    } catch (err: any) {
      console.error('Error guardando alcance:', err);
      setModalError(err.message || 'No se pudieron guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  const getFodaDetails = (scopeName: string) => {
    const isInterno = scopeName.toLowerCase().includes('interno');
    return {
      foda: isInterno ? 'Fortalezas y Debilidades' : 'Oportunidades y Amenazas',
      origin: isInterno ? 'Factores propios de la organización' : 'Factores del entorno y la solución de software',
      badgeClass: isInterno ? 'bg-[#D5ECEC] text-[#16303B]' : 'bg-[#F9E8A0] text-[#5B4A12]',
    };
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
              Alcance Metodológico
            </h2>
            <p className="text-sm sm:text-base text-[#1F3340] leading-relaxed">
              Definición del alcance (Interno y Externo) que determina la clasificación en los cuatro cuadrantes de la matriz FODA.
            </p>
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="bg-white/80 backdrop-blur-sm rounded-[16px] px-4 py-3 border border-[#FBB982] text-center shadow-none">
              <span className="text-2xl font-serif font-bold text-[#2B3F4C] block leading-none">
                {scopes.length}
              </span>
              <span className="text-[10px] font-bold text-[#5B4A12] uppercase tracking-wider mt-1 block">
                Alcances
              </span>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-[16px] px-4 py-3 border border-[#FBB982] text-center shadow-none">
              <span className="text-2xl font-serif font-bold text-[#2B3F4C] block leading-none">
                4
              </span>
              <span className="text-[10px] font-bold text-[#5B4A12] uppercase tracking-wider mt-1 block">
                Cuadrantes FODA
              </span>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-[16px] px-4 py-3 border border-[#FBB982] text-center shadow-none">
              <span className="text-2xl font-serif font-bold text-[#2B3F4C] block leading-none">
                100%
              </span>
              <span className="text-[10px] font-bold text-[#5B4A12] uppercase tracking-wider mt-1 block">
                Estructura GUIOS
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Estructura de Dos Columnas (Boceto) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── COLUMNA IZQUIERDA: Buscador y Cards con botón Editar ── */}
        <div className="lg:col-span-5 bg-white rounded-[24px] p-5 border border-[#D5ECEC] shadow-2xs space-y-4">
          {/* Buscador */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.15z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar alcance..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#F6F5F3] hover:bg-gray-50 focus:bg-white rounded-xl text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Lista de Cards */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <GuiosProSpinner size="lg" label="Cargando alcances..." />
              </div>
            ) : filteredScopes.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-medium">
                No se encontraron alcances coincidentes.
              </div>
            ) : (
              filteredScopes.map((sc) => {
                const isSelected = selectedScope?.id === sc.id;
                const fodaInfo = getFodaDetails(sc.name);
                return (
                  <div
                    key={sc.id}
                    onClick={() => setSelectedScopeId(sc.id)}
                    className={`rounded-[18px] p-4 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#D5ECEC]/30 border-[#7FBFC1] shadow-xs'
                        : 'bg-white border-gray-200 hover:border-[#B4D6D6] hover:bg-gray-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-serif text-base font-bold text-[#2B3F4C]">
                            {sc.name}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${fodaInfo.badgeClass}`}>
                            {fodaInfo.foda}
                          </span>
                        </div>
                        <p className="text-xs text-[#4F6170] mt-1 line-clamp-2 leading-relaxed">
                          {sc.description || fodaInfo.origin}
                        </p>
                      </div>

                      {/* Botón Editar en Card */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(sc, e)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#D5ECEC] border border-gray-200 hover:border-[#7FBFC1] text-[#243642] text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── COLUMNA DERECHA: Detalle del Alcance Seleccionado (Boceto) ── */}
        <div className="lg:col-span-7 bg-white rounded-[24px] p-6 border border-[#D5ECEC] shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#D5ECEC]/80 pb-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                SECCIÓN
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#2B3F4C] tracking-tight">
                Detalle
              </h2>
            </div>

            {selectedScope && (
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedScope)}
                className="px-4 py-2 rounded-xl bg-[#243642] hover:bg-[#16303B] text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Editar alcance
              </button>
            )}
          </div>

          {!selectedScope ? (
            <div className="p-12 text-center text-xs text-gray-400">
              Selecciona un alcance de la lista para ver su detalle.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Información General */}
              <div className="bg-[#F6F5F3] rounded-[18px] p-5 border border-gray-200 space-y-3">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                  Alcance seleccionado
                </span>
                <div className="flex items-center gap-3">
                  <h3 className="font-serif text-2xl font-bold text-[#243642]">
                    {selectedScope.name}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getFodaDetails(selectedScope.name).badgeClass}`}>
                    {getFodaDetails(selectedScope.name).foda}
                  </span>
                </div>
                <p className="text-xs text-[#4F6170] leading-relaxed">
                  {selectedScope.description || 'Sin descripción detallada registrada.'}
                </p>
              </div>

              {/* Regla Metodológica FODA */}
              <div className="bg-[#D5ECEC]/20 border border-[#B4D6D6] rounded-[18px] p-5 space-y-2">
                <h4 className="font-serif text-base font-bold text-[#16303B]">
                  Impacto en la clasificación FODA
                </h4>
                <p className="text-xs text-[#2B3F4C] leading-relaxed">
                  Cuando un factor tiene alcance <strong>{selectedScope.name}</strong>, su ponderación media (&ge; 3.0 o &lt; 3.0) se traduce en:{' '}
                  <strong>{getFodaDetails(selectedScope.name).foda}</strong>. Esta regla matemática garantiza la coherencia con los cuatro cuadrantes de la metodología GUIOS.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL EDITAR ALCANCE (SIN CREAR NI ELIMINAR) ── */}
      {isEditModalOpen && editingScope && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-[24px] max-w-lg w-full p-6 sm:p-7 space-y-5 border border-[#D5ECEC] shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#D5ECEC]/80 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D5ECEC] flex items-center justify-center text-[#243642] shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-serif text-2xl font-bold text-[#2B3F4C] leading-tight">
                    Editar alcance
                  </h2>
                  <p className="text-xs text-[#4F6170] mt-0.5">
                    Modifica el nombre y descripción del alcance metodológico
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveScope} className="space-y-4">
              {modalError && (
                <div className="p-3.5 bg-[#FFF1F0] border border-[#FFA39E] rounded-xl text-xs text-[#CF1322]">
                  {modalError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2B3F4C]">
                  Nombre del alcance *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F6F5F3] rounded-xl text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition"
                  placeholder="Ej. Interno, Externo..."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2B3F4C]">
                  Descripción metodológica
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-[#F6F5F3] rounded-xl text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition resize-none"
                  placeholder="Descripción detallada del alcance..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D5ECEC]/80">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSaving}
                  className="px-5 py-2.5 text-xs font-semibold text-[#2B3F4C] bg-white hover:bg-gray-50 border border-gray-200 rounded-[14px] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-[#243642] hover:bg-[#16303B] rounded-[14px] transition cursor-pointer shadow-xs"
                >
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};