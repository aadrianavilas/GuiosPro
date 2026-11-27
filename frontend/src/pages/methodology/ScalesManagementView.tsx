import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

export interface ScaleLevelItem {
  id: number;
  scale: number;
  value: number;
  label: string;
  order: number;
}

export interface ScaleItem {
  id: number;
  name: string;
  description: string;
  scale_levels: ScaleLevelItem[];
  levels_count: number;
}

export const ScalesManagementView: React.FC = () => {
  const toast = useToast();

  // ── ESTADO PRINCIPAL ──
  const [scales, setScales] = useState<ScaleItem[]>([]);
  const [selectedScaleId, setSelectedScaleId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // ── ESTADO MODAL EDITAR ESCALA ──
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<ScaleItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLevels, setFormLevels] = useState<{ id: number; value: number; label: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Carga de escalas desde la base de datos
  const fetchScales = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/v1/methodology/scales/', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al cargar las escalas de medición.');
      const data: ScaleItem[] = await res.json();
      setScales(data);

      if (data.length > 0) {
        setSelectedScaleId((prev) => {
          if (prev && data.some((s) => s.id === prev)) return prev;
          return data[0].id;
        });
      }
    } catch (err: any) {
      console.error('Error cargando escalas:', err);
      toast.error('No se pudieron cargar las escalas de medición.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScales();
  }, []);

  // Escala seleccionada activa
  const selectedScale = useMemo(() => {
    return scales.find((s) => s.id === selectedScaleId) || scales[0] || null;
  }, [scales, selectedScaleId]);

  // Escalas filtradas por búsqueda
  const filteredScales = useMemo(() => {
    if (!searchQuery.trim()) return scales;
    const q = searchQuery.toLowerCase().trim();
    return scales.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        (s.scale_levels || []).some((l) => l.label.toLowerCase().includes(q))
    );
  }, [scales, searchQuery]);

  // Abrir modal de edición
  const handleOpenEdit = (scale: ScaleItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingScale(scale);
    setFormName(scale.name);
    setFormDesc(scale.description || '');
    const levelsCopy = (scale.scale_levels || [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((lvl) => ({
        id: lvl.id,
        value: lvl.value,
        label: lvl.label,
      }));
    setFormLevels(levelsCopy);
    setModalError(null);
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setEditingScale(null);
    setModalError(null);
  };

  const handleLevelLabelChange = (index: number, newLabel: string) => {
    setFormLevels((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], label: newLabel };
      return copy;
    });
  };

  // Guardar cambios de escala y niveles
  const handleSaveScale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScale) return;

    if (!formName.trim()) {
      setModalError('El nombre de la escala es obligatorio.');
      return;
    }

    try {
      setIsSaving(true);
      setModalError(null);

      // 1. Actualizar escala (nombre y descripción)
      const resScale = await fetch(`/api/v1/methodology/scales/${editingScale.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim(),
        }),
      });

      if (!resScale.ok) {
        const errData = await resScale.json();
        throw new Error(errData.detail || 'Error al actualizar la escala.');
      }

      // 2. Actualizar etiquetas de los niveles en BD
      for (const lvl of formLevels) {
        if (!lvl.id) continue;
        const resLvl = await fetch(`/api/v1/methodology/scale-levels/${lvl.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            label: lvl.label.trim(),
          }),
        });
        if (!resLvl.ok) {
          console.warn(`Error actualizando nivel ${lvl.id}`);
        }
      }

      toast.success('Escala y niveles actualizados correctamente.');
      handleCloseModal();
      await fetchScales();
    } catch (err: any) {
      console.error('Error guardando escala:', err);
      setModalError(err.message || 'No se pudieron guardar los cambios.');
    } finally {
      setIsSaving(false);
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
              Escalas de Medición
            </h2>
            <p className="text-sm sm:text-base text-[#1F3340] leading-relaxed">
              Escalas oficiales de 4 niveles discretos para la ponderación de importancia de factores y valoración de subfactores GUIOS.
            </p>
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="bg-white/80 backdrop-blur-sm rounded-[16px] px-4 py-3 border border-[#FBB982] text-center shadow-none">
              <span className="text-2xl font-serif font-bold text-[#2B3F4C] block leading-none">
                {scales.length}
              </span>
              <span className="text-[10px] font-bold text-[#5B4A12] uppercase tracking-wider mt-1 block">
                Escalas
              </span>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-[16px] px-4 py-3 border border-[#FBB982] text-center shadow-none">
              <span className="text-2xl font-serif font-bold text-[#2B3F4C] block leading-none">
                {scales.reduce((acc, s) => acc + (s.scale_levels?.length || 0), 0) || 8}
              </span>
              <span className="text-[10px] font-bold text-[#5B4A12] uppercase tracking-wider mt-1 block">
                Niveles Totales
              </span>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-[16px] px-4 py-3 border border-[#FBB982] text-center shadow-none">
              <span className="text-2xl font-serif font-bold text-[#2B3F4C] block leading-none">
                1 - 4
              </span>
              <span className="text-[10px] font-bold text-[#5B4A12] uppercase tracking-wider mt-1 block">
                Rango Valorativo
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
              placeholder="Buscar escala o nivel..."
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
                <GuiosProSpinner size="lg" label="Cargando escalas..." />
              </div>
            ) : filteredScales.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-medium">
                No se encontraron escalas coincidentes.
              </div>
            ) : (
              filteredScales.map((scale) => {
                const isSelected = selectedScale?.id === scale.id;
                return (
                  <div
                    key={scale.id}
                    onClick={() => setSelectedScaleId(scale.id)}
                    className={`rounded-[18px] p-4 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#D5ECEC]/30 border-[#7FBFC1] shadow-xs'
                        : 'bg-white border-gray-200 hover:border-[#B4D6D6] hover:bg-gray-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-serif text-base font-bold text-[#2B3F4C] truncate">
                            {scale.name}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D5ECEC] text-[#16303B]">
                            {scale.scale_levels?.length || 4} niveles
                          </span>
                        </div>
                        <p className="text-xs text-[#4F6170] mt-1 line-clamp-2 leading-relaxed">
                          {scale.description || 'Sin descripción metodológica.'}
                        </p>
                      </div>

                      {/* Botón Editar en Card */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(scale, e)}
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

        {/* ── COLUMNA DERECHA: Detalle de la Escala Seleccionada (Boceto) ── */}
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

            {selectedScale && (
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedScale)}
                className="px-4 py-2 rounded-xl bg-[#243642] hover:bg-[#16303B] text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Editar escala
              </button>
            )}
          </div>

          {!selectedScale ? (
            <div className="p-12 text-center text-xs text-gray-400">
              Selecciona una escala de la lista para ver su detalle.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Información General */}
              <div className="bg-[#F6F5F3] rounded-[18px] p-5 border border-gray-200 space-y-2">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  Escala seleccionada
                </span>
                <h3 className="font-serif text-xl font-bold text-[#243642]">
                  {selectedScale.name}
                </h3>
                <p className="text-xs text-[#4F6170] leading-relaxed">
                  {selectedScale.description || 'Sin descripción detallada.'}
                </p>
              </div>

              {/* Niveles de Medición (1 al 4) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-base font-bold text-[#2B3F4C]">
                    Niveles de medición ({selectedScale.scale_levels?.length || 4})
                  </h4>
                  <span className="text-[11px] text-gray-500">
                    Valores fijos: 1 al 4
                  </span>
                </div>

                <div className="border border-gray-200 rounded-[18px] overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#D5ECEC] text-[#243642] text-[11px] font-bold tracking-wider uppercase border-b border-[#B8DFE0]">
                        <th className="py-3 px-5 text-center w-20">VALOR</th>
                        <th className="py-3 px-5">ETIQUETA OFICIAL</th>
                        <th className="py-3 px-5 text-center w-28">NIVEL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(selectedScale.scale_levels || [])
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((lvl) => (
                          <tr key={lvl.id} className="hover:bg-gray-50/60 transition">
                            <td className="py-3.5 px-5 text-center font-mono font-bold text-sm text-[#243642]">
                              {lvl.value}
                            </td>
                            <td className="py-3.5 px-5 font-semibold text-xs text-[#243642]">
                              {lvl.label}
                            </td>
                            <td className="py-3.5 px-5 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F6F5F3] text-gray-600 border border-gray-200">
                                Nivel {lvl.order}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL EDITAR ESCALA (SIN CREAR NI ELIMINAR NI ARRASTRAR) ── */}
      {isEditModalOpen && editingScale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-[24px] max-w-2xl w-full p-6 sm:p-7 space-y-5 border border-[#D5ECEC] shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-[#D5ECEC]/80 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D5ECEC] flex items-center justify-center text-[#243642] shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-serif text-2xl font-bold text-[#2B3F4C] leading-tight">
                    Editar escala de medición
                  </h2>
                  <p className="text-xs text-[#4F6170] mt-0.5">
                    Modifica los textos descriptivos y etiquetas oficiales de los niveles
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

            {/* Formulario */}
            <form onSubmit={handleSaveScale} className="flex-1 overflow-y-auto pr-1 space-y-4">
              {modalError && (
                <div className="p-3.5 bg-[#FFF1F0] border border-[#FFA39E] rounded-xl text-xs text-[#CF1322]">
                  {modalError}
                </div>
              )}

              {/* Nombre de la Escala */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2B3F4C]">
                  Nombre de la escala *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F6F5F3] rounded-xl text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition"
                  placeholder="Ej. Factor, Subfactor..."
                  required
                />
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2B3F4C]">
                  Descripción
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-[#F6F5F3] rounded-xl text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition resize-none"
                  placeholder="Descripción metodológica de la escala..."
                />
              </div>

              {/* Niveles de Escala (Fijos 1..4, solo edición de etiqueta) */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#2B3F4C]">
                    Etiquetas de los niveles de medición (1 al 4)
                  </label>
                  <span className="text-[11px] text-gray-400">
                    Estructura fija GUIOS
                  </span>
                </div>

                <div className="space-y-2">
                  {formLevels.map((lvl, idx) => (
                    <div
                      key={lvl.id || idx}
                      className="flex items-center gap-3 bg-[#F6F5F3] rounded-xl p-2.5 border border-gray-200"
                    >
                      <span className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-mono font-bold text-xs text-[#243642] shrink-0">
                        {lvl.value}
                      </span>
                      <input
                        type="text"
                        value={lvl.label}
                        onChange={(e) => handleLevelLabelChange(idx, e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white rounded-lg text-xs text-[#2B3F4C] border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#7FBFC1] transition"
                        placeholder={`Etiqueta para nivel ${lvl.value}...`}
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Botones de Acción */}
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