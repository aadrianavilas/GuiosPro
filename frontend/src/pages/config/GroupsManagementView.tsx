import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';
import { DynamicIcon } from '@/components/navigation/DynamicIcon';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

export interface GroupItem {
  id: number;
  name: string;
  users_count: number;
  permissions_count: number;
  options_count?: number;
}

export interface PermissionItem {
  id: number;
  name: string;
  codename: string;
  raw_name?: string;
}

export interface ModuleOptionInfo {
  id: number;
  name: string;
  icon: string | null;
  path: string;
  order: number;
  slug?: string;
}

export interface ModuleGroupedOptions {
  id: number;
  name: string;
  icon: string | null;
  order: number;
  options: ModuleOptionInfo[];
}

export interface PermissionAssignment {
  id?: number;
  group_id: number;
  module_option_id: number;
  permission_id: number;
  permission_name?: string;
  permission_codename?: string;
}

export const GroupsManagementView: React.FC = () => {
  // Pestaña activa: 'groups' o 'permissions'
  const [activeTab, setActiveTab] = useState<'groups' | 'permissions'>('groups');

  // Datos principales cargados desde la API
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<PermissionItem[]>([]);
  const [modules, setModules] = useState<ModuleGroupedOptions[]>([]);
  
  // Asignaciones de permisos originales y modificadas (mapa: optionId -> Set de permissionIds)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [currentAssignments, setCurrentAssignments] = useState<Record<number, Set<number>>>({});
  const [initialAssignments, setInitialAssignments] = useState<Record<number, Set<number>>>({});

  // Control de estados de carga y mensajes
  const toast = useToast();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Buscadores
  const [groupSearchQuery, setGroupSearchQuery] = useState<string>('');
  const [permissionSearchQuery, setPermissionSearchQuery] = useState<string>('');

  // Control de acordeones para "Elegir con casillas" por cada module_option_id
  const [expandedCheckboxes, setExpandedCheckboxes] = useState<Record<number, boolean>>({});

  // Arrastre y soltado (Drag and Drop)
  const [draggedPermissionId, setDraggedPermissionId] = useState<number | null>(null);
  const [dragOverOptionId, setDragOverOptionId] = useState<number | null>(null);

  // Modales de Grupo (Crear / Editar)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [editGroupName, setEditGroupName] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);

  const showNotification = (message: string) => {
    toast.success(message);
  };

  // Cargar datos de la matriz de permisos y grupos
  const fetchPermissionsMatrix = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/config/groups/permissions-matrix/', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('No se pudo obtener la información de grupos y permisos.');
      }

      const data = await response.json();
      setGroups(data.groups || []);
      setAvailablePermissions(data.available_permissions || []);
      setModules(data.modules || []);

      // Seleccionar el primer grupo por defecto si no hay ninguno seleccionado
      const defaultGroup = data.groups?.[0];
      const targetGroupId = selectedGroupId || (defaultGroup ? defaultGroup.id : null);
      if (targetGroupId) {
        setSelectedGroupId(targetGroupId);
        loadGroupAssignments(targetGroupId, data.assignments || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissionsMatrix();
  }, []);

  // Organizar las asignaciones para un grupo específico
  const loadGroupAssignments = (groupId: number, allAssignments: PermissionAssignment[]) => {
    const map: Record<number, Set<number>> = {};
    allAssignments.forEach((item) => {
      if (item.group_id === groupId) {
        if (!map[item.module_option_id]) {
          map[item.module_option_id] = new Set();
        }
        map[item.module_option_id].add(item.permission_id);
      }
    });

    // Clonar para comparar cambios pendientes
    const initialMap: Record<number, Set<number>> = {};
    Object.keys(map).forEach((optId) => {
      initialMap[Number(optId)] = new Set(map[Number(optId)]);
    });

    setCurrentAssignments(map);
    setInitialAssignments(initialMap);
  };

  // Cambio de grupo activo en la pestaña de asociar permisos
  const handleSelectGroup = async (groupId: number) => {
    setSelectedGroupId(groupId);
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/config/groups/permissions-matrix/', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        loadGroupAssignments(groupId, data.assignments || []);
      }
    } catch {
      // Manejo silencioso de reconexión
    } finally {
      setIsLoading(false);
    }
  };

  // Detectar si hay cambios pendientes sin guardar para el grupo actual
  const hasPendingChanges = useMemo(() => {
    const allOptionIds = new Set([
      ...Object.keys(currentAssignments).map(Number),
      ...Object.keys(initialAssignments).map(Number),
    ]);

    for (const optId of allOptionIds) {
      const currentSet = currentAssignments[optId] || new Set();
      const initialSet = initialAssignments[optId] || new Set();

      if (currentSet.size !== initialSet.size) return true;
      for (const permId of currentSet) {
        if (!initialSet.has(permId)) return true;
      }
    }
    return false;
  }, [currentAssignments, initialAssignments]);

  // Contar en cuántas opciones está asignado cada permiso para el grupo activo
  const permissionUsageCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    Object.values(currentAssignments).forEach((permSet) => {
      permSet.forEach((permId) => {
        counts[permId] = (counts[permId] || 0) + 1;
      });
    });
    return counts;
  }, [currentAssignments]);

  // Asociar o desasociar un permiso a una opción mediante checkbox
  const handleToggleCheckbox = (optionId: number, permissionId: number) => {
    setCurrentAssignments((prev) => {
      const nextMap = { ...prev };
      const currentSet = new Set(nextMap[optionId] || []);

      if (currentSet.has(permissionId)) {
        currentSet.delete(permissionId);
      } else {
        currentSet.add(permissionId);
      }

      nextMap[optionId] = currentSet;
      return nextMap;
    });
  };

  // Remover un permiso asignado al hacer click en la cruz (✕) del chip
  const handleRemovePermissionChip = (optionId: number, permissionId: number) => {
    setCurrentAssignments((prev) => {
      const nextMap = { ...prev };
      const currentSet = new Set(nextMap[optionId] || []);
      currentSet.delete(permissionId);
      nextMap[optionId] = currentSet;
      return nextMap;
    });
  };

  // Alternar el desplegable "Elegir con casillas"
  const toggleCheckboxAccordion = (optionId: number) => {
    setExpandedCheckboxes((prev) => ({
      ...prev,
      [optionId]: !prev[optionId],
    }));
  };

  // ── Handlers de Arrastre (Drag and Drop de permisos a opciones) ──
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, permissionId: number) => {
    setDraggedPermissionId(permissionId);
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', String(permissionId));
  };

  const handleDragOverOption = (e: React.DragEvent<HTMLDivElement>, optionId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (dragOverOptionId !== optionId) {
      setDragOverOptionId(optionId);
    }
  };

  const handleDropOnOption = (e: React.DragEvent<HTMLDivElement>, optionId: number) => {
    e.preventDefault();
    setDragOverOptionId(null);
    if (!draggedPermissionId) return;

    setCurrentAssignments((prev) => {
      const nextMap = { ...prev };
      const currentSet = new Set(nextMap[optionId] || []);
      currentSet.add(draggedPermissionId);
      nextMap[optionId] = currentSet;
      return nextMap;
    });

    const perm = availablePermissions.find((p) => p.id === draggedPermissionId);
    if (perm) {
      showNotification(`Permiso "${perm.name}" asociado a la opción.`);
    }

    setDraggedPermissionId(null);
  };

  // Guardar cambios en lote en el servidor
  const handleSaveAssignments = async () => {
    if (!selectedGroupId) return;

    try {
      setIsSaving(true);
      const associations = Object.entries(currentAssignments)
        .map(([optIdStr, permSet]) => ({
          module_option_id: Number(optIdStr),
          permission_ids: Array.from(permSet),
        }))
        .filter((item) => item.permission_ids.length > 0);

      const response = await fetch(`/api/v1/config/groups/${selectedGroupId}/sync-permissions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ associations }),
      });

      if (!response.ok) {
        throw new Error('No se pudieron guardar las asignaciones de permisos.');
      }

      // Sincronizar el estado inicial de inmediato para desactivar el aviso
      const updatedInitialMap: Record<number, Set<number>> = {};
      Object.keys(currentAssignments).forEach((optId) => {
        const permSet = currentAssignments[Number(optId)];
        if (permSet && permSet.size > 0) {
          updatedInitialMap[Number(optId)] = new Set(permSet);
        }
      });
      setInitialAssignments(updatedInitialMap);

      showNotification('Permisos guardados y sincronizados correctamente.');

      // Actualizar conteos de grupos de forma suave sin alterar el grupo seleccionado
      const groupsRes = await fetch('/api/v1/config/groups/', { credentials: 'include' });
      if (groupsRes.ok) {
        const updatedGroups = await groupsRes.json();
        setGroups(updatedGroups);
      }

      // Notificar navegación para sincronizar menú lateral
      window.dispatchEvent(new CustomEvent('guiospro_modules_updated'));
    } catch (err: any) {
      toast.error(err.message || 'Error al persistir cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  // Descartar cambios pendientes
  const handleDiscardChanges = () => {
    const resetMap: Record<number, Set<number>> = {};
    Object.keys(initialAssignments).forEach((optId) => {
      resetMap[Number(optId)] = new Set(initialAssignments[Number(optId)]);
    });
    setCurrentAssignments(resetMap);
    showNotification('Cambios descartados.');
  };

  // ── Gestión de Grupos (Crear / Editar) ──
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newGroupName.trim();
    if (!cleanName) {
      setModalError('El nombre del grupo es obligatorio.');
      return;
    }

    try {
      setIsSaving(true);
      setModalError(null);
      const response = await fetch('/api/v1/config/groups/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: cleanName }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.name || data.detail || 'Error al crear el grupo.');
      }

      const created = await response.json();
      setGroups((prev) => [...prev, created]);
      setIsCreateModalOpen(false);
      setNewGroupName('');
      showNotification(`Grupo "${cleanName}" creado exitosamente.`);
    } catch (err: any) {
      setModalError(err.message || 'Error al guardar el nuevo grupo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    const cleanName = editGroupName.trim();
    if (!cleanName) {
      setModalError('El nombre del grupo no puede estar vacío.');
      return;
    }

    try {
      setIsSaving(true);
      setModalError(null);
      const response = await fetch(`/api/v1/config/groups/${editingGroup.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: cleanName }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.name || data.detail || 'Error al actualizar el grupo.');
      }

      const updated = await response.json();
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)));
      setEditingGroup(null);
      setEditGroupName('');
      showNotification(`Grupo actualizado a "${cleanName}".`);
    } catch (err: any) {
      setModalError(err.message || 'Error al actualizar el grupo.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtrado de grupos
  const filteredGroups = useMemo(() => {
    const q = groupSearchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, groupSearchQuery]);

  // Filtrado de permisos disponibles
  const filteredAvailablePermissions = useMemo(() => {
    const q = permissionSearchQuery.trim().toLowerCase();
    if (!q) return availablePermissions;
    return availablePermissions.filter(
      (p) => p.name.toLowerCase().includes(q) || p.codename.toLowerCase().includes(q)
    );
  }, [availablePermissions, permissionSearchQuery]);

  // Total de opciones en los módulos
  const totalOptionsCount = useMemo(() => {
    return modules.reduce((acc, mod) => acc + (mod.options || []).length, 0);
  }, [modules]);

  const selectedGroupObj = groups.find((g) => g.id === selectedGroupId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      {/* ── Banner Superior Institucional GuiosPro ── */}
      <div className="relative overflow-hidden rounded-[24px] bg-[#F7A35F] px-8 py-7 shadow-none border border-[#FBB982]/60">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#FBB982]/40 pointer-events-none" />
        <div className="absolute -bottom-16 right-24 w-40 h-40 rounded-full bg-[#FBB982]/30 pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <span className="inline-block px-3 py-1 text-[11px] font-bold tracking-wider uppercase rounded-full bg-[#F9E8A0] text-[#5B4A12] mb-3">
            CONFIGURACIÓN DEL SISTEMA
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-medium text-[#2B3F4C] tracking-tight mb-2">
            Grupos y Permisos
          </h1>
          <p className="text-xs sm:text-sm text-[#2B3F4C]/90 leading-relaxed font-sans">
            Administra los roles del sistema y asocia permisos granulares a cada opción de los módulos mediante arrastre o selección por casillas.
          </p>
        </div>
      </div>

      {/* ── Selector de Pestañas (Tabs) Estilo Imagen ── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('groups')}
          className={`px-5 py-2.5 rounded-full text-xs font-semibold transition cursor-pointer ${
            activeTab === 'groups'
              ? 'bg-white text-[#2B3F4C] border border-[#D5ECEC] shadow-xs'
              : 'bg-[#D5ECEC]/50 text-[#4F6170] hover:bg-[#D5ECEC] hover:text-[#2B3F4C]'
          }`}
        >
          Grupos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`px-5 py-2.5 rounded-full text-xs font-semibold transition cursor-pointer ${
            activeTab === 'permissions'
              ? 'bg-white text-[#2B3F4C] border border-[#D5ECEC] shadow-xs'
              : 'bg-[#D5ECEC]/50 text-[#4F6170] hover:bg-[#D5ECEC] hover:text-[#2B3F4C]'
          }`}
        >
          Asociar permisos
        </button>
      </div>

      {/* ============================================================== */}
      {/* ── PESTAÑA 1: LISTADO DE GRUPOS (Igual a Módulos) ──────────── */}
      {/* ============================================================== */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          {/* Barra de Búsqueda y Botón Nuevo Grupo */}
          <div className="bg-white rounded-[20px] border border-[#D5ECEC] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 shadow-none">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </span>
              <input
                type="text"
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                placeholder="Buscar grupos o roles..."
                className="w-full pl-9 pr-3.5 py-2.5 text-xs text-[#2B3F4C] bg-white border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition placeholder-[#4F6170]/60"
              />
              {groupSearchQuery && (
                <button
                  type="button"
                  onClick={() => setGroupSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#4F6170] hover:text-[#2B3F4C] cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setNewGroupName('');
                setModalError(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[14px] bg-[#7FBFC1] text-[#16303B] text-xs font-semibold hover:opacity-95 transition cursor-pointer shrink-0"
            >
              <span>+ Nuevo grupo</span>
            </button>
          </div>

          {/* Contenedor Blanco de Tarjetas de Grupos */}
          <div className="bg-white rounded-[24px] border border-[#D5ECEC] p-6 sm:p-7 shadow-none space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-[#D5ECEC]/40">
              <h2 className="text-lg font-serif font-bold text-[#2B3F4C]">
                Grupos registrados ({filteredGroups.length})
              </h2>
              <span className="text-xs text-[#4F6170]">
                Roles con permisos en GuiosPro
              </span>
            </div>

            <div className="space-y-3.5">
              {isLoading && (
                <div className="py-12 flex flex-col items-center justify-center">
                  <GuiosProSpinner size="lg" label="Cargando roles y permisos..." />
                </div>
              )}

              {!isLoading &&
                filteredGroups.map((grp) => (
                  <div
                    key={grp.id}
                    className="bg-white rounded-[20px] border border-[#D5ECEC] p-4 sm:p-5 flex items-center justify-between gap-4 hover:border-[#7FBFC1]/80 transition"
                  >
                    {/* Lado izquierdo: Ícono + Nombre + Métricas */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-[14px] bg-[#D5ECEC] text-[#16303B] flex items-center justify-center shrink-0">
                        <DynamicIcon name="UsersIcon" className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-serif text-lg font-bold text-[#2B3F4C] tracking-tight truncate">
                          {grp.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-block px-2.5 py-0.5 rounded-[8px] text-[11px] font-medium bg-[#F6F5F3] border border-[#D5ECEC] text-[#2B3F4C]">
                            {grp.users_count} {grp.users_count === 1 ? 'usuario' : 'usuarios'}
                          </span>
                          <span className="inline-block px-2.5 py-0.5 rounded-[8px] text-[11px] font-medium bg-[#F6F5F3] border border-[#D5ECEC] text-[#4F6170]">
                            {grp.permissions_count} permisos asignados
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Lado derecho: Botones de Acción */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGroupId(grp.id);
                          handleSelectGroup(grp.id);
                          setActiveTab('permissions');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[12px] bg-[#D5ECEC] text-xs font-semibold text-[#16303B] hover:bg-[#7FBFC1] transition cursor-pointer"
                      >
                        <DynamicIcon name="KeyIcon" className="w-3.5 h-3.5" />
                        <span>Asociar permisos</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingGroup(grp);
                          setEditGroupName(grp.name);
                          setModalError(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[12px] bg-white border border-[#D5ECEC] text-xs font-semibold text-[#2B3F4C] hover:bg-[#F6F5F3] hover:border-[#7FBFC1] transition cursor-pointer shadow-none"
                      >
                        <svg className="w-3.5 h-3.5 text-[#4F6170]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Editar</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ── PESTAÑA 2: ASOCIAR PERMISOS (Exactamente según Imagen) ───── */}
      {/* ============================================================== */}
      {activeTab === 'permissions' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Selector de Grupo Arriba en Tarjetas */}
          <div className="bg-white rounded-[20px] border border-[#D5ECEC] p-4 shadow-none">
            <span className="block text-xs font-bold text-[#4F6170] uppercase tracking-wider mb-2.5">
              Seleccionar grupo a configurar:
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {groups.map((grp) => {
                const isSelected = grp.id === selectedGroupId;
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => handleSelectGroup(grp.id)}
                    className={`px-4 py-2 rounded-[14px] text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-[#D5ECEC] border-2 border-[#7FBFC1] text-[#16303B] shadow-xs'
                        : 'bg-white border border-[#D5ECEC] text-[#4F6170] hover:bg-[#F6F5F3] hover:text-[#2B3F4C]'
                    }`}
                  >
                    <DynamicIcon name="ShieldCheckIcon" className="w-4 h-4 text-[#2B3F4C]" />
                    <span>{grp.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/80 text-[#2B3F4C] border border-[#D5ECEC]">
                      {grp.permissions_count} perms
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dos Columnas Principales: Permisos Disponibles vs Opciones del Menú */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ── Columna Izquierda: Permisos disponibles (4 columnas) ── */}
            <div className="lg:col-span-5 bg-white rounded-[24px] border border-[#D5ECEC] p-6 shadow-none space-y-4">
              <div>
                <h3 className="font-serif text-xl font-bold text-[#2B3F4C]">
                  Permisos disponibles ({filteredAvailablePermissions.length})
                </h3>
                <p className="text-xs text-[#4F6170] mt-0.5">
                  Arrastra un permiso hacia una opción para asociarlo.
                </p>
              </div>

              {/* Buscador de Permisos */}
              <div className="relative">
                <input
                  type="text"
                  value={permissionSearchQuery}
                  onChange={(e) => setPermissionSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o código"
                  className="w-full pl-3.5 pr-8 py-2 text-xs text-[#2B3F4C] bg-white border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition placeholder-[#4F6170]/60"
                />
                {permissionSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPermissionSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#4F6170] hover:text-[#2B3F4C] cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Lista Scrollable de Permisos Arrastrables */}
              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {filteredAvailablePermissions.map((perm) => {
                  const usageCount = permissionUsageCounts[perm.id] || 0;
                  const isDragging = draggedPermissionId === perm.id;

                  return (
                    <div
                      key={perm.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, perm.id)}
                      onDragEnd={() => setDraggedPermissionId(null)}
                      className={`p-3 rounded-[16px] border border-[#D5ECEC] bg-white flex items-center justify-between gap-3 transition cursor-grab active:cursor-grabbing hover:border-[#7FBFC1] hover:shadow-xs select-none ${
                        isDragging ? 'opacity-40 border-dashed border-[#7FBFC1] bg-[#F6F5F3]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Tirador Grip */}
                        <div className="text-[#4F6170]/60 hover:text-[#2B3F4C] p-0.5 shrink-0">
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7 4a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm6-12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                          </svg>
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#2B3F4C] truncate leading-tight">
                            {perm.name}
                          </h4>
                          <span className="text-[10px] font-mono text-[#4F6170] block truncate">
                            {perm.codename}
                          </span>
                        </div>
                      </div>

                      {/* Badge indicador de uso */}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                          usageCount > 0
                            ? 'bg-[#F9E8A0]/70 text-[#5B4A12]'
                            : 'bg-[#F6F5F3] text-[#4F6170]'
                        }`}
                      >
                        {usageCount > 0 ? `En ${usageCount} opción` : 'Sin asignar'}
                      </span>
                    </div>
                  );
                })}

                {filteredAvailablePermissions.length === 0 && (
                  <div className="py-8 text-center text-xs text-[#4F6170]">
                    No se encontraron permisos disponibles.
                  </div>
                )}
              </div>
            </div>

            {/* ── Columna Derecha: Opciones del menú (7 columnas) ── */}
            <div className="lg:col-span-7 bg-white rounded-[24px] border border-[#D5ECEC] p-6 shadow-none space-y-4">
              <div>
                <h3 className="font-serif text-xl font-bold text-[#2B3F4C]">
                  Opciones del menú ({totalOptionsCount})
                </h3>
                <p className="text-xs text-[#4F6170] mt-0.5">
                  Suelta aquí los permisos, o abre "Elegir con casillas" en cada opción.
                </p>
              </div>

              {/* Banner suave de ayuda */}
              <div className="p-3 rounded-[14px] bg-[#F6F5F3] border border-[#D5ECEC] text-xs text-[#4F6170] leading-relaxed">
                Arrastra un permiso de la izquierda sobre una opción, o usa las casillas de cada opción.
              </div>

              {/* Lista de Opciones Agrupadas por Módulo */}
              <div className="space-y-6 max-h-[580px] overflow-y-auto pr-1">
                {modules.map((mod) => (
                  <div key={mod.id} className="space-y-3">
                    {/* Encabezado del Módulo (Categoría) */}
                    <div className="text-[11px] font-bold text-[#4F6170] uppercase tracking-wider border-b border-[#D5ECEC]/50 pb-1 flex items-center justify-between">
                      <span>{mod.name}</span>
                      <span className="text-[10px] font-normal normal-case">
                        {(mod.options || []).length} opciones
                      </span>
                    </div>

                    {/* Opciones del Módulo */}
                    <div className="space-y-3">
                      {(mod.options || []).map((opt) => {
                        const assignedPermIds = currentAssignments[opt.id] || new Set();
                        const assignedList = availablePermissions.filter((p) =>
                          assignedPermIds.has(p.id)
                        );
                        const isOver = dragOverOptionId === opt.id;
                        const isCheckboxesExpanded = Boolean(expandedCheckboxes[opt.id]);

                        return (
                          <div
                            key={opt.id}
                            onDragOver={(e) => handleDragOverOption(e, opt.id)}
                            onDrop={(e) => handleDropOnOption(e, opt.id)}
                            onDragLeave={() => setDragOverOptionId(null)}
                            className={`p-4 rounded-[18px] border transition-all ${
                              isOver
                                ? 'border-[#7FBFC1] ring-2 ring-[#7FBFC1]/30 bg-[#D5ECEC]/20'
                                : 'border-[#D5ECEC] bg-white hover:border-[#7FBFC1]/70'
                            }`}
                          >
                            {/* Cabecera de la Opción */}
                            <div className="flex items-center justify-between gap-3 mb-2.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-[10px] bg-[#D5ECEC] text-[#16303B] flex items-center justify-center shrink-0">
                                  <DynamicIcon name={opt.icon || 'ClipboardDocumentListIcon'} className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-[#2B3F4C] truncate leading-tight">
                                    {opt.name}
                                  </h4>
                                  <span className="text-[10px] font-mono text-[#4F6170] block truncate">
                                    {opt.slug || opt.name.toLowerCase().replace(/\s+/g, '_')}
                                  </span>
                                </div>
                              </div>

                              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#D5ECEC] text-[#16303B] shrink-0">
                                {assignedList.length} {assignedList.length === 1 ? 'permiso' : 'permisos'}
                              </span>
                            </div>

                            {/* Chips de Permisos Asignados con Botón ✕ para Remover */}
                            <div className="flex flex-wrap items-center gap-1.5 min-h-[28px] mb-2.5">
                              {assignedList.length > 0 ? (
                                assignedList.map((p) => (
                                  <span
                                    key={p.id}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-[11px] font-medium bg-[#F6F5F3] border border-[#D5ECEC] text-[#2B3F4C] animate-in fade-in"
                                  >
                                    <span>{p.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePermissionChip(opt.id, p.id)}
                                      className="text-[#4F6170] hover:text-[#B8531A] font-bold cursor-pointer transition"
                                      title="Quitar este permiso de la opción"
                                    >
                                      ✕
                                    </button>
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-[#4F6170]/60 italic py-0.5">
                                  Sin permisos asignados (Arrastra un permiso aquí)
                                </span>
                              )}
                            </div>

                            {/* Botón Acordeón "Elegir con casillas" */}
                            <div className="pt-1 border-t border-[#D5ECEC]/40">
                              <button
                                type="button"
                                onClick={() => toggleCheckboxAccordion(opt.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2B3F4C] hover:text-[#7FBFC1] transition cursor-pointer select-none"
                              >
                                <svg
                                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                    isCheckboxesExpanded ? 'rotate-180' : 'rotate-0'
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                                <span>Elegir con casillas</span>
                              </button>

                              {/* Desplegable de Casillas (Checklist en Cuadrícula) */}
                              {isCheckboxesExpanded && (
                                <div className="mt-3 p-3.5 rounded-[14px] bg-[#F6F5F3]/80 border border-[#D5ECEC] grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in max-h-56 overflow-y-auto">
                                  {availablePermissions.map((perm) => {
                                    const isChecked = assignedPermIds.has(perm.id);

                                    return (
                                      <label
                                        key={perm.id}
                                        className="flex items-start gap-2 p-2 rounded-[10px] bg-white border border-[#D5ECEC] hover:border-[#7FBFC1] cursor-pointer transition select-none"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleToggleCheckbox(opt.id, perm.id)}
                                          className="mt-0.5 h-3.5 w-3.5 rounded border-[#D5ECEC] text-[#319795] focus:ring-[#7FBFC1] cursor-pointer"
                                        />
                                        <div className="min-w-0">
                                          <span className="text-[11px] font-bold text-[#2B3F4C] block leading-tight truncate">
                                            {perm.name}
                                          </span>
                                          <span className="text-[9px] font-mono text-[#4F6170] block truncate">
                                            {perm.codename}
                                          </span>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Barra Inferior de Acción / Estado (Exactamente como en la Imagen) ── */}
          <div className="bg-white rounded-[20px] border border-[#D5ECEC] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-none">
            <div className="text-xs text-[#4F6170]">
              {hasPendingChanges ? (
                <span className="font-semibold text-[#B8531A] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#B8531A] animate-ping" />
                  Tienes cambios pendientes sin guardar para "{selectedGroupObj?.name}".
                </span>
              ) : (
                <span className="text-[#4F6170]">Sin cambios pendientes</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={!hasPendingChanges || isSaving}
                className="px-4 py-2 rounded-[14px] bg-[#F6F5F3] border border-[#D5ECEC] text-xs font-semibold text-[#4F6170] hover:bg-[#D5ECEC]/50 hover:text-[#2B3F4C] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Descartar
              </button>

              <button
                type="button"
                onClick={handleSaveAssignments}
                disabled={!hasPendingChanges || isSaving}
                className="px-5 py-2 rounded-[14px] bg-[#243642] text-white text-xs font-semibold hover:bg-[#1A2832] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Creación de Grupo ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#243642]/40 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-white rounded-[24px] border border-[#D5ECEC] p-6 max-w-md w-full shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#D5ECEC]/70 pb-3">
              <h3 className="font-serif text-xl font-bold text-[#2B3F4C]">
                Crear nuevo grupo
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-7 h-7 rounded-full text-[#4F6170] hover:text-[#2B3F4C] flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-[12px] bg-[#FDE2C8] border border-[#FBB982] text-xs text-[#7A3E0A] font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2B3F4C] mb-1.5">
                  Nombre del rol / grupo <span className="text-[#B8531A]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Ej. Auditor"
                  className="w-full px-3.5 py-2.5 text-xs text-[#2B3F4C] bg-white border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D5ECEC]/70">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-[14px] bg-[#F6F5F3] text-xs font-semibold text-[#4F6170] hover:bg-[#D5ECEC]/50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-[14px] bg-[#7FBFC1] text-xs font-semibold text-[#16303B] hover:opacity-95 transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Creando...' : 'Crear grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Edición de Nombre de Grupo ── */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#243642]/40 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-white rounded-[24px] border border-[#D5ECEC] p-6 max-w-md w-full shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#D5ECEC]/70 pb-3">
              <h3 className="font-serif text-xl font-bold text-[#2B3F4C]">
                Editar grupo
              </h3>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="w-7 h-7 rounded-full text-[#4F6170] hover:text-[#2B3F4C] flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-[12px] bg-[#FDE2C8] border border-[#FBB982] text-xs text-[#7A3E0A] font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleUpdateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2B3F4C] mb-1.5">
                  Nombre del grupo <span className="text-[#B8531A]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs text-[#2B3F4C] bg-white border border-[#D5ECEC] rounded-[14px] focus:outline-none focus:border-[#7FBFC1] transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D5ECEC]/70">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-[14px] bg-[#F6F5F3] text-xs font-semibold text-[#4F6170] hover:bg-[#D5ECEC]/50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-[14px] bg-[#7FBFC1] text-xs font-semibold text-[#16303B] hover:opacity-95 transition cursor-pointer disabled:opacity-50"
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
