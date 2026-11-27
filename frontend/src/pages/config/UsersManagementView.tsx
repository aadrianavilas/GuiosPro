import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

export interface UserGroupItem {
  id: number;
  name: string;
}

export interface ManagedUser {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  username: string;
  email: string;
  is_active: boolean;
  groups: UserGroupItem[];
  is_staff?: boolean;
  is_superuser?: boolean;
  avatar?: string | null;
  created_at?: string;
  date_joined?: string;
}

interface NewUserData {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  assignedGroupIds: number[];
}

export const UsersManagementView: React.FC = () => {
  const toast = useToast();
  // Estado principal de usuarios y grupos disponibles
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [allGroups, setAllGroups] = useState<UserGroupItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Estado para el modal de Creación (Wizard de 2 pasos)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState<NewUserData>({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    assignedGroupIds: [],
  });

  // Estado para el modal de Edición
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editAssignedGroupIds, setEditAssignedGroupIds] = useState<number[]>([]);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  // Arrastre y soltado (Drag and Drop) para grupos
  const [draggedGroupId, setDraggedGroupId] = useState<number | null>(null);
  const [isDragOverDropZone, setIsDragOverDropZone] = useState<boolean>(false);

  // Control de toggle activo por usuario
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  // Usuario autenticado actual en sesión (para impedir auto-desactivación)
  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('guiospro_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const isSelf = (user: ManagedUser) => {
    if (!currentUser) return false;
    if (currentUser.id && user.id === currentUser.id) return true;
    if (currentUser.username && user.username === currentUser.username) return true;
    if (currentUser.email && user.email === currentUser.email) return true;
    return false;
  };

  const showNotification = (msg: string) => {
    toast.success(msg);
  };

  // Cargar lista de usuarios y grupos
  const fetchUsersAndGroups = async () => {
    try {
      setIsLoading(true);

      const [usersRes, groupsRes] = await Promise.all([
        fetch('/api/v1/config/users/', { credentials: 'include' }),
        fetch('/api/v1/config/groups/', { credentials: 'include' }),
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(Array.isArray(usersData) ? usersData : []);
      } else {
        toast.error('No se pudo cargar la lista de usuarios.');
      }

      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        setAllGroups(Array.isArray(groupsData) ? groupsData : []);
      }
    } catch {
      toast.error('Error de conexión al cargar usuarios y grupos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndGroups();
  }, []);

  // Validación de contraseña en tiempo real
  const passwordValidation = useMemo(() => {
    const pwd = formData.password;
    const confirm = formData.confirm_password;
    const fn = formData.first_name.trim().toLowerCase();
    const ln = formData.last_name.trim().toLowerCase();
    const un = formData.username.trim().toLowerCase();
    const em = formData.email.trim().toLowerCase();

    // 1. Longitud mayor de 8 caracteres (> 8 caracteres, es decir mínimo 9)
    const isLengthValid = pwd.length > 8;

    // 2. No solo números (debe contener letras o caracteres especiales)
    const isNotOnlyDigits = pwd.length > 0 && !/^\d+$/.test(pwd);

    // 3. No contener datos personales (nombre, apellido, usuario, correo)
    const pwdLower = pwd.toLowerCase();
    const personalTokens: string[] = [];

    if (un.length >= 3) personalTokens.push(un);
    if (fn.length >= 3) {
      fn.split(/\s+/).forEach((part) => {
        if (part.length >= 3) personalTokens.push(part);
      });
    }
    if (ln.length >= 3) {
      ln.split(/\s+/).forEach((part) => {
        if (part.length >= 3) personalTokens.push(part);
      });
    }
    if (em) {
      const localPart = em.split('@')[0];
      localPart.split(/[._\-+0-9]+/).forEach((part) => {
        if (part.length >= 3) personalTokens.push(part);
      });
    }

    const matchedToken = personalTokens.find((tok) => tok && pwdLower.includes(tok));
    const isNoPersonalInfo = !matchedToken;

    // 4. Coincidencia con confirmación
    const isMatch = Boolean(confirm && pwd === confirm);

    const isStep1Valid =
      Boolean(formData.first_name.trim()) &&
      Boolean(formData.last_name.trim()) &&
      Boolean(formData.username.trim()) &&
      Boolean(formData.email.trim()) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()) &&
      isLengthValid &&
      isNotOnlyDigits &&
      isNoPersonalInfo &&
      isMatch;

    return {
      isLengthValid,
      isNotOnlyDigits,
      isNoPersonalInfo,
      matchedToken,
      isMatch,
      isStep1Valid,
    };
  }, [formData]);

  // Filtrado de usuarios en tabla
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Búsqueda por texto (nombre, apellido, usuario, email)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (u.first_name || '').toLowerCase().includes(q);
        const matchesLast = (u.last_name || '').toLowerCase().includes(q);
        const matchesUser = (u.username || '').toLowerCase().includes(q);
        const matchesMail = (u.email || '').toLowerCase().includes(q);
        if (!matchesName && !matchesLast && !matchesUser && !matchesMail) {
          return false;
        }
      }

      // Filtro por grupo
      if (selectedGroupFilter !== 'all') {
        const gid = parseInt(selectedGroupFilter, 10);
        const hasGroup = u.groups.some((g) => g.id === gid);
        if (!hasGroup) return false;
      }

      // Filtro por estado
      if (selectedStatusFilter === 'active' && !u.is_active) return false;
      if (selectedStatusFilter === 'inactive' && u.is_active) return false;

      return true;
    });
  }, [users, searchQuery, selectedGroupFilter, selectedStatusFilter]);

  // Manejador para abrir modal de creación
  const handleOpenCreateModal = () => {
    setFormData({
      first_name: '',
      last_name: '',
      username: '',
      email: '',
      password: '',
      confirm_password: '',
      assignedGroupIds: [],
    });
    setCreateStep(1);
    setCreateModalError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsCreateModalOpen(true);
  };

  // Manejador para avanzar al paso 2 en creación
  const handleGoToStep2 = () => {
    if (!formData.first_name.trim()) {
      setCreateModalError('El nombre es obligatorio.');
      return;
    }
    if (!formData.last_name.trim()) {
      setCreateModalError('El apellido es obligatorio.');
      return;
    }
    if (!formData.email.trim()) {
      setCreateModalError('El correo electrónico es obligatorio.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setCreateModalError('Ingresa un formato de correo electrónico válido.');
      return;
    }
    if (!formData.username.trim()) {
      setCreateModalError('El nombre de usuario es obligatorio.');
      return;
    }
    if (!passwordValidation.isLengthValid) {
      setCreateModalError('La contraseña debe tener más de 8 caracteres (al menos 9).');
      return;
    }
    if (!passwordValidation.isNotOnlyDigits) {
      setCreateModalError('La contraseña no puede estar compuesta únicamente por números.');
      return;
    }
    if (!passwordValidation.isNoPersonalInfo) {
      setCreateModalError(
        `La contraseña no debe contener datos personales como '${passwordValidation.matchedToken}'.`
      );
      return;
    }
    if (!passwordValidation.isMatch) {
      setCreateModalError('Las contraseñas no coinciden.');
      return;
    }

    setCreateModalError(null);
    setCreateStep(2);
  };

  // Manejador de Drag and Drop para asignar grupo en creación
  const handleDragStart = (e: React.DragEvent, groupId: number) => {
    e.dataTransfer.setData('text/plain', String(groupId));
    setDraggedGroupId(groupId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDropZone(true);
  };

  const handleDragLeave = () => {
    setIsDragOverDropZone(false);
  };

  const handleDropToAssignCreate = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDropZone(false);
    const gidStr = e.dataTransfer.getData('text/plain') || String(draggedGroupId);
    const gid = parseInt(gidStr, 10);
    if (!isNaN(gid) && !formData.assignedGroupIds.includes(gid)) {
      setFormData((prev) => ({
        ...prev,
        assignedGroupIds: [...prev.assignedGroupIds, gid],
      }));
    }
    setDraggedGroupId(null);
  };

  const handleToggleGroupInCreate = (groupId: number) => {
    setFormData((prev) => {
      const exists = prev.assignedGroupIds.includes(groupId);
      return {
        ...prev,
        assignedGroupIds: exists
          ? prev.assignedGroupIds.filter((id) => id !== groupId)
          : [...prev.assignedGroupIds, groupId],
      };
    });
  };

  // Enviar creación de usuario
  const handleSubmitCreateUser = async () => {
    try {
      setIsSubmittingCreate(true);
      setCreateModalError(null);

      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        confirm_password: formData.confirm_password,
        group_ids: formData.assignedGroupIds,
      };

      const response = await fetch('/api/v1/config/users/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (response.ok) {
        showNotification(`Usuario "${resData.username || resData.email}" creado exitosamente.`);
        setIsCreateModalOpen(false);
        fetchUsersAndGroups();
      } else {
        const errorMsg =
          resData.password?.[0] ||
          resData.email?.[0] ||
          resData.username?.[0] ||
          resData.first_name?.[0] ||
          resData.last_name?.[0] ||
          resData.detail ||
          'No se pudo crear el usuario. Revisa los datos ingresados.';
        setCreateModalError(errorMsg);
      }
    } catch {
      setCreateModalError('Error de conexión al guardar el nuevo usuario.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Manejador para abrir modal de edición (SIN contraseña)
  const handleOpenEditModal = (user: ManagedUser) => {
    setEditingUser(user);
    setEditFirstName(user.first_name || '');
    setEditLastName(user.last_name || '');
    setEditIsActive(user.is_active);
    setEditAssignedGroupIds(user.groups.map((g) => g.id));
    setEditModalError(null);
    setIsEditModalOpen(true);
  };

  const handleToggleGroupInEdit = (groupId: number) => {
    setEditAssignedGroupIds((prev) => {
      const exists = prev.includes(groupId);
      return exists ? prev.filter((id) => id !== groupId) : [...prev, groupId];
    });
  };

  const handleDropToAssignEdit = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDropZone(false);
    const gidStr = e.dataTransfer.getData('text/plain') || String(draggedGroupId);
    const gid = parseInt(gidStr, 10);
    if (!isNaN(gid) && !editAssignedGroupIds.includes(gid)) {
      setEditAssignedGroupIds((prev) => [...prev, gid]);
    }
    setDraggedGroupId(null);
  };

  // Enviar edición de usuario (únicamente nombres, apellidos, estado y grupos)
  const handleSubmitEditUser = async () => {
    if (!editingUser) return;
    const cleanFirst = editFirstName.trim();
    const cleanLast = editLastName.trim();

    if (!cleanFirst) {
      setEditModalError('El nombre no puede estar vacío.');
      return;
    }
    if (!cleanLast) {
      setEditModalError('El apellido no puede estar vacío.');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      setEditModalError(null);

      const payload = {
        first_name: cleanFirst,
        last_name: cleanLast,
        is_active: editIsActive,
        group_ids: editAssignedGroupIds,
      };

      const response = await fetch(`/api/v1/config/users/${editingUser.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (response.ok) {
        showNotification(`Usuario "${editingUser.username}" actualizado correctamente.`);
        setIsEditModalOpen(false);
        fetchUsersAndGroups();
      } else {
        const errorMsg =
          resData.first_name?.[0] ||
          resData.last_name?.[0] ||
          resData.detail ||
          'No se pudo actualizar el usuario.';
        setEditModalError(errorMsg);
      }
    } catch {
      setEditModalError('Error de red al actualizar el usuario.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Alternar estado activo / inactivo de un usuario directamente desde la tabla
  const handleToggleActiveDirectly = async (user: ManagedUser) => {
    if (isSelf(user)) {
      toast.warning('Un usuario administrador no puede desactivar su propia cuenta. Solo las de otros.');
      return;
    }

    try {
      setTogglingUserId(user.id);
      const response = await fetch(`/api/v1/config/users/${user.id}/toggle-active/`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();

      if (response.ok) {
        const newStatus = data.user ? data.user.is_active : !user.is_active;
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, is_active: newStatus } : u))
        );
        toast.success(
          `Usuario "${user.username}" ${newStatus ? 'activado' : 'desactivado'} exitosamente.`
        );
      } else {
        toast.error(data.detail || 'No se pudo cambiar el estado del usuario.');
      }
    } catch {
      toast.error('Error al intentar cambiar el estado del usuario.');
    } finally {
      setTogglingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Banner Institucional con botón "+ Nuevo usuario" ── */}
      <div className="relative overflow-hidden rounded-[24px] bg-[#F7A35F] px-8 py-7 shadow-none border border-[#FBB982]/60">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#FBB982]/40 pointer-events-none" />
        <div className="absolute -bottom-16 right-24 w-40 h-40 rounded-full bg-[#FBB982]/30 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-block px-3 py-1 text-[11px] font-bold tracking-wider uppercase rounded-full bg-[#F9E8A0] text-[#5B4A12] mb-3">
              CONFIGURACIÓN — GESTIÓN DE ACCESOS
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-medium text-[#2B3F4C] tracking-tight mb-2">
              Gestión de Usuarios
            </h2>
            <p className="text-sm sm:text-base text-[#1F3340] leading-relaxed">
              Administración de cuentas de usuario, asociación de roles y control de acceso seguro a la plataforma GuiosPro.
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-[14px] bg-[#243642] text-white hover:bg-[#1A262F] font-semibold text-sm transition-all shadow-sm cursor-pointer hover:shadow-md"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Nuevo usuario</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Barra de Controles: Buscador y Filtros ── */}
      <div className="bg-white rounded-[20px] p-5 border border-[#D5ECEC] space-y-4">
        {/* Input Buscador principal */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7FBFC1]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, apellido, usuario o correo electrónico..."
            className="w-full pl-11 pr-4 py-3 bg-[#F6F5F3] border border-[#D5ECEC] rounded-[14px] text-sm text-[#2B3F4C] placeholder-[#4F6170]/60 focus:bg-white focus:outline-none focus:border-[#7FBFC1] transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-[#4F6170] hover:text-[#2B3F4C]"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Fila de Filtros Desplegables */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#D5ECEC]/60">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro por Grupo */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#4F6170]">Grupo:</span>
              <div className="relative">
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="appearance-none bg-[#F6F5F3] border border-[#D5ECEC] rounded-[12px] px-3.5 py-1.5 pr-8 text-xs font-medium text-[#2B3F4C] focus:bg-white focus:outline-none focus:border-[#7FBFC1] transition cursor-pointer"
                >
                  <option value="all">Todos los grupos</option>
                  {allGroups.map((grp) => (
                    <option key={grp.id} value={grp.id}>
                      {grp.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#4F6170]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Filtro por Estado */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#4F6170]">Estado:</span>
              <div className="relative">
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="appearance-none bg-[#F6F5F3] border border-[#D5ECEC] rounded-[12px] px-3.5 py-1.5 pr-8 text-xs font-medium text-[#2B3F4C] focus:bg-white focus:outline-none focus:border-[#7FBFC1] transition cursor-pointer"
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#4F6170]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Contador de resultados */}
            <span className="text-xs text-[#4F6170] ml-2">
              Mostrando <strong className="text-[#2B3F4C]">{filteredUsers.length}</strong> de{' '}
              <strong className="text-[#2B3F4C]">{users.length}</strong> usuarios
            </span>
          </div>

          {/* Botón de refrescar */}
          <button
            type="button"
            onClick={fetchUsersAndGroups}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-white border border-[#D5ECEC] text-xs font-semibold text-[#2B3F4C] hover:bg-[#F6F5F3] transition cursor-pointer disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 text-[#4F6170] ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* ── Tabla de Usuarios ── */}
      <div className="bg-white rounded-[24px] border border-[#D5ECEC] overflow-hidden shadow-none">
        {isLoading && users.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <GuiosProSpinner size="lg" label="Cargando usuarios del sistema..." />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-[14px] bg-[#D5ECEC] flex items-center justify-center text-[#2B3F4C] mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h4 className="text-base font-serif text-[#2B3F4C] font-semibold">No se encontraron usuarios</h4>
            <p className="text-xs text-[#4F6170] mt-1 max-w-sm">
              {searchQuery || selectedGroupFilter !== 'all' || selectedStatusFilter !== 'all'
                ? 'Ningún usuario coincide con los filtros aplicados. Intenta restablecer los parámetros de búsqueda.'
                : 'Aún no hay usuarios registrados. Presiona "+ Nuevo usuario" para dar de alta uno nuevo.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F6F5F3] border-b border-[#D5ECEC] text-[#4F6170] uppercase font-bold tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Nombre (N)</th>
                  <th className="py-3.5 px-4">Apellido (A)</th>
                  <th className="py-3.5 px-4">Usuario</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Grupos</th>
                  <th className="py-3.5 px-4 text-center">Activo</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5ECEC]/60">
                {filteredUsers.map((user) => {
                  const isCurrentToggling = togglingUserId === user.id;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-[#F6F5F3]/70 transition-colors text-[#2B3F4C]"
                    >
                      {/* Nombre */}
                      <td className="py-3.5 px-4 font-semibold">
                        {user.first_name || <span className="text-gray-400 font-normal italic">—</span>}
                      </td>

                      {/* Apellido */}
                      <td className="py-3.5 px-4 font-semibold">
                        {user.last_name || <span className="text-gray-400 font-normal italic">—</span>}
                      </td>

                      {/* Usuario */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#D5ECEC] text-[#16303B] font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                            {user.first_name ? user.first_name[0] : user.username[0]}
                          </div>
                          <span className="font-mono text-xs text-[#16303B]">@{user.username}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#4F6170]">
                        {user.email}
                      </td>

                      {/* Grupos */}
                      <td className="py-3.5 px-4">
                        {user.groups && user.groups.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {user.groups.map((grp) => (
                              <span
                                key={grp.id}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                                  grp.name === 'Administrador'
                                    ? 'bg-[#F9E8A0] text-[#5B4A12] border border-[#F9E8A0]'
                                    : grp.name === 'Decisor'
                                    ? 'bg-[#D5ECEC] text-[#16303B] border border-[#B4D6D6]'
                                    : 'bg-gray-100 text-[#2B3F4C] border border-gray-200'
                                }`}
                              >
                                {grp.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#4F6170]/60 italic">Sin grupo asignado</span>
                        )}
                      </td>

                      {/* Activo (Switch interactivo con protección de cuenta propia) */}
                      <td className="py-3.5 px-4 text-center">
                        {isSelf(user) ? (
                          <div
                            className="inline-flex items-center justify-center"
                            title="Un usuario administrador no puede desactivar su propia cuenta. Solo las de otros."
                          >
                            <span className="relative inline-flex h-5 w-9 shrink-0 opacity-50 cursor-not-allowed rounded-full border-2 border-transparent bg-[#7FBFC1]">
                              <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 translate-x-4" />
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleActiveDirectly(user)}
                            disabled={isCurrentToggling}
                            title={user.is_active ? 'Hacer clic para desactivar' : 'Hacer clic para activar'}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              user.is_active ? 'bg-[#7FBFC1]' : 'bg-gray-300'
                            } ${isCurrentToggling ? 'opacity-50 cursor-wait' : ''}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                user.is_active ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(user)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[10px] bg-white border border-[#D5ECEC] text-xs font-semibold text-[#2B3F4C] hover:bg-[#F6F5F3] hover:border-[#7FBFC1] transition cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5 text-[#4F6170]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                          <span>Editar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: NUEVO USUARIO (WIZARD DE 2 PASOS)                                  */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-[24px] border border-[#D5ECEC] shadow-2xl max-w-xl w-full p-4 sm:p-5.5 space-y-3.5 max-h-[96vh] overflow-y-auto">
            {/* Cabecera del modal */}
            <div className="flex items-center justify-between border-b border-[#D5ECEC]/60 pb-2.5">
              <div>
                <h3 className="text-lg sm:text-xl font-serif text-[#2B3F4C] font-semibold">
                  Nuevo usuario
                </h3>
                <p className="text-xs text-[#4F6170] mt-0.5">
                  {createStep === 1
                    ? 'Paso 1: Completa los datos personales y de acceso del usuario.'
                    : 'Paso 2: Asocia los grupos y roles de seguridad correspondientes.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#F6F5F3] hover:bg-[#D5ECEC] text-[#4F6170] hover:text-[#2B3F4C] flex items-center justify-center transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Barra de progreso de los 2 pasos (Diseño como en el boceto) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold px-1">
                <span className={createStep === 1 ? 'text-[#16303B]' : 'text-[#4F6170]'}>
                  1. Datos personales
                </span>
                <span className={createStep === 2 ? 'text-[#B8531A]' : 'text-[#4F6170]'}>
                  2. Grupos y roles
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 h-2 bg-[#F6F5F3] p-0.5 rounded-full border border-[#D5ECEC]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    createStep === 1 ? 'bg-[#7FBFC1]' : 'bg-[#7FBFC1]'
                  }`}
                />
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    createStep === 2 ? 'bg-[#F7A35F]' : 'bg-transparent'
                  }`}
                />
              </div>
            </div>

            {/* Mensaje de error dentro del modal */}
            {createModalError && (
              <div className="p-2.5 bg-[#B84318]/10 border border-[#B84318]/30 rounded-[12px] text-xs text-[#B84318] flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{createModalError}</span>
              </div>
            )}

            {/* ── PASO 1: DATOS PERSONALES Y CONTRASEÑA ── */}
            {createStep === 1 && (
              <div className="space-y-2.5 sm:space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#2B3F4C] mb-1">
                      Nombre <span className="text-[#B84318]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="Ej. Valeria"
                      className="w-full px-3 py-2 bg-[#F6F5F3] border border-[#D5ECEC] rounded-[10px] text-xs text-[#2B3F4C] focus:bg-white focus:outline-none focus:border-[#7FBFC1] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2B3F4C] mb-1">
                      Apellido <span className="text-[#B84318]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Ej. Rios"
                      className="w-full px-3 py-2 bg-[#F6F5F3] border border-[#D5ECEC] rounded-[10px] text-xs text-[#2B3F4C] focus:bg-white focus:outline-none focus:border-[#7FBFC1] transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#2B3F4C] mb-1">
                      Email <span className="text-[#B84318]">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="valeria.rios@empresa.com"
                      className="w-full px-3 py-2 bg-[#F6F5F3] border border-[#D5ECEC] rounded-[10px] text-xs text-[#2B3F4C] focus:bg-white focus:outline-none focus:border-[#7FBFC1] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2B3F4C] mb-1">
                      Usuario <span className="text-[#B84318]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="vrios"
                      className="w-full px-3 py-2 bg-[#F6F5F3] border border-[#D5ECEC] rounded-[10px] text-xs text-[#2B3F4C] focus:bg-white focus:outline-none focus:border-[#7FBFC1] transition"
                    />
                  </div>
                </div>

                {/* Contraseña y Confirmación */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1.5 border-t border-[#D5ECEC]/60">
                  <div>
                    <label className="block text-xs font-semibold text-[#2B3F4C] mb-1">
                      Contraseña <span className="text-[#B84318]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Mínimo 9 caracteres"
                        className="w-full px-3 py-2 pr-9 bg-[#F6F5F3] border border-[#D5ECEC] rounded-[10px] text-xs text-[#2B3F4C] focus:bg-white focus:outline-none focus:border-[#7FBFC1] transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#4F6170] hover:text-[#2B3F4C]"
                      >
                        {showPassword ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#2B3F4C] mb-1">
                      Confirmar contraseña <span className="text-[#B84318]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirm_password}
                        onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                        placeholder="Repite la contraseña"
                        className="w-full px-3 py-2 pr-9 bg-[#F6F5F3] border border-[#D5ECEC] rounded-[10px] text-xs text-[#2B3F4C] focus:bg-white focus:outline-none focus:border-[#7FBFC1] transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#4F6170] hover:text-[#2B3F4C]"
                      >
                        {showConfirmPassword ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Checklist interactivo de requisitos de contraseña ── */}
                <div className="p-2.5 bg-[#F6F5F3] rounded-[12px] border border-[#D5ECEC] space-y-1">
                  <div className="text-[10px] font-bold text-[#2B3F4C] uppercase tracking-wider mb-0.5">
                    Requisitos de seguridad de contraseña:
                  </div>

                  {/* Regla 1: Longitud */}
                  <div className="flex items-center gap-2 text-[11px]">
                    {passwordValidation.isLengthValid ? (
                      <span className="w-3.5 h-3.5 rounded-full bg-[#1F7A4D]/20 text-[#1F7A4D] flex items-center justify-center font-bold text-[9px] shrink-0">
                        ✓
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-[#4F6170] flex items-center justify-center font-bold text-[9px] shrink-0">
                        •
                      </span>
                    )}
                    <span className={passwordValidation.isLengthValid ? 'text-[#1F7A4D] font-medium' : 'text-[#4F6170]'}>
                      Mayor de 8 caracteres (mínimo 9 caracteres)
                    </span>
                  </div>

                  {/* Regla 2: No solo números */}
                  <div className="flex items-center gap-2 text-[11px]">
                    {passwordValidation.isNotOnlyDigits ? (
                      <span className="w-3.5 h-3.5 rounded-full bg-[#1F7A4D]/20 text-[#1F7A4D] flex items-center justify-center font-bold text-[9px] shrink-0">
                        ✓
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-[#4F6170] flex items-center justify-center font-bold text-[9px] shrink-0">
                        •
                      </span>
                    )}
                    <span className={passwordValidation.isNotOnlyDigits ? 'text-[#1F7A4D] font-medium' : 'text-[#4F6170]'}>
                      No puede ser solo números (debe contener letras o símbolos)
                    </span>
                  </div>

                  {/* Regla 3: Sin datos personales */}
                  <div className="flex items-center gap-2 text-[11px]">
                    {passwordValidation.isNoPersonalInfo ? (
                      <span className="w-3.5 h-3.5 rounded-full bg-[#1F7A4D]/20 text-[#1F7A4D] flex items-center justify-center font-bold text-[9px] shrink-0">
                        ✓
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full bg-[#B84318]/20 text-[#B84318] flex items-center justify-center font-bold text-[9px] shrink-0">
                        ✕
                      </span>
                    )}
                    <span className={passwordValidation.isNoPersonalInfo ? 'text-[#1F7A4D] font-medium' : 'text-[#B84318] font-semibold'}>
                      {passwordValidation.isNoPersonalInfo
                        ? 'No contiene tu nombre, apellido, usuario o correo'
                        : `No debe incluir tu información personal (coincide con "${passwordValidation.matchedToken}")`}
                    </span>
                  </div>

                  {/* Regla 4: Coincidencia */}
                  <div className="flex items-center gap-2 text-[11px]">
                    {passwordValidation.isMatch ? (
                      <span className="w-3.5 h-3.5 rounded-full bg-[#1F7A4D]/20 text-[#1F7A4D] flex items-center justify-center font-bold text-[9px] shrink-0">
                        ✓
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-[#4F6170] flex items-center justify-center font-bold text-[9px] shrink-0">
                        •
                      </span>
                    )}
                    <span className={passwordValidation.isMatch ? 'text-[#1F7A4D] font-medium' : 'text-[#4F6170]'}>
                      Las dos contraseñas deben coincidir exactamente
                    </span>
                  </div>
                </div>

                {/* Botones pie de paso 1 */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D5ECEC]/60">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-3.5 py-2 rounded-[10px] bg-white border border-[#D5ECEC] text-xs font-semibold text-[#4F6170] hover:bg-[#F6F5F3] transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleGoToStep2}
                    className="px-4 py-2 rounded-[10px] bg-[#243642] text-white font-semibold text-xs hover:bg-[#1A262F] transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Siguiente</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* ── PASO 2: GRUPOS (ARRASTRAR Y SOLTAR) ── */}
            {createStep === 2 && (
              <div className="space-y-3">
                <p className="text-xs text-[#4F6170]">
                  Arrastra los grupos disponibles hacia la derecha para asociarlos al usuario, o haz clic en{' '}
                  <strong className="text-[#2B3F4C]">+</strong> para transferirlos.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Columna Izquierda: Grupos disponibles */}
                  <div className="bg-[#F6F5F3] rounded-[16px] p-3 border border-[#D5ECEC] flex flex-col h-[210px] sm:h-[220px]">
                    <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-[#D5ECEC]/60">
                      <span className="text-xs font-bold text-[#2B3F4C]">
                        Grupos disponibles (
                        {allGroups.filter((g) => !formData.assignedGroupIds.includes(g.id)).length})
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                      {allGroups
                        .filter((g) => !formData.assignedGroupIds.includes(g.id))
                        .map((group) => (
                          <div
                            key={group.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, group.id)}
                            className="bg-white rounded-[10px] p-2 border border-[#D5ECEC] flex items-center justify-between hover:border-[#7FBFC1] transition shadow-2xs cursor-grab active:cursor-grabbing group"
                          >
                            <div className="flex items-center gap-2">
                              {/* Grip handle ::: */}
                              <div className="text-gray-300 group-hover:text-[#7FBFC1] select-none text-xs font-mono">
                                :::
                              </div>
                              <span className="text-xs font-semibold text-[#2B3F4C]">{group.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleGroupInCreate(group.id)}
                              title="Asignar grupo"
                              className="w-5 h-5 rounded-full bg-[#D5ECEC] hover:bg-[#7FBFC1] text-[#16303B] flex items-center justify-center text-xs font-bold transition cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        ))}

                      {allGroups.filter((g) => !formData.assignedGroupIds.includes(g.id)).length === 0 && (
                        <div className="h-full flex items-center justify-center text-center p-3">
                          <p className="text-[11px] text-[#4F6170] italic">
                            Todos los grupos han sido asignados.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Columna Derecha: Zona de soltado (Grupos asignados) */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDropToAssignCreate}
                    className={`rounded-[16px] p-3 border-2 flex flex-col h-[210px] sm:h-[220px] transition-all ${
                      isDragOverDropZone
                        ? 'border-[#7FBFC1] bg-[#D5ECEC]/30'
                        : 'border-dashed border-[#B4D6D6] bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-[#D5ECEC]/60">
                      <span className="text-xs font-bold text-[#2B3F4C]">
                        Grupos asignados ({formData.assignedGroupIds.length})
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                      {formData.assignedGroupIds.map((gid) => {
                        const groupObj = allGroups.find((g) => g.id === gid);
                        if (!groupObj) return null;
                        return (
                          <div
                            key={groupObj.id}
                            className="bg-[#D5ECEC]/40 rounded-[10px] p-2 border border-[#7FBFC1]/50 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#7FBFC1]" />
                              <span className="font-semibold text-[#16303B]">{groupObj.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleGroupInCreate(groupObj.id)}
                              title="Quitar grupo"
                              className="w-5 h-5 rounded-full hover:bg-[#B84318]/20 text-[#B84318] flex items-center justify-center text-xs font-bold transition cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}

                      {formData.assignedGroupIds.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-3">
                          <svg className="w-7 h-7 text-[#7FBFC1] mb-1.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <p className="text-xs font-serif text-[#2B3F4C] font-semibold">
                            Arrastre los grupos aquí
                          </p>
                          <p className="text-[10px] text-[#4F6170] mt-0.5">
                            O haz clic en el botón '+' del grupo deseado
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botones pie de paso 2 */}
                <div className="flex items-center justify-between pt-2.5 border-t border-[#D5ECEC]/60">
                  <button
                    type="button"
                    onClick={() => setCreateStep(1)}
                    className="px-4 py-2.5 rounded-[12px] bg-white border border-[#D5ECEC] text-xs font-semibold text-[#4F6170] hover:bg-[#F6F5F3] transition cursor-pointer flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    <span>Atrás</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="px-4 py-2.5 rounded-[12px] bg-white border border-[#D5ECEC] text-xs font-semibold text-[#4F6170] hover:bg-[#F6F5F3] transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitCreateUser}
                      disabled={isSubmittingCreate}
                      className="px-5 py-2.5 rounded-[12px] bg-[#243642] text-white font-semibold text-xs hover:bg-[#1A262F] transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {isSubmittingCreate && (
                        <GuiosProSpinner size="xs" />
                      )}
                      <span>Crear usuario</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: EDITAR USUARIO (SIN CONTRASEÑAS, SOLO NOMBRES, ESTADO Y GRUPOS)     */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-[24px] border border-[#D5ECEC] shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-[#D5ECEC]/60 pb-3">
              <div>
                <h3 className="text-xl sm:text-2xl font-serif text-[#2B3F4C] font-semibold">
                  Editar usuario
                </h3>
                <p className="text-xs text-[#4F6170] mt-0.5">
                  Modifica nombres, apellidos, estado de acceso y grupos asignados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F6F5F3] hover:bg-[#D5ECEC] text-[#4F6170] hover:text-[#2B3F4C] flex items-center justify-center transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Error si ocurre */}
            {editModalError && (
              <div className="p-3 bg-[#B84318]/10 border border-[#B84318]/30 rounded-[12px] text-xs text-[#B84318] flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{editModalError}</span>
              </div>
            )}

            {/* Ficha informativa de solo lectura (Usuario y Correo protegidos) */}
            <div className="p-3.5 bg-[#F6F5F3] rounded-[14px] border border-[#D5ECEC] grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[10px] font-bold text-[#4F6170] uppercase tracking-wider">
                  Usuario
                </span>
                <span className="text-xs font-mono font-semibold text-[#16303B]">
                  @{editingUser.username}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-[#4F6170] uppercase tracking-wider">
                  Correo Electrónico
                </span>
                <span className="text-xs font-mono text-[#4F6170] truncate block">
                  {editingUser.email}
                </span>
              </div>
            </div>

            {/* Campos Editables */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#2B3F4C] mb-1">
                    Nombre <span className="text-[#B84318]">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F5F3] border border-[#D5ECEC] rounded-[12px] text-xs text-[#2B3F4C] focus:bg-white focus:outline-none focus:border-[#7FBFC1] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2B3F4C] mb-1">
                    Apellido <span className="text-[#B84318]">*</span>
                  </label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F5F3] border border-[#D5ECEC] rounded-[12px] text-xs text-[#2B3F4C] focus:bg-white focus:outline-none focus:border-[#7FBFC1] transition"
                  />
                </div>
              </div>

              {/* Interruptor de Estado Activo */}
              <div className="flex items-center justify-between p-3 bg-white rounded-[14px] border border-[#D5ECEC]">
                <div>
                  <h4 className="text-xs font-semibold text-[#2B3F4C]">Estado de la cuenta</h4>
                  <p className="text-[11px] text-[#4F6170]">
                    {isSelf(editingUser)
                      ? 'No puedes desactivar tu propia cuenta de administrador.'
                      : editIsActive
                      ? 'El usuario tiene acceso activo al sistema.'
                      : 'El usuario está temporalmente deshabilitado.'}
                  </p>
                </div>
                {isSelf(editingUser) ? (
                  <div
                    className="relative inline-flex h-5 w-9 shrink-0 opacity-50 cursor-not-allowed rounded-full border-2 border-transparent bg-[#7FBFC1]"
                    title="No puedes desactivar tu propia cuenta"
                  >
                    <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 translate-x-4" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditIsActive(!editIsActive)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editIsActive ? 'bg-[#7FBFC1]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editIsActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* Asignación y gestión de grupos (Arrastrar o seleccionar) */}
              <div className="space-y-2 pt-2 border-t border-[#D5ECEC]/60">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#2B3F4C]">
                    Asignación de Grupos ({editAssignedGroupIds.length})
                  </label>
                  <span className="text-[11px] text-[#4F6170]">Arrastra o usa '+' y '✕'</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Grupos disponibles */}
                  <div className="bg-[#F6F5F3] rounded-[14px] p-3 border border-[#D5ECEC] h-[190px] flex flex-col">
                    <span className="text-[11px] font-bold text-[#4F6170] uppercase tracking-wider mb-2">
                      Disponibles
                    </span>
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                      {allGroups
                        .filter((g) => !editAssignedGroupIds.includes(g.id))
                        .map((grp) => (
                          <div
                            key={grp.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, grp.id)}
                            className="bg-white rounded-[10px] p-2 border border-[#D5ECEC] flex items-center justify-between text-xs cursor-grab active:cursor-grabbing hover:border-[#7FBFC1]"
                          >
                            <span className="font-medium text-[#2B3F4C]">{grp.name}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleGroupInEdit(grp.id)}
                              className="w-5 h-5 rounded-full bg-[#D5ECEC] hover:bg-[#7FBFC1] text-[#16303B] flex items-center justify-center font-bold text-[11px]"
                            >
                              +
                            </button>
                          </div>
                        ))}
                      {allGroups.filter((g) => !editAssignedGroupIds.includes(g.id)).length === 0 && (
                        <p className="text-[10px] text-[#4F6170] italic text-center pt-8">
                          Todos asignados
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Grupos asignados (Zona de soltado) */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDropToAssignEdit}
                    className={`rounded-[14px] p-3 border-2 h-[190px] flex flex-col transition ${
                      isDragOverDropZone ? 'border-[#7FBFC1] bg-[#D5ECEC]/30' : 'border-[#B4D6D6] bg-white'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-[#16303B] uppercase tracking-wider mb-2">
                      Asignados
                    </span>
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                      {editAssignedGroupIds.map((gid) => {
                        const grp = allGroups.find((g) => g.id === gid);
                        if (!grp) return null;
                        return (
                          <div
                            key={grp.id}
                            className="bg-[#D5ECEC]/40 rounded-[10px] p-2 border border-[#7FBFC1]/40 flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-[#16303B]">{grp.name}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleGroupInEdit(grp.id)}
                              className="w-5 h-5 rounded-full text-[#B84318] hover:bg-[#B84318]/20 flex items-center justify-center font-bold text-[11px]"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                      {editAssignedGroupIds.length === 0 && (
                        <p className="text-[10px] text-[#4F6170] italic text-center pt-8">
                          Sin grupos asignados. Arrastra aquí.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie del modal de edición */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D5ECEC]/60">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2.5 rounded-[12px] bg-white border border-[#D5ECEC] text-xs font-semibold text-[#4F6170] hover:bg-[#F6F5F3] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitEditUser}
                disabled={isSubmittingEdit}
                className="px-5 py-2.5 rounded-[12px] bg-[#243642] text-white font-semibold text-xs hover:bg-[#1A262F] transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSubmittingEdit && (
                  <GuiosProSpinner size="xs" />
                )}
                <span>Guardar cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
