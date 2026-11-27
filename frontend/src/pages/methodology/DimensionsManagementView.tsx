import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';
import { DynamicIcon } from '@/components/navigation/DynamicIcon';
import { AiCitationModal } from '@/components/methodology/AiCitationModal';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

export interface SubfactorItem {
  id: number;
  name: string;
  description: string | null;
  factor: number;
  order: number;
}

export interface ScaleLevelInfo {
  id: number;
  value: number;
  label: string;
}

export interface FactorItem {
  id: number;
  name: string;
  description: string | null;
  dimension: number;
  order: number;
  total_citations: number;
  expert_importance: number;
  expert_importance_label: string;
  total_subfactors: number;
  literature_importance: number | null;
  literature_importance_info: ScaleLevelInfo | null;
  suggested_importance: number | null;
  suggested_importance_info: ScaleLevelInfo | null;
  subfactors: SubfactorItem[];
}

export interface DimensionTreeItem {
  id: number;
  name: string;
  description: string | null;
  order: number;
  factors_count: number;
  subfactors_count: number;
  factors: FactorItem[];
}

const EXPERT_IMPORTANCE_OPTIONS = [
  { value: 1, label: '1 - Irrelevante' },
  { value: 2, label: '2 - Opcional' },
  { value: 3, label: '3 - Importante' },
  { value: 4, label: '4 - Fundamental' },
];

