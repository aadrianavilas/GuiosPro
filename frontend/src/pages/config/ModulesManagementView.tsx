import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';
import { DynamicIcon } from '@/components/navigation/DynamicIcon';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

export interface ModuleOptionItem {
  id: number;
  name: string;
  icon: string;
  path: string;
  order: number;
  is_active: boolean;
  slug?: string;
}

export interface ModuleItem {
  id: number;
  name: string;
  order: number;
  icon: string | null;
  module_options?: ModuleOptionItem[];
  options_count?: number;
}

// Lista de íconos representativos disponibles en GuiosPro para seleccionar en los modales
const AVAILABLE_ICONS = [
  'Squares2X2Icon',
  'HomeIcon',
  'BuildingOfficeIcon',
  'ClipboardDocumentListIcon',
  'PlusCircleIcon',
  'ClockIcon',
  'UserCircleIcon',
  'AdjustmentsHorizontalIcon',
  'RectangleGroupIcon',
  'ListBulletIcon',
  'ChartBarIcon',
  'GlobeAltIcon',
  'CogIcon',
  'ShieldCheckIcon',
  'KeyIcon',
  'UsersIcon',
  'DocumentCheckIcon',
];

export const ModulesManagementView: React.FC = () => {
  const toast = useToast();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Buscador de módulos y opciones
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Control de acordeón desplegable por id de módulo
  const [expandedModuleIds, setExpandedModuleIds] = useState<Record<number, boolean>>({
    3: true, // Desplegado por defecto para Evaluación según mockup
  });

  // Estados para Drag and Drop de MÓDULOS
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState<boolean>(false);

  // Estados para Drag and Drop de OPCIONES dentro de un módulo
  const [draggedOption, setDraggedOption] = useState<{ moduleId: number; index: number } | null>(null);
  const [dragOverOptionIndex, setDragOverOptionIndex] = useState<number | null>(null);
  const [isSavingOptionOrder, setIsSavingOptionOrder] = useState<boolean>(false);

  // Estado del modal de edición de MÓDULO
  const [editingModule, setEditingModule] = useState<ModuleItem | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editIcon, setEditIcon] = useState<string>('Squares2X2Icon');
  const [editOrder, setEditOrder] = useState<number>(1);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Estado del modal de edición de OPCIÓN
  const [editingOption, setEditingOption] = useState<{ moduleId: number; option: ModuleOptionItem } | null>(null);
  const [editOptionName, setEditOptionName] = useState<string>('');
  const [editOptionIcon, setEditOptionIcon] = useState<string>('ClipboardDocumentListIcon');
  const [isSavingOptionEdit, setIsSavingOptionEdit] = useState<boolean>(false);
  const [editOptionError, setEditOptionError] = useState<string | null>(null);

  // Estado de actualización de toggles de opciones
  const [togglingOptionId, setTogglingOptionId] = useState<number | null>(null);

  const showNotification = (message: string) => {
    toast.success(message);
  };

  // Cargar módulos y opciones desde la API
  const fetchModules = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/config/modules/', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('No se pudieron obtener los módulos del sistema.');
      }

      const data: ModuleItem[] = await response.json();
      if (Array.isArray(data)) {
        const sorted = [...data]
          .sort((a, b) => a.order - b.order)
          .map((mod) => ({
            ...mod,
            module_options: [...(mod.module_options || [])].sort((a, b) => a.order - b.order),
          }));
        setModules(sorted);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  // Alternar despliegue de un módulo
  const toggleExpand = (moduleId: number) => {
    setExpandedModuleIds((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  // Activar o desactivar una opción de módulo
  const handleToggleOption = async (moduleId: number, optionId: number, currentActive: boolean) => {
    const newActiveState = !currentActive;

    // Actualización optimista en el estado local
    setModules((prevModules) =>
      prevModules.map((mod) => {
        if (mod.id !== moduleId) return mod;
        const updatedOptions = (mod.module_options || []).map((opt) =>
          opt.id === optionId ? { ...opt, is_active: newActiveState } : opt
        );
        return { ...mod, module_options: updatedOptions };
      })
    );

    try {
      setTogglingOptionId(optionId);
      const response = await fetch(`/api/v1/config/modules/toggle-option/${optionId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: newActiveState }),
      });

      if (!response.ok) {
        throw new Error('No se pudo actualizar el estado de la opción.');
      }

      const updatedOpt = await response.json();
      showNotification(`Opción "${updatedOpt.name}" ${newActiveState ? 'activada' : 'desactivada'}.`);

      // Notificar al menú lateral para que actualice opciones visibles en tiempo real
      window.dispatchEvent(new CustomEvent('guiospro_modules_updated'));
    } catch (err: any) {
      console.error(err);
      toast.error('Hubo un error al cambiar el estado de la opción en el servidor.');
      fetchModules();
    } finally {
      setTogglingOptionId(null);
    }
  };

  // ── Drag and Drop de MÓDULOS ──
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updatedList = [...modules];
    const [movedItem] = updatedList.splice(draggedIndex, 1);
    updatedList.splice(targetIndex, 0, movedItem);

    // Recalcular orden secuencial (1, 2, 3...)
    const reorderedList = updatedList.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    setModules(reorderedList);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Persistir nuevo orden en el backend
    await saveNewOrder(reorderedList);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const saveNewOrder = async (orderedItems: ModuleItem[]) => {
    try {
      setIsSavingOrder(true);
      const payload = orderedItems.map((item) => ({
        id: item.id,
        order: item.order,
      }));

      const response = await fetch('/api/v1/config/modules/reorder/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('No se pudo guardar el nuevo orden.');
      }

      showNotification('Orden de módulos actualizado exitosamente.');
      window.dispatchEvent(new CustomEvent('guiospro_modules_updated'));
    } catch (err: any) {
      console.error(err);
      toast.error('Hubo un problema al guardar el nuevo orden en el servidor.');
      fetchModules();
    } finally {
      setIsSavingOrder(false);
    }
  };

  // ── Drag and Drop de OPCIONES dentro de un módulo ──
  const handleOptionDragStart = (e: React.DragEvent<HTMLDivElement>, moduleId: number, index: number) => {
    e.stopPropagation();
    setDraggedOption({ moduleId, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ moduleId, index }));
  };

  const handleOptionDragOver = (e: React.DragEvent<HTMLDivElement>, moduleId: number, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedOption || draggedOption.moduleId !== moduleId) return;
    e.dataTransfer.dropEffect = 'move';
    if (dragOverOptionIndex !== index) {
      setDragOverOptionIndex(index);
    }
  };

  const handleOptionDrop = async (e: React.DragEvent<HTMLDivElement>, targetModuleId: number, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedOption || draggedOption.moduleId !== targetModuleId || draggedOption.index === targetIndex) {
      setDraggedOption(null);
      setDragOverOptionIndex(null);
      return;
    }

    const { moduleId, index: sourceIndex } = draggedOption;
    setDraggedOption(null);
    setDragOverOptionIndex(null);

    const targetModule = modules.find((m) => m.id === moduleId);
    if (!targetModule || !targetModule.module_options) return;

    const updatedOptions = [...targetModule.module_options];
    const [movedOption] = updatedOptions.splice(sourceIndex, 1);
    updatedOptions.splice(targetIndex, 0, movedOption);

    // Recalcular orden secuencial (1, 2, 3...)
    const reorderedOptions = updatedOptions.map((opt, idx) => ({
      ...opt,
      order: idx + 1,
    }));

    // Actualización inmediata del estado local
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, module_options: reorderedOptions } : m))
    );

    // Persistir orden en backend
    try {
      setIsSavingOptionOrder(true);
      const payload = reorderedOptions.map((opt) => ({
        id: opt.id,
        order: opt.order,
      }));

      const response = await fetch('/api/v1/config/modules/reorder-options/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('No se pudo guardar el nuevo orden de opciones.');
      }

      showNotification('Orden de opciones actualizado exitosamente.');
      window.dispatchEvent(new CustomEvent('guiospro_modules_updated'));
    } catch (err: any) {
      console.error(err);
      toast.error('Hubo un error al guardar el orden de las opciones.');
      fetchModules();
    } finally {
      setIsSavingOptionOrder(false);
    }
  };

  // ── Edición de MÓDULO ──
  const openEditModal = (mod: ModuleItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingModule(mod);
    setEditName(mod.name);
    setEditIcon(mod.icon || 'Squares2X2Icon');
    setEditOrder(mod.order);
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingModule(null);
    setEditName('');
    setEditIcon('Squares2X2Icon');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModule) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError('El nombre del módulo no puede estar vacío.');
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditError(null);

      const response = await fetch(`/api/v1/config/modules/${editingModule.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: trimmedName,
          icon: editIcon,
          order: editOrder,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.name?.[0] || 'Error al guardar el módulo.');
      }

      const updatedModule: ModuleItem = await response.json();

      setModules((prev) =>
        prev
          .map((m) => (m.id === updatedModule.id ? { ...m, ...updatedModule } : m))
          .sort((a, b) => a.order - b.order)
      );

      closeEditModal();
      showNotification(`Módulo "${trimmedName}" actualizado correctamente.`);
      window.dispatchEvent(new CustomEvent('guiospro_modules_updated'));
    } catch (err: any) {
      setEditError(err.message || 'Error al guardar los cambios.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Edición de OPCIÓN ──
  const openEditOptionModal = (moduleId: number, option: ModuleOptionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOption({ moduleId, option });
    setEditOptionName(option.name);
    setEditOptionIcon(option.icon || 'ClipboardDocumentListIcon');
    setEditOptionError(null);
  };

  const closeEditOptionModal = () => {
    setEditingOption(null);
    setEditOptionName('');
    setEditOptionIcon('ClipboardDocumentListIcon');
    setEditOptionError(null);
  };

  const handleSaveOptionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOption) return;

    const trimmedName = editOptionName.trim();
    if (!trimmedName) {
      setEditOptionError('El nombre de la opción no puede estar vacío.');
      return;
    }

    try {
      setIsSavingOptionEdit(true);
      setEditOptionError(null);

      const response = await fetch(`/api/v1/config/modules/update-option/${editingOption.option.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: trimmedName,
          icon: editOptionIcon,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Error al actualizar los datos de la opción.');
      }

      const updatedOpt: ModuleOptionItem = await response.json();

      setModules((prev) =>
        prev.map((m) => {
          if (m.id !== editingOption.moduleId) return m;
          const updatedList = (m.module_options || []).map((opt) =>
            opt.id === updatedOpt.id ? { ...opt, ...updatedOpt } : opt
          );
          return { ...m, module_options: updatedList };
        })
      );

      closeEditOptionModal();
      showNotification(`Opción "${trimmedName}" actualizada correctamente.`);
      window.dispatchEvent(new CustomEvent('guiospro_modules_updated'));
    } catch (err: any) {
      setEditOptionError(err.message || 'Error al guardar los cambios de la opción.');
    } finally {
      setIsSavingOptionEdit(false);
    }
  };

  // Filtrado de módulos según el buscador
  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return modules;

    return modules.filter((mod) => {
      const matchModuleName = (mod.name || '').toLowerCase().includes(q);
      const matchOptionName = (mod.module_options || []).some((opt) =>
        (opt.name || '').toLowerCase().includes(q) || (opt.slug || '').toLowerCase().includes(q)
      );
      return matchModuleName || matchOptionName;
    });
  }, [modules, searchQuery]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      {/* ── Banner Superior Institucional GuiosPro ── */}
      <div className="relative overflow-hidden rounded-[24px] bg-[#F7A35F] px-8 py-7 shadow-none border border-[#FBB982]/60">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#FBB982]/40 pointer-events-none" />
        <div className="absolute -bottom-16 right-24 w-40 h-40 rounded-full bg-[#FBB982]/30 pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <span className="inline-block px-3 py-1 text-[11px] font-bold tracking-wider uppercase rounded-full bg-[#F9E8A0] text-[#5B4A12] mb-3">
            CONFIGURACIÓN DEL SISTEMA
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-medium text-[#2B3F4C] tracking-tight mb-2">
            Módulos del sistema
          </h1>
          <p className="text-xs sm:text-sm text-[#2B3F4C]/90 leading-relaxed font-sans">
            Administra las categorías de módulos, reordena por arrastre y gestiona la activación, nombre, ícono y orden de cada opción.
          </p>
        </div>
      </div>

      {/* ── Buscador y Barra de Herramientas ── */}
      <div className="bg-white rounded-[20px] border border-[#D5ECEC] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 shadow-none">
        {/* Input Buscador */}
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
            placeholder="Buscar módulos u opciones..."
            className="w-full pl-9 pr-3.5 py-2.5 text-xs text-[#2B3F4C] bg-white border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition placeholder-[#4F6170]/60"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#4F6170] hover:text-[#2B3F4C] cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Indicadores / Estado */}
        <div className="flex items-center gap-2 shrink-0">
          {(isSavingOrder || isSavingOptionOrder) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F9E8A0] text-[#5B4A12]">
              <span className="w-2 h-2 rounded-full bg-[#B8531A] animate-ping" />
              {isSavingOptionOrder ? 'Guardando orden de opciones...' : 'Guardando orden de módulos...'}
            </span>
          )}
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F6F5F3] text-[#4F6170] border border-[#D5ECEC]">
            {filteredModules.length} de {modules.length} módulos
          </span>
        </div>
      </div>

      {/* ── Contenedor Blanco Principal de Módulos (Exactamente según Mockup) ── */}
      <div className="bg-white rounded-[24px] border border-[#D5ECEC] p-6 sm:p-7 shadow-none space-y-4">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-lg font-serif font-bold text-[#2B3F4C]">
            Módulos registrados ({filteredModules.length})
          </h2>
          <span className="text-xs text-[#4F6170]">
            Usa el tirador ⋮⋮ para arrastrar
          </span>
        </div>

        <div className="space-y-3.5">
          {/* Skeleton de Carga */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center">
              <GuiosProSpinner size="lg" label="Cargando módulos y accesos..." />
            </div>
          )}

          {/* Tarjetas de Módulos */}
          {!isLoading &&
            filteredModules.map((mod, index) => {
              const isDragging = draggedIndex === index;
              const isOver = dragOverIndex === index && draggedIndex !== index;
              const isExpanded = Boolean(expandedModuleIds[mod.id]);
              const options = mod.module_options || [];
              const activeCount = options.filter((o) => o.is_active).length;
              const totalCount = options.length;

              return (
                <div
                  key={mod.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`bg-white rounded-[20px] border transition-all overflow-hidden ${
                    isDragging
                      ? 'opacity-40 border-dashed border-[#7FBFC1] bg-[#F6F5F3] scale-[0.99]'
                      : isOver
                      ? 'border-[#7FBFC1] ring-2 ring-[#7FBFC1]/30 bg-[#D5ECEC]/10'
                      : 'border-[#D5ECEC] hover:border-[#7FBFC1]/80 hover:shadow-xs'
                  }`}
                >
                  {/* ── Cabecera de la Tarjeta del Módulo ── */}
                  <div
                    onClick={() => toggleExpand(mod.id)}
                    className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    {/* Lado Izquierdo: Tirador ⋮⋮ + Orden + Ícono + Nombre + Chips */}
                    <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                      {/* Tirador Drag (Grip) del módulo */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#4F6170]/60 hover:text-[#2B3F4C] cursor-grab active:cursor-grabbing p-1 -ml-1 select-none shrink-0"
                        title="Arrastrar para ordenar módulo"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M7 4a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm6-12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                        </svg>
                      </div>

                      {/* Número de Orden del módulo */}
                      <span className="w-7 h-7 rounded-full bg-[#F6F5F3] border border-[#D5ECEC] text-[#2B3F4C] text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        {mod.order}
                      </span>

                      {/* Ícono de Módulo en recuadro suave */}
                      <div className="w-10 h-10 rounded-[14px] bg-[#D5ECEC] text-[#16303B] flex items-center justify-center shrink-0">
                        <DynamicIcon name={mod.icon} className="w-5 h-5" />
                      </div>

                      {/* Nombre del Módulo y Chips Colapsados */}
                      <div className="min-w-0">
                        <h3 className="font-serif text-lg font-bold text-[#2B3F4C] tracking-tight truncate">
                          {mod.name}
                        </h3>

                        {/* Chips de opciones cuando está colapsado */}
                        {!isExpanded && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {options.length > 0 ? (
                              options.map((opt) => (
                                <span
                                  key={opt.id}
                                  className={`inline-block px-2.5 py-0.5 rounded-[8px] text-[11px] font-medium transition ${
                                    opt.is_active
                                      ? 'bg-[#F6F5F3] border border-[#D5ECEC] text-[#2B3F4C]'
                                      : 'bg-[#F6F5F3]/60 border border-[#D5ECEC]/50 text-[#4F6170]/60 line-through'
                                  }`}
                                >
                                  {opt.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-[#4F6170]/60 italic">
                                Sin opciones
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lado Derecho: Chevron + Badge visibles + Botón Editar Módulo */}
                    <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
                      {/* Botón Flecha Desplegable */}
                      <button
                        type="button"
                        aria-label={isExpanded ? 'Contraer opciones' : 'Desplegar opciones'}
                        className="text-[#4F6170] hover:text-[#2B3F4C] p-1 transition cursor-pointer"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180 text-[#2B3F4C]' : 'rotate-0 text-[#4F6170]'
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Badge de visibilidad: "X de Y visibles" */}
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#D5ECEC] text-[#16303B]">
                        {activeCount} de {totalCount} visibles
                      </span>

                      {/* Botón Editar Módulo */}
                      <button
                        type="button"
                        onClick={(e) => openEditModal(mod, e)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[12px] bg-white border border-[#D5ECEC] text-xs font-semibold text-[#2B3F4C] hover:bg-[#F6F5F3] hover:border-[#7FBFC1] transition cursor-pointer shadow-none"
                      >
                        <svg className="w-3.5 h-3.5 text-[#4F6170]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Editar</span>
                      </button>
                    </div>
                  </div>

                  {/* ── Contenido Desplegado: Tabla de Opciones con Arrastre y Edición ── */}
                  {isExpanded && (
                    <div className="border-t border-[#D5ECEC]/70 bg-white px-6 py-4 space-y-3 animate-in fade-in">
                      {/* Encabezado de Columnas */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#4F6170] uppercase tracking-wider pb-2 border-b border-[#D5ECEC]/50">
                        <div className="flex items-center gap-2">
                          <span>OPCIÓN</span>
                          <span className="text-[10px] font-normal normal-case text-[#4F6170]/80">
                            (Arrastra ⋮⋮ para reordenar)
                          </span>
                        </div>
                        <span className="pr-2">ACCIONES & ESTADO</span>
                      </div>

                      {/* Listado de Opciones */}
                      {options.length > 0 ? (
                        <div className="divide-y divide-[#D5ECEC]/40">
                          {options.map((opt, optIndex) => {
                            const isToggling = togglingOptionId === opt.id;
                            const isOptionDragging =
                              draggedOption?.moduleId === mod.id && draggedOption?.index === optIndex;
                            const isOptionOver =
                              draggedOption?.moduleId === mod.id &&
                              dragOverOptionIndex === optIndex &&
                              draggedOption?.index !== optIndex;

                            return (
                              <div
                                key={opt.id}
                                draggable
                                onDragStart={(e) => handleOptionDragStart(e, mod.id, optIndex)}
                                onDragOver={(e) => handleOptionDragOver(e, mod.id, optIndex)}
                                onDrop={(e) => handleOptionDrop(e, mod.id, optIndex)}
                                onDragEnd={() => {
                                  setDraggedOption(null);
                                  setDragOverOptionIndex(null);
                                }}
                                className={`py-3.5 px-2 flex items-center justify-between gap-4 transition-all rounded-[14px] ${
                                  isOptionDragging
                                    ? 'opacity-40 border-dashed border-[#7FBFC1] bg-[#F6F5F3]'
                                    : isOptionOver
                                    ? 'border-[#7FBFC1] ring-2 ring-[#7FBFC1]/30 bg-[#D5ECEC]/20'
                                    : 'hover:bg-[#F6F5F3]/50'
                                }`}
                              >
                                {/* Lado Izquierdo: Tirador ⋮⋮ + Orden + Ícono + Nombre y slug */}
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Tirador Drag de la opción */}
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[#4F6170]/60 hover:text-[#2B3F4C] cursor-grab active:cursor-grabbing p-1 -ml-1 select-none shrink-0"
                                    title="Arrastrar para ordenar opción"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M7 4a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm6-12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                                    </svg>
                                  </div>

                                  {/* Número de Orden de la opción */}
                                  <span className="w-6 h-6 rounded-full bg-[#F6F5F3] border border-[#D5ECEC] text-[#2B3F4C] text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                                    {opt.order || optIndex + 1}
                                  </span>

                                  {/* Ícono de la opción */}
                                  <div className="w-8 h-8 rounded-[10px] bg-[#D5ECEC]/70 text-[#16303B] flex items-center justify-center shrink-0">
                                    <DynamicIcon name={opt.icon || 'ClipboardDocumentListIcon'} className="w-4 h-4" />
                                  </div>

                                  {/* Nombre y slug de la opción */}
                                  <div className="min-w-0">
                                    <h4 className="text-xs sm:text-sm font-bold text-[#2B3F4C] leading-snug">
                                      {opt.name}
                                    </h4>
                                    <span className="text-[11px] font-mono text-[#4F6170]">
                                      {opt.slug || opt.name.toLowerCase().replace(/\s+/g, '_')}
                                    </span>
                                  </div>
                                </div>

                                {/* Lado Derecho: Botón Editar opción + Switch Activo/Inactivo */}
                                <div className="flex items-center gap-3 shrink-0">
                                  {/* Botón Editar opción (Solo nombre e ícono) */}
                                  <button
                                    type="button"
                                    onClick={(e) => openEditOptionModal(mod.id, opt, e)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white border border-[#D5ECEC] text-xs font-semibold text-[#2B3F4C] hover:bg-[#F6F5F3] hover:border-[#7FBFC1] transition cursor-pointer shadow-none"
                                    title="Editar nombre e ícono de la opción"
                                  >
                                    <svg className="w-3.5 h-3.5 text-[#4F6170]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span>Editar</span>
                                  </button>

                                  {/* Toggle Switch con estado Activo/Inactivo */}
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={opt.is_active}
                                      disabled={isToggling}
                                      onClick={() => handleToggleOption(mod.id, opt.id, opt.is_active)}
                                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        opt.is_active ? 'bg-[#319795]' : 'bg-[#CBD5E1]'
                                      } ${isToggling ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                          opt.is_active ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                      />
                                    </button>

                                    <span
                                      className={`text-xs font-semibold w-14 select-none ${
                                        opt.is_active ? 'text-[#2B3F4C]' : 'text-[#4F6170]'
                                      }`}
                                    >
                                      {isToggling ? 'Cambiando...' : opt.is_active ? 'Activo' : 'Inactivo'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-[#4F6170] italic py-3 text-center">
                          No hay opciones configuradas para este módulo.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          {/* Sin resultados de búsqueda */}
          {!isLoading && filteredModules.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <p className="text-xs font-semibold text-[#2B3F4C]">
                No se encontraron módulos u opciones que coincidan con "{searchQuery}".
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-bold text-[#B8531A] hover:underline cursor-pointer"
              >
                Limpiar búsqueda
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de Edición de MÓDULO ── */}
      {editingModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#243642]/40 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-white rounded-[24px] border border-[#D5ECEC] p-6 sm:p-7 max-w-lg w-full shadow-xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado del Modal */}
            <div className="flex items-center justify-between border-b border-[#D5ECEC]/70 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[12px] bg-[#D5ECEC] text-[#2B3F4C] flex items-center justify-center shrink-0">
                  <DynamicIcon name={editIcon} className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#2B3F4C]">
                    Editar módulo
                  </h3>
                  <p className="text-[11px] text-[#4F6170]">
                    Modifica el nombre visible y el ícono de la categoría.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="w-7 h-7 rounded-full text-[#4F6170] hover:text-[#2B3F4C] hover:bg-[#F6F5F3] flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error en el Modal */}
            {editError && (
              <div className="p-3 rounded-[12px] bg-[#FDE2C8] border border-[#FBB982] text-xs text-[#7A3E0A] font-semibold">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Campo Nombre */}
              <div>
                <label className="block text-xs font-bold text-[#2B3F4C] mb-1.5">
                  Nombre del módulo <span className="text-[#B8531A]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ej. Configuración"
                  className="w-full px-3.5 py-2.5 text-xs text-[#2B3F4C] bg-white border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition"
                />
              </div>

              {/* Selector de Ícono */}
              <div>
                <label className="block text-xs font-bold text-[#2B3F4C] mb-1.5">
                  Ícono representativo
                </label>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-3 bg-[#F6F5F3] rounded-[16px] border border-[#D5ECEC] max-h-40 overflow-y-auto">
                  {AVAILABLE_ICONS.map((iconName) => {
                    const isSelected = editIcon === iconName;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setEditIcon(iconName)}
                        title={iconName}
                        className={`w-9 h-9 rounded-[12px] flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#7FBFC1] text-[#16303B] ring-2 ring-[#7FBFC1]/60 shadow-xs'
                            : 'bg-white text-[#4F6170] hover:bg-[#D5ECEC]/50 hover:text-[#2B3F4C]'
                        }`}
                      >
                        <DynamicIcon name={iconName} className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Acciones del Modal */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D5ECEC]/70">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-[14px] bg-[#F6F5F3] text-xs font-semibold text-[#4F6170] hover:bg-[#D5ECEC]/50 hover:text-[#2B3F4C] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-[14px] bg-[#7FBFC1] text-xs font-semibold text-[#16303B] hover:opacity-95 transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Edición de OPCIÓN (Solo Nombre e Ícono) ── */}
      {editingOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#243642]/40 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-white rounded-[24px] border border-[#D5ECEC] p-6 sm:p-7 max-w-lg w-full shadow-xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado del Modal */}
            <div className="flex items-center justify-between border-b border-[#D5ECEC]/70 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[12px] bg-[#D5ECEC] text-[#2B3F4C] flex items-center justify-center shrink-0">
                  <DynamicIcon name={editOptionIcon} className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#2B3F4C]">
                    Editar opción
                  </h3>
                  <p className="text-[11px] text-[#4F6170]">
                    Modifica el nombre visible y el ícono de la opción de navegación.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditOptionModal}
                className="w-7 h-7 rounded-full text-[#4F6170] hover:text-[#2B3F4C] hover:bg-[#F6F5F3] flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error en el Modal */}
            {editOptionError && (
              <div className="p-3 rounded-[12px] bg-[#FDE2C8] border border-[#FBB982] text-xs text-[#7A3E0A] font-semibold">
                {editOptionError}
              </div>
            )}

            <form onSubmit={handleSaveOptionEdit} className="space-y-4">
              {/* Campo Nombre de la Opción */}
              <div>
                <label className="block text-xs font-bold text-[#2B3F4C] mb-1.5">
                  Nombre de la opción <span className="text-[#B8531A]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editOptionName}
                  onChange={(e) => setEditOptionName(e.target.value)}
                  placeholder="Ej. Crear evaluación"
                  className="w-full px-3.5 py-2.5 text-xs text-[#2B3F4C] bg-white border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition"
                />
              </div>

              {/* Selector de Ícono de la Opción */}
              <div>
                <label className="block text-xs font-bold text-[#2B3F4C] mb-1.5">
                  Ícono representativo
                </label>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-3 bg-[#F6F5F3] rounded-[16px] border border-[#D5ECEC] max-h-40 overflow-y-auto">
                  {AVAILABLE_ICONS.map((iconName) => {
                    const isSelected = editOptionIcon === iconName;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setEditOptionIcon(iconName)}
                        title={iconName}
                        className={`w-9 h-9 rounded-[12px] flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#7FBFC1] text-[#16303B] ring-2 ring-[#7FBFC1]/60 shadow-xs'
                            : 'bg-white text-[#4F6170] hover:bg-[#D5ECEC]/50 hover:text-[#2B3F4C]'
                        }`}
                      >
                        <DynamicIcon name={iconName} className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detalle informativo de ruta */}
              <div className="p-3 rounded-[14px] bg-[#F6F5F3] border border-[#D5ECEC] flex items-center justify-between text-xs text-[#4F6170]">
                <span>Ruta del sistema:</span>
                <span className="font-mono font-semibold text-[#2B3F4C]">
                  {editingOption.option.path}
                </span>
              </div>

              {/* Acciones del Modal */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D5ECEC]/70">
                <button
                  type="button"
                  onClick={closeEditOptionModal}
                  disabled={isSavingOptionEdit}
                  className="px-4 py-2 rounded-[14px] bg-[#F6F5F3] text-xs font-semibold text-[#4F6170] hover:bg-[#D5ECEC]/50 hover:text-[#2B3F4C] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingOptionEdit}
                  className="px-5 py-2 rounded-[14px] bg-[#7FBFC1] text-xs font-semibold text-[#16303B] hover:opacity-95 transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingOptionEdit ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