export const DimensionsManagementView: React.FC = () => {
  const toast = useToast();
  const [treeData, setTreeData] = useState<DimensionTreeItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Búsqueda y Filtros
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dimensionFilter, setDimensionFilter] = useState<string>('all');
  const [importanceFilter, setImportanceFilter] = useState<string>('all');

  // Control de acordeones desplegables
  const [expandedDimensionIds, setExpandedDimensionIds] = useState<Record<number, boolean>>({
    1: true, // Desplegado por defecto para la primera dimensión
  });
  const [expandedFactorIds, setExpandedFactorIds] = useState<Record<number, boolean>>({});

  // ── Drag and Drop: Nivel 1 (Dimensiones) ──
  const [draggedDimIndex, setDraggedDimIndex] = useState<number | null>(null);
  const [dragOverDimIndex, setDragOverDimIndex] = useState<number | null>(null);

  // ── Drag and Drop: Nivel 2 (Factores dentro de dimensión) ──
  const [draggedFactor, setDraggedFactor] = useState<{ dimId: number; index: number } | null>(null);
  const [dragOverFactorIndex, setDragOverFactorIndex] = useState<number | null>(null);

  // ── Drag and Drop: Nivel 3 (Subfactores dentro de factor) ──
  const [draggedSubfactor, setDraggedSubfactor] = useState<{ factorId: number; index: number } | null>(null);
  const [dragOverSubfactorIndex, setDragOverSubfactorIndex] = useState<number | null>(null);

  // Estados de Modales
  // Dimensión
  const [dimModalMode, setDimModalMode] = useState<'create' | 'edit' | null>(null);
  const [currentDim, setCurrentDim] = useState<DimensionTreeItem | null>(null);
  const [dimFormName, setDimFormName] = useState<string>('');
  const [dimFormDesc, setDimFormDesc] = useState<string>('');
  const [isSavingDim, setIsSavingDim] = useState<boolean>(false);
  const [dimModalError, setDimModalError] = useState<string | null>(null);

  // Factor
  const [factorModalMode, setFactorModalMode] = useState<'create' | 'edit' | null>(null);
  const [currentFactor, setCurrentFactor] = useState<FactorItem | null>(null);
  const [targetDimIdForFactor, setTargetDimIdForFactor] = useState<number | null>(null);
  const [factorFormName, setFactorFormName] = useState<string>('');
  const [factorFormDesc, setFactorFormDesc] = useState<string>('');
  const [factorFormCitations, setFactorFormCitations] = useState<number>(0);
  const [factorFormExpertImp, setFactorFormExpertImp] = useState<number>(3);
  const [isSavingFactor, setIsSavingFactor] = useState<boolean>(false);
  const [factorModalError, setFactorModalError] = useState<string | null>(null);

  // Subfactor
  const [subModalMode, setSubModalMode] = useState<'create' | 'edit' | null>(null);
  const [currentSubfactor, setCurrentSubfactor] = useState<SubfactorItem | null>(null);
  const [targetFactorIdForSub, setTargetFactorIdForSub] = useState<number | null>(null);
  const [subFormName, setSubFormName] = useState<string>('');
  const [subFormDesc, setSubFormDesc] = useState<string>('');
  const [isSavingSub, setIsSavingSub] = useState<boolean>(false);
  const [subModalError, setSubModalError] = useState<string | null>(null);

  // Modales de confirmación de eliminación
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'dimension' | 'factor' | 'subfactor';
    id: number;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Modal de Consulta con IA
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  const showNotification = (message: string) => {
    toast.success(message);
  };

  // Cargar árbol metodológico completo
  const fetchTree = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await fetch('/api/v1/methodology/dimensions/tree/', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('No se pudo cargar la estructura de dimensiones y factores.');
      }
      const data: DimensionTreeItem[] = await res.json();
      if (Array.isArray(data)) {
        const sorted = data
          .sort((a, b) => a.order - b.order)
          .map((dim) => ({
            ...dim,
            factors: (dim.factors || [])
              .sort((a, b) => a.order - b.order)
              .map((f) => ({
                ...f,
                subfactors: (f.subfactors || []).sort((a, b) => a.order - b.order),
              })),
          }));
        setTreeData(sorted);
      }
    } catch (err: any) {
      const msg = err.message || 'Error al conectar con el servidor.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  // Métricas globales
  const totalStats = useMemo(() => {
    let factors = 0;
    let subfactors = 0;
    treeData.forEach((dim) => {
      factors += dim.factors?.length || 0;
      (dim.factors || []).forEach((f) => {
        subfactors += f.subfactors?.length || 0;
      });
    });
    return {
      dimensions: treeData.length,
      factors,
      subfactors,
    };
  }, [treeData]);

  // Filtrado de Dimensiones, Factores y Subfactores
  const filteredTree = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return treeData
      .filter((dim) => {
        if (dimensionFilter !== 'all' && String(dim.id) !== dimensionFilter) {
          return false;
        }
        return true;
      })
      .map((dim) => {
        let matchingFactors = dim.factors || [];

        // Filtro por importancia sugerida
        if (importanceFilter !== 'all') {
          matchingFactors = matchingFactors.filter(
            (f) => f.suggested_importance_info?.label === importanceFilter
          );
        }

        // Filtro por texto de búsqueda
        if (q) {
          const dimMatches =
            dim.name.toLowerCase().includes(q) ||
            (dim.description && dim.description.toLowerCase().includes(q));

          if (!dimMatches) {
            matchingFactors = matchingFactors.filter((f) => {
              const factorMatches =
                f.name.toLowerCase().includes(q) ||
                (f.description && f.description.toLowerCase().includes(q));
              const subfactorMatches = (f.subfactors || []).some(
                (s) =>
                  s.name.toLowerCase().includes(q) ||
                  (s.description && s.description.toLowerCase().includes(q))
              );
              return factorMatches || subfactorMatches;
            });
          }
        }

        return {
          ...dim,
          factors: matchingFactors,
        };
      })
      .filter((dim) => {
        if (!q && importanceFilter === 'all') return true;
        const dimMatches =
          dim.name.toLowerCase().includes(q) ||
          (dim.description && dim.description.toLowerCase().includes(q));
        return dimMatches || dim.factors.length > 0;
      });
  }, [treeData, searchQuery, dimensionFilter, importanceFilter]);

  // Alternar expansión de dimensión
  const toggleDimension = (dimId: number) => {
    setExpandedDimensionIds((prev) => ({
      ...prev,
      [dimId]: !prev[dimId],
    }));
  };

  // Alternar expansión de factor
  const toggleFactor = (factorId: number) => {
    setExpandedFactorIds((prev) => ({
      ...prev,
      [factorId]: !prev[factorId],
    }));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // REORDENAMIENTO DRAG AND DROP (3 NIVELES)
  // ─────────────────────────────────────────────────────────────────────────────

  // Nivel 1: Dimensiones
  const handleDimDragStart = (e: React.DragEvent, index: number) => {
    setDraggedDimIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDimDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedDimIndex === null || draggedDimIndex === index) return;
    setDragOverDimIndex(index);
  };

  const handleDimDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverDimIndex(null);
    if (draggedDimIndex === null || draggedDimIndex === dropIndex) return;

    const updated = [...treeData];
    const [moved] = updated.splice(draggedDimIndex, 1);
    updated.splice(dropIndex, 0, moved);

    const reordered = updated.map((dim, idx) => ({ ...dim, order: idx + 1 }));
    setTreeData(reordered);
    setDraggedDimIndex(null);

    try {
      const payload = reordered.map((d) => ({ id: d.id, order: d.order }));
      const res = await fetch('/api/v1/methodology/dimensions/reorder/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showNotification('Orden de dimensiones actualizado.');
      }
    } catch {
      fetchTree();
    }
  };

  // Nivel 2: Factores dentro de una dimensión
  const handleFactorDragStart = (e: React.DragEvent, dimId: number, index: number) => {
    e.stopPropagation();
    setDraggedFactor({ dimId, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFactorDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedFactor || draggedFactor.index === index) return;
    setDragOverFactorIndex(index);
  };

  const handleFactorDrop = async (e: React.DragEvent, dimId: number, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFactorIndex(null);
    if (!draggedFactor || draggedFactor.dimId !== dimId || draggedFactor.index === dropIndex) {
      setDraggedFactor(null);
      return;
    }

    const dim = treeData.find((d) => d.id === dimId);
    if (!dim) return;

    const updatedFactors = [...dim.factors];
    const [moved] = updatedFactors.splice(draggedFactor.index, 1);
    updatedFactors.splice(dropIndex, 0, moved);

    const reorderedFactors = updatedFactors.map((f, idx) => ({ ...f, order: idx + 1 }));

    setTreeData((prev) =>
      prev.map((d) => (d.id === dimId ? { ...d, factors: reorderedFactors } : d))
    );
    setDraggedFactor(null);

    try {
      const payload = reorderedFactors.map((f) => ({ id: f.id, order: f.order }));
      const res = await fetch('/api/v1/methodology/factors/reorder/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showNotification('Orden de factores actualizado.');
      }
    } catch {
      fetchTree();
    }
  };

  // Nivel 3: Subfactores dentro de un factor
  const handleSubfactorDragStart = (e: React.DragEvent, factorId: number, index: number) => {
    e.stopPropagation();
    setDraggedSubfactor({ factorId, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSubfactorDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSubfactor || draggedSubfactor.index === index) return;
    setDragOverSubfactorIndex(index);
  };

  const handleSubfactorDrop = async (e: React.DragEvent, factorId: number, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSubfactorIndex(null);
    if (
      !draggedSubfactor ||
      draggedSubfactor.factorId !== factorId ||
      draggedSubfactor.index === dropIndex
    ) {
      setDraggedSubfactor(null);
      return;
    }

    let targetDimId: number | null = null;
    let targetFactor: FactorItem | null = null;

    for (const d of treeData) {
      const found = d.factors.find((f) => f.id === factorId);
      if (found) {
        targetDimId = d.id;
        targetFactor = found;
        break;
      }
    }

    if (!targetDimId || !targetFactor) return;

    const updatedSubs = [...targetFactor.subfactors];
    const [moved] = updatedSubs.splice(draggedSubfactor.index, 1);
    updatedSubs.splice(dropIndex, 0, moved);

    const reorderedSubs = updatedSubs.map((s, idx) => ({ ...s, order: idx + 1 }));

    setTreeData((prev) =>
      prev.map((d) =>
        d.id === targetDimId
          ? {
            ...d,
            factors: d.factors.map((f) =>
              f.id === factorId ? { ...f, subfactors: reorderedSubs } : f
            ),
          }
          : d
      )
    );
    setDraggedSubfactor(null);

    try {
      const payload = reorderedSubs.map((s) => ({ id: s.id, order: s.order }));
      const res = await fetch('/api/v1/methodology/subfactors/reorder/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showNotification('Orden de subfactores actualizado.');
      }
    } catch {
      fetchTree();
    }
  };

  const extractApiError = (data: any, fallback: string): string => {
    if (!data) return fallback;
    if (typeof data === 'string') return data;
    if (data.detail && typeof data.detail === 'string') return data.detail;
    if (typeof data === 'object') {
      const messages: string[] = [];
      for (const [key, val] of Object.entries(data)) {
        const label = key === 'detail' || key === 'non_field_errors' ? '' : `${key}: `;
        if (Array.isArray(val)) {
          messages.push(`${label}${val.join(' ')}`);
        } else if (typeof val === 'string') {
          messages.push(`${label}${val}`);
        }
      }
      if (messages.length > 0) return messages.join(' | ');
    }
    return fallback;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // OPERACIONES CRUD: DIMENSIONES
  // ─────────────────────────────────────────────────────────────────────────────
  const openCreateDimModal = () => {
    setDimModalMode('create');
    setCurrentDim(null);
    setDimFormName('');
    setDimFormDesc('');
    setDimModalError(null);
  };

  const openEditDimModal = (dim: DimensionTreeItem) => {
    setDimModalMode('edit');
    setCurrentDim(dim);
    setDimFormName(dim.name);
    setDimFormDesc(dim.description || '');
    setDimModalError(null);
  };

  const handleSaveDimension = async () => {
    if (!dimFormName.trim()) {
      setDimModalError('El nombre de la dimensión es obligatorio.');
      return;
    }

    try {
      setIsSavingDim(true);
      setDimModalError(null);

      const url =
        dimModalMode === 'create'
          ? '/api/v1/methodology/dimensions/'
          : `/api/v1/methodology/dimensions/${currentDim?.id}/`;
      const method = dimModalMode === 'create' ? 'POST' : 'PATCH';

      const payload = {
        name: dimFormName.trim(),
        description: dimFormDesc.trim(),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(extractApiError(data, 'Error al guardar la dimensión.'));
      }

      showNotification(
        dimModalMode === 'create'
          ? 'Dimensión creada exitosamente.'
          : 'Dimensión actualizada exitosamente.'
      );
      setDimModalMode(null);
      fetchTree();
    } catch (err: any) {
      setDimModalError(err.message || 'Error al procesar la solicitud.');
    } finally {
      setIsSavingDim(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // OPERACIONES CRUD: FACTORES (Cálculo automático de IL e IS)
  // ─────────────────────────────────────────────────────────────────────────────
  const openCreateFactorModal = (dimId: number) => {
    setFactorModalMode('create');
    setTargetDimIdForFactor(dimId);
    setCurrentFactor(null);
    setFactorFormName('');
    setFactorFormDesc('');
    setFactorFormCitations(0);
    setFactorFormExpertImp(3);
    setFactorModalError(null);
  };

  const openEditFactorModal = (factor: FactorItem) => {
    setFactorModalMode('edit');
    setCurrentFactor(factor);
    setTargetDimIdForFactor(factor.dimension);
    setFactorFormName(factor.name);
    setFactorFormDesc(factor.description || '');
    setFactorFormCitations(factor.total_citations || 0);
    setFactorFormExpertImp(factor.expert_importance || 3);
    setFactorModalError(null);
  };

  const handleSaveFactor = async () => {
    if (!factorFormName.trim()) {
      setFactorModalError('El nombre del factor es obligatorio.');
      return;
    }
    if (factorFormCitations < 0) {
      setFactorModalError('El total de citas no puede ser negativo.');
      return;
    }

    try {
      setIsSavingFactor(true);
      setFactorModalError(null);

      const url =
        factorModalMode === 'create'
          ? '/api/v1/methodology/factors/'
          : `/api/v1/methodology/factors/${currentFactor?.id}/`;
      const method = factorModalMode === 'create' ? 'POST' : 'PATCH';

      const payload: any = {
        name: factorFormName.trim(),
        description: factorFormDesc.trim(),
        total_citations: Number(factorFormCitations),
        expert_importance: Number(factorFormExpertImp),
      };

      if (factorModalMode === 'create' && targetDimIdForFactor) {
        payload.dimension = targetDimIdForFactor;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(extractApiError(data, 'Error al guardar el factor.'));
      }

      showNotification(
        factorModalMode === 'create'
          ? 'Factor registrado. Distribución de importancia actualizada.'
          : 'Factor actualizado. Importancia recalculada.'
      );
      setFactorModalMode(null);
      fetchTree();
    } catch (err: any) {
      setFactorModalError(err.message || 'Error al procesar la solicitud.');
    } finally {
      setIsSavingFactor(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // OPERACIONES CRUD: SUBFACTORES
  // ─────────────────────────────────────────────────────────────────────────────
  const openCreateSubfactorModal = (factorId: number) => {
    setSubModalMode('create');
    setTargetFactorIdForSub(factorId);
    setCurrentSubfactor(null);
    setSubFormName('');
    setSubFormDesc('');
    setSubModalError(null);
  };

  const openEditSubfactorModal = (sub: SubfactorItem) => {
    setSubModalMode('edit');
    setCurrentSubfactor(sub);
    setTargetFactorIdForSub(sub.factor);
    setSubFormName(sub.name);
    setSubFormDesc(sub.description || '');
    setSubModalError(null);
  };

  const handleSaveSubfactor = async () => {
    if (!subFormName.trim()) {
      setSubModalError('El nombre del subfactor es obligatorio.');
      return;
    }

    try {
      setIsSavingSub(true);
      setSubModalError(null);

      const url =
        subModalMode === 'create'
          ? '/api/v1/methodology/subfactors/'
          : `/api/v1/methodology/subfactors/${currentSubfactor?.id}/`;
      const method = subModalMode === 'create' ? 'POST' : 'PATCH';

      const payload: any = {
        name: subFormName.trim(),
        description: subFormDesc.trim(),
      };

      if (subModalMode === 'create' && targetFactorIdForSub) {
        payload.factor = targetFactorIdForSub;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(extractApiError(data, 'Error al guardar el subfactor.'));
      }

      showNotification(
        subModalMode === 'create'
          ? 'Subfactor registrado. Importancia recalculada automáticamente.'
          : 'Subfactor actualizado exitosamente.'
      );
      setSubModalMode(null);
      fetchTree();
    } catch (err: any) {
      setSubModalError(err.message || 'Error al procesar la solicitud.');
    } finally {
      setIsSavingSub(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ELIMINACIÓN GENÉRICA
  // ─────────────────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeleting(true);
      let endpoint = '';
      if (itemToDelete.type === 'dimension') endpoint = `/api/v1/methodology/dimensions/${itemToDelete.id}/`;
      if (itemToDelete.type === 'factor') endpoint = `/api/v1/methodology/factors/${itemToDelete.id}/`;
      if (itemToDelete.type === 'subfactor') endpoint = `/api/v1/methodology/subfactors/${itemToDelete.id}/`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('No se pudo eliminar el elemento seleccionado.');
      }

      showNotification(`Elemento "${itemToDelete.name}" eliminado correctamente.`);
      setItemToDelete(null);
      fetchTree();
    } catch (err: any) {
      showNotification(err.message || 'Error al eliminar elemento.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper para color de badges de importancia
  const getImportanceBadge = (label?: string | null) => {
    if (!label) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F6F5F3] text-[#4F6170] border border-[#D5ECEC]">
          Pendiente
        </span>
      );
    }
    switch (label) {
      case 'Fundamental':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#B84318]/15 text-[#B84318] border border-[#B84318]/30">
            ★ {label}
          </span>
        );
      case 'Importante':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F7A35F]/20 text-[#A65B1A] border border-[#F7A35F]/40">
            {label}
          </span>
        );
      case 'Opcional':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#7FBFC1]/25 text-[#16303B] border border-[#7FBFC1]/40">
            {label}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#D5ECEC]/50 text-[#4F6170] border border-[#D5ECEC]">
            {label}
          </span>
        );
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
              Dimensiones, Factores y Subfactores
            </h2>
            <p className="text-sm sm:text-base text-[#1F3340] leading-relaxed">
              Administra la estructura metodológica oficial: dimensiones, factores técnicos con cálculo automático de importancia (IL e IS) y sus subfactores de evaluación.
            </p>
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="bg-white/80 backdrop-blur-sm rounded-[16px] px-4 py-3 border border-[#FBB982] text-center shadow-none">
              <span className="text-2xl font-serif font-bold text-[#2B3F4C] block leading-none">
                {totalStats.dimensions}
              </span>
              <span className="text-[10px] font-bold text-[#5B4A12] uppercase tracking-wider mt-1 block">
                Dimensiones
              </span>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-[16px] px-4 py-3 border border-[#FBB982] text-center shadow-none">
              <span className="text-2xl font-serif font-bold text-[#2B3F4C] block leading-none">
                {totalStats.factors}
              </span>
              <span className="text-[10px] font-bold text-[#5B4A12] uppercase tracking-wider mt-1 block">
                Factores
              </span>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-[16px] px-4 py-3 border border-[#FBB982] text-center shadow-none">
              <span className="text-2xl font-serif font-bold text-[#2B3F4C] block leading-none">
                {totalStats.subfactors}
              </span>
              <span className="text-[10px] font-bold text-[#5B4A12] uppercase tracking-wider mt-1 block">
                Subfactores
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Barra de Búsqueda, Filtros y Acción Nueva Dimensión ── */}
      <div className="bg-white rounded-[24px] p-5 border border-[#D5ECEC] space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Buscador */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar dimensiones, factores o subfactores..."
              className="w-full pl-10 pr-4 py-2.5 rounded-[14px] bg-[#F6F5F3] border border-[#D5ECEC] text-sm text-[#2B3F4C] placeholder-[#4F6170] focus:outline-none focus:border-[#7FBFC1] transition"
            />
            <svg
              className="w-4 h-4 text-[#4F6170] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#4F6170] hover:text-[#2B3F4C]"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Filtro por Dimensión */}
          <select
            value={dimensionFilter}
            onChange={(e) => setDimensionFilter(e.target.value)}
            className="py-2.5 px-3.5 rounded-[14px] bg-[#F6F5F3] border border-[#D5ECEC] text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1]"
          >
            <option value="all">Todas las dimensiones</option>
            {treeData.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Filtro por Importancia Sugerida */}
          <select
            value={importanceFilter}
            onChange={(e) => setImportanceFilter(e.target.value)}
            className="py-2.5 px-3.5 rounded-[14px] bg-[#F6F5F3] border border-[#D5ECEC] text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1]"
          >
            <option value="all">Importancia (Todas)</option>
            <option value="Fundamental">Fundamental</option>
            <option value="Importante">Importante</option>
            <option value="Opcional">Opcional</option>
            <option value="Irrelevante">Irrelevante</option>
          </select>

          {/* Botón Consultar IA */}
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-[14px] bg-[#F7A35F] text-[#1F3340] font-semibold text-sm hover:bg-[#EE944D] transition shadow-none cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4 text-[#1F3340]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
            <span>Consultar IA</span>
          </button>

          {/* Botón Agregar Dimensión */}
          <button
            type="button"
            onClick={openCreateDimModal}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-[14px] bg-[#7FBFC1] text-[#16303B] font-semibold text-sm hover:opacity-95 transition shadow-none cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Nueva dimensión</span>
          </button>
        </div>

        {/* Tip explicativo del cálculo */}
        <div className="flex items-center gap-2 text-xs text-[#4F6170] bg-[#D5ECEC]/30 px-3.5 py-2 rounded-[12px] border border-[#D5ECEC]/60">
          <svg className="w-4 h-4 text-[#7FBFC1] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span>
            <strong>Cálculo metodológico automático:</strong> La importancia de literatura (IL) y sugerida (IS) se calculan en base a las citas divididas para el total de subfactores y el método de cuartiles GUIOS.
          </span>
        </div>
      </div>

      {/* ── Árbol Jerárquico de Dimensiones ── */}
      {isLoading ? (
        <div className="bg-white rounded-[24px] p-12 border border-[#D5ECEC] flex flex-col items-center justify-center">
          <GuiosProSpinner size="lg" label="Cargando jerarquía metodológica GUIOS..." />
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-[24px] p-8 border border-[#B84318]/30 bg-[#B84318]/5 text-center">
          <p className="text-sm font-semibold text-[#B84318] mb-2">{errorMessage}</p>
          <button
            type="button"
            onClick={fetchTree}
            className="px-4 py-2 rounded-[12px] bg-[#7FBFC1] text-[#16303B] text-xs font-semibold"
          >
            Reintentar
          </button>
        </div>
      ) : filteredTree.length === 0 ? (
        <div className="bg-white rounded-[24px] p-12 border border-[#D5ECEC] text-center space-y-2">
          <p className="text-base font-serif text-[#2B3F4C]">No se encontraron elementos coincidentes</p>
          <p className="text-xs text-[#4F6170]">Prueba ajustando los filtros o el término de búsqueda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[#4F6170] px-2 select-none">
            <span className="font-semibold text-[#2B3F4C]">
              Dimensiones registradas ({filteredTree.length})
            </span>
            <span>Usa el tirador :: para arrastrar y reordenar dimensiones</span>
          </div>

          {filteredTree.map((dim, dimIndex) => {
            const isExpanded = Boolean(expandedDimensionIds[dim.id]);
            const isDraggingThisDim = draggedDimIndex === dimIndex;
            const isDragOverThisDim = dragOverDimIndex === dimIndex;

            return (
              <div
                key={dim.id}
                draggable
                onDragStart={(e) => handleDimDragStart(e, dimIndex)}
                onDragOver={(e) => handleDimDragOver(e, dimIndex)}
                onDrop={(e) => handleDimDrop(e, dimIndex)}
                className={`bg-white rounded-[24px] border transition-all duration-200 overflow-hidden shadow-none ${isDraggingThisDim
                    ? 'opacity-40 scale-[0.99] border-dashed border-[#7FBFC1]'
                    : isDragOverThisDim
                      ? 'border-2 border-[#7FBFC1] bg-[#D5ECEC]/20'
                      : 'border-[#D5ECEC] hover:border-[#7FBFC1]'
                  }`}
              >
                {/* ── Encabezado Nivel 1: Dimensión ── */}
                <div className="p-5 flex items-center justify-between gap-4 select-none">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Tirador Drag & Drop */}
                    <div
                      className="cursor-grab active:cursor-grabbing p-1 text-[#4F6170] hover:text-[#2B3F4C]"
                      title="Arrastrar para ordenar dimensión"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 5a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm6-16a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                    </div>

                    {/* Número de orden */}
                    <div className="w-7 h-7 rounded-full bg-[#F6F5F3] border border-[#D5ECEC] flex items-center justify-center text-xs font-bold text-[#2B3F4C]">
                      {dim.order}
                    </div>

                    {/* Ícono de Dimensión */}
                    <div className="w-10 h-10 rounded-[14px] bg-[#D5ECEC] flex items-center justify-center text-[#16303B] shrink-0">
                      <DynamicIcon name="RectangleGroupIcon" className="w-5 h-5 text-[#16303B]" />
                    </div>

                    {/* Título y descripción de la dimensión */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="font-serif text-lg sm:text-xl font-medium text-[#2B3F4C] truncate">
                          {dim.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#D5ECEC]/60 text-[#16303B] border border-[#B4D6D6]">
                          {dim.factors.length} {dim.factors.length === 1 ? 'factor' : 'factores'}
                        </span>
                      </div>
                      {dim.description && (
                        <p className="text-xs text-[#4F6170] mt-0.5 line-clamp-1">
                          {dim.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Acciones de la Dimensión */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openCreateFactorModal(dim.id)}
                      className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-[12px] bg-[#D5ECEC] hover:bg-[#7FBFC1] text-[#16303B] text-xs font-semibold transition cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span>Agregar factor</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditDimModal(dim)}
                      className="py-1.5 px-3 rounded-[12px] bg-white border border-[#D5ECEC] hover:bg-[#F6F5F3] text-xs font-semibold text-[#2B3F4C] transition cursor-pointer"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setItemToDelete({
                          type: 'dimension',
                          id: dim.id,
                          name: dim.name,
                        })
                      }
                      className="p-1.5 rounded-[10px] text-[#B84318] hover:bg-[#B84318]/10 transition cursor-pointer"
                      title="Eliminar dimensión"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>

                    {/* Botón Acordeón Desplegable */}
                    <button
                      type="button"
                      onClick={() => toggleDimension(dim.id)}
                      className="p-1.5 rounded-[10px] text-[#4F6170] hover:text-[#2B3F4C] hover:bg-[#F6F5F3] transition cursor-pointer"
                    >
                      <svg
                        className={`w-5 h-5 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''
                          }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* ── Contenido Nivel 2: Factores de la Dimensión ── */}
                {isExpanded && (
                  <div className="border-t border-[#D5ECEC] bg-[#F6F5F3] p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#4F6170] px-1 select-none">
                      <span className="font-bold uppercase tracking-wider text-[11px] text-[#2B3F4C]">
                        Factores asociados a {dim.name}
                      </span>
                      <span>Arrastra con :: para reordenar dentro de esta dimensión</span>
                    </div>

                    {dim.factors.length === 0 ? (
                      <div className="bg-white rounded-[16px] p-6 text-center border border-dashed border-[#D5ECEC]">
                        <p className="text-xs text-[#4F6170] mb-2">
                          Esta dimensión no tiene factores técnicos registrados.
                        </p>
                        <button
                          type="button"
                          onClick={() => openCreateFactorModal(dim.id)}
                          className="px-3.5 py-1.5 rounded-[10px] bg-[#7FBFC1] text-[#16303B] text-xs font-semibold"
                        >
                          + Agregar primer factor
                        </button>
                      </div>
                    ) : (
                      dim.factors.map((factor, factorIndex) => {
                        const isFactorExpanded = Boolean(expandedFactorIds[factor.id]);
                        const isDraggingThisFactor =
                          draggedFactor?.dimId === dim.id && draggedFactor?.index === factorIndex;
                        const isDragOverThisFactor = dragOverFactorIndex === factorIndex;

                        return (
                          <div
                            key={factor.id}
                            draggable
                            onDragStart={(e) => handleFactorDragStart(e, dim.id, factorIndex)}
                            onDragOver={(e) => handleFactorDragOver(e, factorIndex)}
                            onDrop={(e) => handleFactorDrop(e, dim.id, factorIndex)}
                            className={`bg-white rounded-[18px] border transition-all duration-150 overflow-hidden shadow-none ${isDraggingThisFactor
                                ? 'opacity-40 border-dashed border-[#7FBFC1]'
                                : isDragOverThisFactor
                                  ? 'border-2 border-[#7FBFC1] bg-[#D5ECEC]/30'
                                  : 'border-[#D5ECEC] hover:border-[#7FBFC1]'
                              }`}
                          >
                            {/* Fila del Factor */}
                            <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
                              <div className="flex items-start md:items-center gap-3 min-w-0">
                                {/* Tirador Drag */}
                                <div
                                  className="cursor-grab active:cursor-grabbing p-1 text-[#4F6170] hover:text-[#2B3F4C] shrink-0 mt-0.5 md:mt-0"
                                  title="Arrastrar factor"
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9 5a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm6-16a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4z" />
                                  </svg>
                                </div>

                                <div className="w-6 h-6 rounded-full bg-[#F6F5F3] border border-[#D5ECEC] flex items-center justify-center text-[11px] font-bold text-[#2B3F4C] shrink-0">
                                  {factor.order}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-semibold text-sm sm:text-base text-[#2B3F4C]">
                                      {factor.name}
                                    </h4>
                                  </div>
                                  {factor.description && (
                                    <p className="text-xs text-[#4F6170] line-clamp-1 mt-0.5">
                                      {factor.description}
                                    </p>
                                  )}

                                  {/* Píldoras de Métricas y Cálculos (Fase A GUIOS) */}
                                  <div className="flex items-center gap-2 flex-wrap mt-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-[8px] text-[10px] font-medium bg-[#F6F5F3] text-[#2B3F4C] border border-[#D5ECEC]">
                                      Citas: <strong className="ml-1">{factor.total_citations}</strong>
                                    </span>

                                    <span className="inline-flex items-center px-2 py-0.5 rounded-[8px] text-[10px] font-medium bg-[#F6F5F3] text-[#2B3F4C] border border-[#D5ECEC]">
                                      IE: <strong className="ml-1">{factor.expert_importance_label}</strong>
                                    </span>

                                    <span className="inline-flex items-center px-2 py-0.5 rounded-[8px] text-[10px] font-medium bg-[#D5ECEC]/50 text-[#16303B] border border-[#B4D6D6]">
                                      Subfactores: <strong className="ml-1">{factor.total_subfactors}</strong>
                                    </span>

                                    <div className="flex items-center gap-1 text-[10px]">
                                      <span className="text-[#4F6170] font-medium">IL (Lit):</span>
                                      {getImportanceBadge(factor.literature_importance_info?.label)}
                                    </div>

                                    <div className="flex items-center gap-1 text-[10px]">
                                      <span className="text-[#4F6170] font-medium">IS (Sug):</span>
                                      {getImportanceBadge(factor.suggested_importance_info?.label)}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Acciones de Factor */}
                              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                <button
                                  type="button"
                                  onClick={() => openCreateSubfactorModal(factor.id)}
                                  className="inline-flex items-center gap-1 py-1 px-2.5 rounded-[10px] bg-[#D5ECEC] hover:bg-[#7FBFC1] text-[#16303B] text-xs font-medium transition cursor-pointer"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                  </svg>
                                  <span>Subfactor</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openEditFactorModal(factor)}
                                  className="py-1 px-2.5 rounded-[10px] bg-white border border-[#D5ECEC] hover:bg-[#F6F5F3] text-xs font-medium text-[#2B3F4C] transition cursor-pointer"
                                >
                                  Editar
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setItemToDelete({
                                      type: 'factor',
                                      id: factor.id,
                                      name: factor.name,
                                    })
                                  }
                                  className="p-1 rounded-[8px] text-[#B84318] hover:bg-[#B84318]/10 transition cursor-pointer"
                                  title="Eliminar factor"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>

                                {/* Chevron para ver Subfactores */}
                                <button
                                  type="button"
                                  onClick={() => toggleFactor(factor.id)}
                                  className="p-1 rounded-[8px] text-[#4F6170] hover:text-[#2B3F4C] hover:bg-[#F6F5F3] transition cursor-pointer"
                                  title="Ver subfactores"
                                >
                                  <svg
                                    className={`w-4 h-4 transform transition-transform duration-200 ${isFactorExpanded ? 'rotate-180' : ''
                                      }`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* ── Contenido Nivel 3: Subfactores dentro del Factor ── */}
                            {isFactorExpanded && (
                              <div className="border-t border-[#D5ECEC] bg-[#F6F5F3]/70 p-4 space-y-2.5">
                                <div className="flex items-center justify-between text-[11px] text-[#4F6170] px-1 select-none">
                                  <span className="font-semibold text-[#2B3F4C]">
                                    Subfactores técnicos ({factor.subfactors.length})
                                  </span>
                                  <span>Arrastra para ordenar</span>
                                </div>

                                {factor.subfactors.length === 0 ? (
                                  <div className="bg-white rounded-[12px] p-4 text-center border border-dashed border-[#D5ECEC]">
                                    <p className="text-xs text-[#4F6170] mb-2">
                                      No hay subfactores registrados aún para este factor.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => openCreateSubfactorModal(factor.id)}
                                      className="px-3 py-1 rounded-[8px] bg-[#7FBFC1] text-[#16303B] text-xs font-semibold"
                                    >
                                      + Agregar subfactor
                                    </button>
                                  </div>
                                ) : (
                                  factor.subfactors.map((sub, subIndex) => {
                                    const isDraggingThisSub =
                                      draggedSubfactor?.factorId === factor.id &&
                                      draggedSubfactor?.index === subIndex;
                                    const isDragOverThisSub = dragOverSubfactorIndex === subIndex;

                                    return (
                                      <div
                                        key={sub.id}
                                        draggable
                                        onDragStart={(e) =>
                                          handleSubfactorDragStart(e, factor.id, subIndex)
                                        }
                                        onDragOver={(e) => handleSubfactorDragOver(e, subIndex)}
                                        onDrop={(e) => handleSubfactorDrop(e, factor.id, subIndex)}
                                        className={`bg-white rounded-[12px] border px-3.5 py-2 flex items-center justify-between gap-3 transition-all ${isDraggingThisSub
                                            ? 'opacity-40 border-dashed border-[#7FBFC1]'
                                            : isDragOverThisSub
                                              ? 'border-2 border-[#7FBFC1] bg-[#D5ECEC]/30'
                                              : 'border-[#D5ECEC] hover:border-[#7FBFC1]'
                                          }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div
                                            className="cursor-grab active:cursor-grabbing text-[#4F6170] hover:text-[#2B3F4C]"
                                            title="Arrastrar subfactor"
                                          >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                              <path d="M9 5a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm6-16a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4z" />
                                            </svg>
                                          </div>

                                          <div className="w-5 h-5 rounded-full bg-[#F6F5F3] border border-[#D5ECEC] flex items-center justify-center text-[10px] font-bold text-[#2B3F4C] shrink-0">
                                            {sub.order}
                                          </div>

                                          <div className="min-w-0">
                                            <p className="text-xs sm:text-sm font-medium text-[#2B3F4C] truncate">
                                              {sub.name}
                                            </p>
                                            {sub.description && (
                                              <p className="text-[11px] text-[#4F6170] truncate">
                                                {sub.description}
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => openEditSubfactorModal(sub)}
                                            className="px-2 py-1 rounded-[8px] text-[11px] font-semibold text-[#2B3F4C] hover:bg-[#F6F5F3] transition"
                                          >
                                            Editar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setItemToDelete({
                                                type: 'subfactor',
                                                id: sub.id,
                                                name: sub.name,
                                              })
                                            }
                                            className="p-1 rounded-[6px] text-[#B84318] hover:bg-[#B84318]/10 transition"
                                            title="Eliminar subfactor"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: CREAR / EDITAR DIMENSIÓN
      ───────────────────────────────────────────────────────────────────────────── */}
      {dimModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16303B]/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] max-w-md w-full p-6 space-y-5 border border-[#D5ECEC] shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#D5ECEC] pb-3">
              <h3 className="font-serif text-xl font-medium text-[#2B3F4C]">
                {dimModalMode === 'create' ? 'Nueva dimensión' : 'Editar dimensión'}
              </h3>
              <button
                type="button"
                onClick={() => setDimModalMode(null)}
                className="text-[#4F6170] hover:text-[#2B3F4C] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {dimModalError && (
              <div className="p-3 rounded-[12px] bg-[#B84318]/10 border border-[#B84318]/30 text-[#B84318] text-xs">
                {dimModalError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2B3F4C] uppercase tracking-wider mb-1">
                  Nombre de la dimensión *
                </label>
                <input
                  type="text"
                  value={dimFormName}
                  onChange={(e) => setDimFormName(e.target.value)}
                  placeholder="Ej. Dimensión Tecnológica"
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#F6F5F3] border border-[#D5ECEC] text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2B3F4C] uppercase tracking-wider mb-1">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  value={dimFormDesc}
                  onChange={(e) => setDimFormDesc(e.target.value)}
                  placeholder="Descripción metodológica de la dimensión..."
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#F6F5F3] border border-[#D5ECEC] text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D5ECEC]">
              <button
                type="button"
                onClick={() => setDimModalMode(null)}
                className="px-4 py-2 rounded-[12px] border border-[#D5ECEC] text-xs font-semibold text-[#2B3F4C] hover:bg-[#F6F5F3]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveDimension}
                disabled={isSavingDim}
                className="px-5 py-2 rounded-[12px] bg-[#7FBFC1] text-[#16303B] text-xs font-semibold hover:opacity-95 disabled:opacity-50"
              >
                {isSavingDim ? 'Guardando...' : 'Guardar dimensión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: CREAR / EDITAR FACTOR (CON CÁLCULOS EXPLICADOS)
      ───────────────────────────────────────────────────────────────────────────── */}
      {factorModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16303B]/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] max-w-lg w-full p-6 space-y-5 border border-[#D5ECEC] shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D5ECEC] pb-3">
              <div>
                <h3 className="font-serif text-xl font-medium text-[#2B3F4C]">
                  {factorModalMode === 'create' ? 'Nuevo factor técnico' : 'Editar factor'}
                </h3>
                <p className="text-xs text-[#4F6170] mt-0.5">
                  Los campos calculados (total subfactores, IL e IS) se actualizan al guardar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFactorModalMode(null)}
                className="text-[#4F6170] hover:text-[#2B3F4C] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {factorModalError && (
              <div className="p-3 rounded-[12px] bg-[#B84318]/10 border border-[#B84318]/30 text-[#B84318] text-xs">
                {factorModalError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2B3F4C] uppercase tracking-wider mb-1">
                  Nombre del factor *
                </label>
                <input
                  type="text"
                  value={factorFormName}
                  onChange={(e) => setFactorFormName(e.target.value)}
                  placeholder="Ej. Mantenibilidad, Seguridad, Compatibilidad..."
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#F6F5F3] border border-[#D5ECEC] text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2B3F4C] uppercase tracking-wider mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  value={factorFormDesc}
                  onChange={(e) => setFactorFormDesc(e.target.value)}
                  placeholder="Descripción metodológica del factor..."
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#F6F5F3] border border-[#D5ECEC] text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2B3F4C] uppercase tracking-wider mb-1">
                    Total de citas (TC) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={factorFormCitations}
                    onChange={(e) => setFactorFormCitations(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#F6F5F3] border border-[#D5ECEC] text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1]"
                  />
                  <span className="text-[10px] text-[#4F6170] mt-1 block">
                    Citas en la literatura científica
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B3F4C] uppercase tracking-wider mb-1">
                    Importancia experto (IE) *
                  </label>
                  <select
                    value={factorFormExpertImp}
                    onChange={(e) => setFactorFormExpertImp(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#F6F5F3] border border-[#D5ECEC] text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1]"
                  >
                    {EXPERT_IMPORTANCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-[#4F6170] mt-1 block">
                    Ponderación del panel de expertos
                  </span>
                </div>
              </div>

              {/* Panel Informativo de Campos Calculados */}
              <div className="p-4 rounded-[14px] bg-[#F6F5F3] border border-[#D5ECEC] space-y-2">
                <span className="text-[11px] font-bold text-[#2B3F4C] uppercase tracking-wider block">
                  Campos calculados automáticamente por GUIOS:
                </span>
                <ul className="text-xs text-[#4F6170] space-y-1 list-disc list-inside">
                  <li>
                    <strong>Total subfactores:</strong> Se calcula automáticamente contando los subfactores asociados.
                  </li>
                  <li>
                    <strong>Importancia de Literatura (IL):</strong> Cuartiles sobre la relación citas/subfactores.
                  </li>
                  <li>
                    <strong>Importancia Sugerida (IS):</strong> Matriz(IE, IL) = ⌊(IE + IL) / 2⌋.
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D5ECEC]">
              <button
                type="button"
                onClick={() => setFactorModalMode(null)}
                className="px-4 py-2 rounded-[12px] border border-[#D5ECEC] text-xs font-semibold text-[#2B3F4C] hover:bg-[#F6F5F3]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveFactor}
                disabled={isSavingFactor}
                className="px-5 py-2 rounded-[12px] bg-[#7FBFC1] text-[#16303B] text-xs font-semibold hover:opacity-95 disabled:opacity-50"
              >
                {isSavingFactor ? 'Guardando...' : 'Guardar factor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: CREAR / EDITAR SUBFACTOR
      ───────────────────────────────────────────────────────────────────────────── */}
      {subModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16303B]/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] max-w-md w-full p-6 space-y-5 border border-[#D5ECEC] shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#D5ECEC] pb-3">
              <h3 className="font-serif text-xl font-medium text-[#2B3F4C]">
                {subModalMode === 'create' ? 'Nuevo subfactor' : 'Editar subfactor'}
              </h3>
              <button
                type="button"
                onClick={() => setSubModalMode(null)}
                className="text-[#4F6170] hover:text-[#2B3F4C] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {subModalError && (
              <div className="p-3 rounded-[12px] bg-[#B84318]/10 border border-[#B84318]/30 text-[#B84318] text-xs">
                {subModalError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2B3F4C] uppercase tracking-wider mb-1">
                  Nombre del subfactor *
                </label>
                <input
                  type="text"
                  value={subFormName}
                  onChange={(e) => setSubFormName(e.target.value)}
                  placeholder="Ej. Modularidad, Documentación, Licencia..."
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#F6F5F3] border border-[#D5ECEC] text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2B3F4C] uppercase tracking-wider mb-1">
                  Descripción o Criterio técnico
                </label>
                <textarea
                  rows={3}
                  value={subFormDesc}
                  onChange={(e) => setSubFormDesc(e.target.value)}
                  placeholder="Criterio específico que evaluará el decisor..."
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#F6F5F3] border border-[#D5ECEC] text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] resize-none"
                />
              </div>

              <div className="p-3 rounded-[12px] bg-[#D5ECEC]/30 border border-[#D5ECEC] text-[11px] text-[#16303B]">
                💡 Al agregar o modificar este subfactor, la importancia sugerida (IS) de los factores se recalculará automáticamente.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D5ECEC]">
              <button
                type="button"
                onClick={() => setSubModalMode(null)}
                className="px-4 py-2 rounded-[12px] border border-[#D5ECEC] text-xs font-semibold text-[#2B3F4C] hover:bg-[#F6F5F3]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSubfactor}
                disabled={isSavingSub}
                className="px-5 py-2 rounded-[12px] bg-[#7FBFC1] text-[#16303B] text-xs font-semibold hover:opacity-95 disabled:opacity-50"
              >
                {isSavingSub ? 'Guardando...' : 'Guardar subfactor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL DE CONFIRMACIÓN DE ELIMINACIÓN
      ───────────────────────────────────────────────────────────────────────────── */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16303B]/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] max-w-sm w-full p-6 space-y-4 border border-[#B84318]/30 shadow-2xl animate-fade-in text-center">
            <div className="w-12 h-12 rounded-full bg-[#B84318]/15 text-[#B84318] flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            <div>
              <h3 className="font-serif text-lg font-bold text-[#2B3F4C]">
                ¿Eliminar {itemToDelete.type === 'dimension' ? 'dimensión' : itemToDelete.type === 'factor' ? 'factor' : 'subfactor'}?
              </h3>
              <p className="text-xs text-[#4F6170] mt-1 leading-relaxed">
                Estás a punto de eliminar <strong>"{itemToDelete.name}"</strong>. Esta acción recalculará la distribución de importancia.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-[12px] border border-[#D5ECEC] text-xs font-semibold text-[#2B3F4C] hover:bg-[#F6F5F3]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-[12px] bg-[#B84318] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal de Consulta de Citas con IA (Groq) ── */}
      <AiCitationModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        dimensions={treeData}
        onApplySuccess={fetchTree}
      />
    </div>
  );
};
