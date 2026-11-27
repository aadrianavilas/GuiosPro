import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/navigation/Sidebar';
import { OrganizationEditView } from '@/pages/organization/OrganizationEditView';
import { CreateEvaluationView } from '@/pages/evaluations/CreateEvaluationView';
import { EvaluationHistoryView } from '@/pages/evaluations/EvaluationHistoryView';
import { ModulesManagementView } from '@/pages/config/ModulesManagementView';
import { GroupsManagementView } from '@/pages/config/GroupsManagementView';
import { UsersManagementView } from '@/pages/config/UsersManagementView';
import { DimensionsManagementView } from '@/pages/methodology/DimensionsManagementView';
import { ScalesManagementView } from '@/pages/methodology/ScalesManagementView';
import { ScopesManagementView } from '@/pages/methodology/ScopesManagementView';
import { RecommendationsManagementView } from '@/pages/methodology/RecommendationsManagementView';
import { AiCitationsManagementView } from '@/pages/methodology/AiCitationsManagementView';
import { ProfileView } from '@/pages/profile/ProfileView';
import { InProgressEvaluationsSection } from '@/components/dashboard/InProgressEvaluationsSection';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';
import type { NavigationModule } from '@/types';
import { logoutUser } from '@/utils/authClient';
import { useInactivityTimer } from '@/utils/useInactivityTimer';

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Temporizador de 10 minutos de inactividad
  useInactivityTimer(true);

  // Estado reactivo del usuario con datos sincronizados desde localStorage y backend
  const [userData, setUserData] = useState<{
    id?: number;
    firstName: string;
    role: string;
    avatar?: string | null;
    groups: string[];
  }>(() => {
    const userStr = localStorage.getItem('guiospro_user');
    const u = userStr ? JSON.parse(userStr) : null;
    const activeGroupStored = localStorage.getItem('guiospro_active_group');
    const rawGroups = Array.isArray(u?.groups) ? u.groups : [];
    const role = activeGroupStored || u?.role || (rawGroups[0] ?? 'Decisor');
    return {
      id: u?.id,
      firstName: u?.firstName || 'Usuario',
      role,
      avatar: u?.avatar || null,
      groups: rawGroups.length > 0 ? rawGroups : [role],
    };
  });

  const [activeGroup, setActiveGroup] = useState<string>(() => {
    return localStorage.getItem('guiospro_active_group') || userData.role;
  });

  const handleChangeGroup = (newGroup: string) => {
    localStorage.setItem('guiospro_active_group', newGroup);
    setActiveGroup(newGroup);
    setUserData((prev) => ({
      ...prev,
      role: newGroup,
    }));
    window.dispatchEvent(new CustomEvent('guiospro_modules_updated'));
    navigate('/dashboard');
  };

  const userName = userData.firstName;
  const userRole = activeGroup || userData.role;
  const userAvatar = userData.avatar;
  const isAdmin = userRole === 'Administrador';

  // Opciones predeterminadas según el rol para evitar pantallas vacías durante la carga inicial
  const fallbackModules: NavigationModule[] = isAdmin
    ? [
        {
          id: 1,
          name: 'Panel',
          icon: 'HomeIcon',
          order: 1,
          options: [
            { id: 1, name: 'Panel principal', path: '/dashboard', icon: 'HomeIcon', order: 1 }
          ]
        },
        {
          id: 4,
          name: 'Usuario',
          icon: 'UserCircleIcon',
          order: 4,
          options: [
            { id: 5, name: 'Perfil', path: '/profile', icon: 'UserCircleIcon', order: 1 }
          ]
        },
        {
          id: 5,
          name: 'Configuración',
          icon: 'CogIcon',
          order: 6,
          options: [
            { id: 6, name: 'Módulo', path: '/config/modules', icon: 'Squares2X2Icon', order: 1 },
            { id: 7, name: 'Grupo', path: '/config/groups', icon: 'ShieldCheckIcon', order: 2 },
            { id: 8, name: 'Usuarios', path: '/config/users', icon: 'UsersIcon', order: 3 }
          ]
        }
      ]
    : [
        {
          id: 1,
          name: 'Panel',
          icon: 'HomeIcon',
          order: 1,
          options: [
            { id: 1, name: 'Panel principal', path: '/dashboard', icon: 'HomeIcon', order: 1 }
          ]
        },
        {
          id: 2,
          name: 'Organización',
          icon: 'BuildingOfficeIcon',
          order: 2,
          options: [
            { id: 2, name: 'Organización', path: '/organization', icon: 'BuildingOfficeIcon', order: 1 }
          ]
        },
        {
          id: 3,
          name: 'Evaluación',
          icon: 'ClipboardDocumentListIcon',
          order: 3,
          options: [
            { id: 3, name: 'Crear evaluación', path: '/evaluations/new', icon: 'PlusCircleIcon', order: 1 },
            { id: 4, name: 'Historial', path: '/evaluations/history', icon: 'ClockIcon', order: 2 }
          ]
        },
        {
          id: 4,
          name: 'Usuario',
          icon: 'UserCircleIcon',
          order: 4,
          options: [
            { id: 5, name: 'Perfil', path: '/profile', icon: 'UserCircleIcon', order: 1 }
          ]
        }
      ];

  const [modules, setModules] = useState<NavigationModule[]>(fallbackModules);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [navigationLoaded, setNavigationLoaded] = useState<boolean>(false);

  // Sincronizar perfil de usuario al montar y ante cambios del perfil
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/v1/auth/profile/', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            const u = data.user;
            const rawGroups = Array.isArray(u.groups) ? u.groups : [];
            const isAdminRole = Boolean(
              u.role === 'Administrador' ||
              u.is_superuser ||
              u.is_staff ||
              rawGroups.includes('Administrador')
            );
            const role = isAdminRole ? 'Administrador' : (u.role || rawGroups[0] || 'Decisor');
            const updated = {
              id: u.id,
              firstName: u.first_name || 'Usuario',
              role,
              avatar: u.avatar || null,
              groups: rawGroups.length > 0 ? rawGroups : [role],
            };
            setUserData(updated);
            const userStr = localStorage.getItem('guiospro_user');
            const existing = userStr ? JSON.parse(userStr) : {};
            localStorage.setItem('guiospro_user', JSON.stringify({ ...existing, ...updated }));
          }
        }
      } catch {
        // Fallback silencioso en caso de desconexión momentánea
      }
    };

    loadProfile();

    const handleUserUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const u = customEvent.detail;
        const rawGroups = Array.isArray(u.groups) ? u.groups : [];
        const isAdminRole = Boolean(
          u.role === 'Administrador' ||
          u.is_superuser ||
          u.is_staff ||
          rawGroups.includes('Administrador')
        );
        const role = isAdminRole ? 'Administrador' : (u.role || rawGroups[0] || 'Decisor');
        setUserData({
          id: u.id,
          firstName: u.first_name || 'Usuario',
          role,
          avatar: u.avatar || null,
          groups: rawGroups.length > 0 ? rawGroups : [role],
        });
      }
    };

    window.addEventListener('guiospro_user_updated', handleUserUpdated);
    return () => {
      window.removeEventListener('guiospro_user_updated', handleUserUpdated);
    };
  }, []);

  // Determinar si la ruta actual corresponde a la administración de módulos
  const isModulesConfigView =
    location.pathname === '/config/modules' ||
    location.pathname === '/config/modulos' ||
    location.pathname === '/dashboard/config/modules';

  // Determinar si la ruta actual corresponde a la administración de grupos
  const isGroupsConfigView =
    location.pathname === '/config/groups' ||
    location.pathname === '/config/grupos' ||
    location.pathname === '/dashboard/config/groups';

  // Determinar si la ruta actual corresponde a la administración de usuarios
  const isUsersConfigView =
    location.pathname === '/config/users' ||
    location.pathname === '/config/usuarios' ||
    location.pathname === '/dashboard/config/users';

  // Determinar si la ruta actual corresponde a la administración metodológica de dimensiones
  const isDimensionsMethodologyView =
    location.pathname === '/methodology/dimensions' ||
    location.pathname === '/methodology/dimensiones' ||
    location.pathname === '/dashboard/methodology/dimensions';

  // Determinar si la ruta actual corresponde a la administración metodológica de escalas
  const isScalesMethodologyView =
    location.pathname === '/methodology/scales' ||
    location.pathname === '/methodology/escalas' ||
    location.pathname === '/dashboard/methodology/scales';

  // Determinar si la ruta actual corresponde a la administración metodológica de alcances
  const isScopesMethodologyView =
    location.pathname === '/methodology/scopes' ||
    location.pathname === '/methodology/alcances' ||
    location.pathname === '/methodology/alcance' ||
    location.pathname === '/dashboard/methodology/scopes';

  // Determinar si la ruta actual corresponde a las recomendaciones oficiales
  const isRecommendationsMethodologyView =
    location.pathname === '/methodology/recommendations' ||
    location.pathname === '/methodology/recomendaciones' ||
    location.pathname === '/dashboard/methodology/recommendations';

  // Determinar si la ruta actual corresponde a las consultas de total de citas con IA
  const isAiCitationsMethodologyView =
    location.pathname === '/methodology/ai-citations' ||
    location.pathname === '/methodology/total-citas-ia' ||
    location.pathname === '/dashboard/methodology/ai-citations';

  // Determinar si la ruta actual corresponde a la vista de historial
  const isHistoryView =
    location.pathname === '/evaluations/history' ||
    location.pathname === '/dashboard/evaluations/history' ||
    location.pathname === '/evaluaciones/historial';

  // Determinar si la ruta actual corresponde a la vista de creación o flujo de evaluación
  const isEvaluationView =
    !isHistoryView && (
      location.pathname === '/evaluaciones/nueva' ||
      location.pathname === '/evaluations/new' ||
      location.pathname.startsWith('/evaluaciones/') ||
      location.pathname.startsWith('/evaluations/')
    );

  // Normalización automática de URLs: solo el dashboard principal usa /dashboard.
  // Cualquier ruta secundaria con /dashboard/... se redirige a su ruta directa limpia.
  useEffect(() => {
    if (location.pathname.startsWith('/dashboard/') && location.pathname !== '/dashboard') {
      const cleanPath = location.pathname.replace('/dashboard/', '/');
      if (cleanPath === 'evaluations/new' || cleanPath === 'evaluaciones/nueva' || cleanPath === '/evaluations/new') {
        navigate('/evaluaciones/nueva', { replace: true, state: location.state });
      } else {
        navigate(cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`, { replace: true, state: location.state });
      }
    } else if (location.pathname === '/evaluations/new') {
      navigate('/evaluaciones/nueva', { replace: true, state: location.state });
    } else if (location.pathname === '/config/modulos') {
      navigate('/config/modules', { replace: true });
    } else if (location.pathname === '/config/grupos') {
      navigate('/config/groups', { replace: true });
    } else if (location.pathname === '/config/usuarios') {
      navigate('/config/users', { replace: true });
    } else if (location.pathname === '/methodology/escalas') {
      navigate('/methodology/scales', { replace: true });
    } else if (location.pathname === '/methodology/alcances' || location.pathname === '/methodology/alcance') {
      navigate('/methodology/scopes', { replace: true });
    } else if (location.pathname === '/methodology/recomendaciones') {
      navigate('/methodology/recommendations', { replace: true });
    } else if (location.pathname === '/methodology/total-citas-ia') {
      navigate('/methodology/ai-citations', { replace: true });
    } else if (
      location.pathname === '/methodology/factors' ||
      location.pathname === '/methodology/factores' ||
      location.pathname === '/methodology/subfactors' ||
      location.pathname === '/methodology/subfactores' ||
      location.pathname === '/methodology/dimensiones'
    ) {
      navigate('/methodology/dimensions', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Opciones activas en la base de datos para el usuario actual (derivadas de modules)
  const isNewEvaluationActive = useMemo(() => {
    return modules.some((m) =>
      (m.options || []).some(
        (o) => o.path === '/evaluations/new' || o.path === '/evaluaciones/nueva'
      )
    );
  }, [modules]);

  const isOrganizationActive = useMemo(() => {
    return modules.some((m) =>
      (m.options || []).some((o) => o.path === '/organization')
    );
  }, [modules]);

  const isHistoryActive = useMemo(() => {
    return modules.some((m) =>
      (m.options || []).some(
        (o) => o.path === '/evaluations/history' || o.path === '/evaluaciones/historial'
      )
    );
  }, [modules]);

  const isModulesActive = useMemo(() => {
    return modules.some((m) =>
      (m.options || []).some((o) => o.path === '/config/modules' || o.path === '/config/modulos')
    );
  }, [modules]);

  const isGroupsActive = useMemo(() => {
    return modules.some((m) =>
      (m.options || []).some((o) => o.path === '/config/groups' || o.path === '/config/grupos')
    );
  }, [modules]);

  // Conjunto dinámico de rutas permitidas según las opciones asignadas al usuario en la BD
  const allowedPaths = useMemo(() => {
    const paths = new Set<string>(['/dashboard', '/']);
    modules.forEach((mod) => {
      (mod.options || []).forEach((opt) => {
        if (opt.path) {
          const raw = opt.path.trim();
          const clean = raw.endsWith('/') && raw.length > 1 ? raw.slice(0, -1) : raw;
          paths.add(clean);
          paths.add(`${clean}/`);

          // Mapeo exhaustivo de alias bidireccionales
          if (clean === '/evaluations/new' || clean === '/evaluaciones/nueva') {
            paths.add('/evaluations/new');
            paths.add('/evaluaciones/nueva');
          }
          if (clean === '/evaluations/history' || clean === '/evaluaciones/historial') {
            paths.add('/evaluations/history');
            paths.add('/evaluaciones/historial');
          }
          if (clean === '/config/modules' || clean === '/config/modulos') {
            paths.add('/config/modules');
            paths.add('/config/modulos');
          }
          if (clean === '/config/groups' || clean === '/config/grupos') {
            paths.add('/config/groups');
            paths.add('/config/grupos');
          }
          if (clean === '/config/users' || clean === '/config/usuarios') {
            paths.add('/config/users');
            paths.add('/config/usuarios');
          }
          if (clean === '/methodology/dimensions' || clean === '/methodology/dimensiones') {
            paths.add('/methodology/dimensions');
            paths.add('/methodology/dimensiones');
          }
          if (clean === '/methodology/scales' || clean === '/methodology/escalas') {
            paths.add('/methodology/scales');
            paths.add('/methodology/escalas');
          }
          if (clean === '/methodology/scopes' || clean === '/methodology/alcances' || clean === '/methodology/alcance') {
            paths.add('/methodology/scopes');
            paths.add('/methodology/alcances');
            paths.add('/methodology/alcance');
          }
          if (clean === '/methodology/recommendations' || clean === '/methodology/recomendaciones') {
            paths.add('/methodology/recommendations');
            paths.add('/methodology/recomendaciones');
          }
          if (clean === '/methodology/ai-citations' || clean === '/methodology/total-citas-ia') {
            paths.add('/methodology/ai-citations');
            paths.add('/methodology/total-citas-ia');
          }
        }
      });
    });
    return paths;
  }, [modules]);

  // Protección estricta de rutas por rol y por opciones activas consultadas en la base de datos
  useEffect(() => {
    // Esperar a que la navegación haya sido consultada desde la base de datos
    if (!navigationLoaded) {
      return;
    }

    const currentPath =
      location.pathname.endsWith('/') && location.pathname.length > 1
        ? location.pathname.slice(0, -1)
        : location.pathname;

    if (isAdmin) {
      // Al Administrador se le bloquea estrictamente Organización y Evaluaciones (regla de negocio inviolable)
      if (currentPath === '/organization' || isEvaluationView || isHistoryView) {
        navigate('/dashboard', { replace: true });
        return;
      }
    }

    // Para cualquier usuario autenticado, el dashboard principal siempre está disponible
    if (currentPath === '/dashboard' || currentPath === '') {
      return;
    }

    // Comprobación de acceso dinámico para CUALQUIER opción del sistema:
    // 1. Coincidencia directa de la ruta en las opciones activas del usuario (Organización, Perfil, Módulos, Grupos, Metodología, etc.)
    // 2. O subrutas del flujo de creación de evaluaciones (si tiene la opción 'Crear evaluación' activa)
    // 3. O subrutas del historial de evaluaciones (si tiene la opción 'Historial' activa)
    // 4. O vistas de administración de módulos, grupos o dimensiones metodológicas
    const isAllowed =
      allowedPaths.has(currentPath) ||
      (isEvaluationView && (allowedPaths.has('/evaluaciones/nueva') || allowedPaths.has('/evaluations/new'))) ||
      (isHistoryView && (allowedPaths.has('/evaluations/history') || allowedPaths.has('/evaluaciones/historial'))) ||
      (isModulesConfigView && (allowedPaths.has('/config/modules') || allowedPaths.has('/config/modulos'))) ||
      (isGroupsConfigView && (allowedPaths.has('/config/groups') || allowedPaths.has('/config/grupos'))) ||
      (isUsersConfigView && (allowedPaths.has('/config/users') || allowedPaths.has('/config/usuarios'))) ||
      (isDimensionsMethodologyView && (allowedPaths.has('/methodology/dimensions') || allowedPaths.has('/methodology/dimensiones'))) ||
      (isScalesMethodologyView && (allowedPaths.has('/methodology/scales') || allowedPaths.has('/methodology/escalas'))) ||
      (isScopesMethodologyView && (allowedPaths.has('/methodology/scopes') || allowedPaths.has('/methodology/alcances') || allowedPaths.has('/methodology/alcance'))) ||
      (isRecommendationsMethodologyView && (allowedPaths.has('/methodology/recommendations') || allowedPaths.has('/methodology/recomendaciones'))) ||
      (isAiCitationsMethodologyView && (allowedPaths.has('/methodology/ai-citations') || allowedPaths.has('/methodology/total-citas-ia')));

    if (!isAllowed) {
      navigate('/dashboard', { replace: true });
    }
  }, [
    navigationLoaded,
    isAdmin,
    location.pathname,
    allowedPaths,
    isModulesConfigView,
    isGroupsConfigView,
    isUsersConfigView,
    isDimensionsMethodologyView,
    isScalesMethodologyView,
    isScopesMethodologyView,
    isRecommendationsMethodologyView,
    isAiCitationsMethodologyView,
    isEvaluationView,
    isHistoryView,
    navigate,
  ]);

  // Cargar módulos y opciones exclusivamente desde la base de datos (RBAC) con reintento suave si el backend arranca
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchNavigation = async (attempt = 1) => {
      try {
        const response = await fetch('/api/v1/navigation/modules/', {
          credentials: 'include',
          headers: {
            'X-Active-Group': activeGroup,
          },
        });
        if (response.ok) {
          const data: NavigationModule[] = await response.json();
          if (Array.isArray(data)) {
            setModules(data);
          }
        } else if (attempt < 3) {
          retryTimer = setTimeout(() => fetchNavigation(attempt + 1), 1500);
        }
      } catch (err) {
        if (attempt < 3) {
          retryTimer = setTimeout(() => fetchNavigation(attempt + 1), 1500);
        }
      } finally {
        setIsLoading(false);
        setNavigationLoaded(true);
      }
    };

    fetchNavigation();

    const handleModulesUpdated = () => {
      fetchNavigation(1);
    };

    window.addEventListener('guiospro_modules_updated', handleModulesUpdated);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('guiospro_modules_updated', handleModulesUpdated);
    };
  }, [userRole, activeGroup]);

  const handleLogout = async () => {
    await logoutUser('user_manual');
  };

  // Encontrar opción y módulo actual según la URL
  let currentOptionName = 'Panel principal';
  let currentModuleName = 'Dashboard';

  if (isModulesConfigView) {
    currentOptionName = 'Módulo';
    currentModuleName = 'Configuración';
  } else if (isGroupsConfigView) {
    currentOptionName = 'Grupo';
    currentModuleName = 'Configuración';
  } else if (isUsersConfigView) {
    currentOptionName = 'Usuarios';
    currentModuleName = 'Configuración';
  } else if (isDimensionsMethodologyView) {
    currentOptionName = 'Dimensiones';
    currentModuleName = 'Metodología';
  } else if (isScalesMethodologyView) {
    currentOptionName = 'Escala';
    currentModuleName = 'Metodología';
  } else if (isScopesMethodologyView) {
    currentOptionName = 'Alcance';
    currentModuleName = 'Metodología';
  } else if (isRecommendationsMethodologyView) {
    currentOptionName = 'Recomendaciones';
    currentModuleName = 'Metodología';
  } else if (isAiCitationsMethodologyView) {
    currentOptionName = 'Total de citas con IA';
    currentModuleName = 'Metodología';
  } else if (location.pathname === '/organization' || location.pathname === '/dashboard/organization') {
    currentOptionName = 'Organización';
    currentModuleName = 'Organización';
  } else if (isHistoryView) {
    currentOptionName = 'Historial';
    currentModuleName = 'Evaluación';
  } else if (isEvaluationView) {
    currentOptionName = 'Crear evaluación';
    currentModuleName = 'Evaluación';
  } else if (location.pathname === '/profile' || location.pathname === '/dashboard/profile') {
    currentOptionName = 'Perfil';
    currentModuleName = 'Usuario';
  }

  modules.forEach((mod) => {
    const found = mod.options.find((opt) => opt.path === location.pathname);
    if (found) {
      currentOptionName = found.name;
      currentModuleName = mod.name;
    }
  });

  return (
    <div className="flex h-screen w-full bg-[#F6F5F3] overflow-hidden font-sans">
      {/* ── Barra Lateral (Sidebar) ── */}
      <Sidebar
        modules={modules}
        currentPath={location.pathname}
        onNavigate={(path) => {
          if (path === '/evaluations/new' || path === '/evaluaciones/nueva') {
            navigate('/evaluaciones/nueva', { state: { fromClick: true, t: Date.now() } });
          } else {
            navigate(path);
          }
        }}
        userName={userName}
        userRole={userRole}
        userAvatar={userAvatar}
        userGroups={userData.groups}
        activeGroup={activeGroup}
        onChangeGroup={handleChangeGroup}
        onLogout={handleLogout}
      />

      {/* ── Contenido Principal con fondo Crema #F6F5F3 ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#F6F5F3]">
        {/* Área de trabajo con fondo crema */}
        <main className="flex-1 px-6 py-6 sm:px-8 sm:py-7 bg-[#F6F5F3]">
          {isLoading ? (
            <div className="h-full min-h-[400px] flex items-center justify-center">
              <GuiosProSpinner size="xl" label="Cargando módulo..." />
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-5">
              {/* Breadcrumb sutil alineado directamente sobre el contenido */}
              <div className="flex items-center gap-2 text-xs select-none">
                <span className="text-[#4F6170] font-normal">{currentModuleName}</span>
                <span className="text-[#B4D6D6]">/</span>
                <span className="text-[#2B3F4C] font-semibold">{currentOptionName}</span>
              </div>

              {/* Renderizado según la opción seleccionada */}
              {isModulesConfigView ? (
                <ModulesManagementView />
              ) : isGroupsConfigView ? (
                <GroupsManagementView />
              ) : isUsersConfigView ? (
                <UsersManagementView />
              ) : isDimensionsMethodologyView ? (
                <DimensionsManagementView />
              ) : isScalesMethodologyView ? (
                <ScalesManagementView />
              ) : isScopesMethodologyView ? (
                <ScopesManagementView />
              ) : isRecommendationsMethodologyView ? (
                <RecommendationsManagementView />
              ) : isAiCitationsMethodologyView ? (
                <AiCitationsManagementView />
              ) : location.pathname === '/organization' || location.pathname === '/dashboard/organization' ? (
                <OrganizationEditView />
              ) : isHistoryView ? (
                <EvaluationHistoryView />
              ) : isEvaluationView ? (
                <CreateEvaluationView />
              ) : location.pathname === '/profile' || location.pathname === '/dashboard/profile' ? (
                <ProfileView />
              ) : location.pathname === '/dashboard' ? (
                /* Vista Principal del Dashboard */
                <div className="space-y-6">
                  {/* Banner de bienvenida estilo GuiosPro */}
                  <div className="relative overflow-hidden rounded-[24px] bg-[#F7A35F] px-8 py-7 shadow-none border border-[#FBB982]/60">
                    <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#FBB982]/40 pointer-events-none" />
                    <div className="absolute -bottom-16 right-24 w-40 h-40 rounded-full bg-[#FBB982]/30 pointer-events-none" />

                    <div className="relative z-10 max-w-2xl">
                      <span className="inline-block px-3 py-1 text-[11px] font-bold tracking-wider uppercase rounded-full bg-[#F9E8A0] text-[#5B4A12] mb-3">
                        {isAdmin ? 'PANEL DE CONTROL — ADMINISTRADOR' : 'PANEL DE CONTROL'}
                      </span>
                      <h2 className="text-3xl sm:text-4xl font-serif font-medium text-[#2B3F4C] tracking-tight mb-2">
                        Bienvenido a GuiosPro
                      </h2>
                      <p className="text-sm sm:text-base text-[#1F3340] leading-relaxed">
                        {isAdmin
                          ? 'Gobernanza del sistema, administración metodológica GUIOS y gestión de parámetros institucionales.'
                          : 'Evalúa, compara y toma decisiones confiables y fundamentadas en la adopción de software libre empresarial.'}
                      </p>
                    </div>
                  </div>

                  {/* Acciones Rápidas */}
                  {isAdmin ? (
                    /* Acciones Rápidas Exclusivas para Administrador */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* Metodología: Dimensiones y Factores */}
                      <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] flex flex-col justify-between hover:border-[#7FBFC1] transition-all">
                        <div>
                          <div className="w-12 h-12 rounded-[14px] bg-[#F9E8A0] flex items-center justify-center text-[#5B4A12] mb-4">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                            </svg>
                          </div>
                          <h3 className="text-xl font-serif text-[#2B3F4C] mb-1">Metodología GUIOS</h3>
                          <p className="text-xs text-[#4F6170] leading-relaxed mb-6">
                            Gestiona dimensiones, factores técnicos y subfactores de evaluación de software libre.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/methodology/dimensions')}
                          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-[14px] bg-[#7FBFC1] text-[#16303B] font-semibold text-sm hover:opacity-95 transition cursor-pointer"
                        >
                          <span>Ver dimensiones</span>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </button>
                      </div>

                      {/* Escalas y Niveles */}
                      <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] flex flex-col justify-between hover:border-[#7FBFC1] transition-all">
                        <div>
                          <div className="w-12 h-12 rounded-[14px] bg-[#D5ECEC] flex items-center justify-center text-[#16303B] mb-4">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                            </svg>
                          </div>
                          <h3 className="text-xl font-serif text-[#2B3F4C] mb-1">Escalas y niveles</h3>
                          <p className="text-xs text-[#4F6170] leading-relaxed mb-6">
                            Configura niveles de madurez, ponderación y recomendaciones metodológicas de adopción.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/methodology/scales')}
                          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-[14px] bg-white border border-[#D5ECEC] text-[#2B3F4C] font-semibold text-sm hover:bg-[#F6F5F3] transition cursor-pointer"
                        >
                          <span>Ver escalas</span>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </button>
                      </div>

                      {/* Usuarios y Permisos */}
                      <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] flex flex-col justify-between hover:border-[#7FBFC1] transition-all">
                        <div>
                          <div className="w-12 h-12 rounded-[14px] bg-[#D5ECEC] flex items-center justify-center text-[#16303B] mb-4">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                            </svg>
                          </div>
                          <h3 className="text-xl font-serif text-[#2B3F4C] mb-1">Usuarios y roles</h3>
                          <p className="text-xs text-[#4F6170] leading-relaxed mb-6">
                            Control de cuentas de usuarios, grupos de seguridad y permisos RBAC del sistema.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/config/users')}
                          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-[14px] bg-white border border-[#D5ECEC] text-[#2B3F4C] font-semibold text-sm hover:bg-[#F6F5F3] transition cursor-pointer"
                        >
                          <span>Administrar usuarios</span>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Acciones Rápidas y Evaluaciones en Curso para Decisor */
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Crear Evaluación */}
                        {isNewEvaluationActive && (
                          <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] flex flex-col justify-between hover:border-[#7FBFC1] transition-all">
                            <div>
                              <div className="w-12 h-12 rounded-[14px] bg-[#F9E8A0] flex items-center justify-center text-[#5B4A12] mb-4">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                              </div>
                              <h3 className="text-xl font-serif text-[#2B3F4C] mb-1">Nueva evaluación</h3>
                              <p className="text-xs text-[#4F6170] leading-relaxed mb-6">
                                Inicia el proceso paso a paso: software libre, ponderación de factores y subfactores.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate('/evaluaciones/nueva', { state: { fromClick: true, t: Date.now() } })}
                              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-[14px] bg-[#7FBFC1] text-[#16303B] font-semibold text-sm hover:opacity-95 transition cursor-pointer"
                            >
                              <span>Crear evaluación</span>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {/* Organización */}
                        {isOrganizationActive && (
                          <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] flex flex-col justify-between hover:border-[#7FBFC1] transition-all">
                            <div>
                              <div className="w-12 h-12 rounded-[14px] bg-[#D5ECEC] flex items-center justify-center text-[#16303B] mb-4">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                                </svg>
                              </div>
                              <h3 className="text-xl font-serif text-[#2B3F4C] mb-1">Organización</h3>
                              <p className="text-xs text-[#4F6170] leading-relaxed mb-6">
                                Configura la información empresarial vinculada a tus evaluaciones de software.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate('/organization')}
                              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-[14px] bg-white border border-[#D5ECEC] text-[#2B3F4C] font-semibold text-sm hover:bg-[#F6F5F3] transition cursor-pointer"
                            >
                              <span>Ver organización</span>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {/* Historial */}
                        {isHistoryActive && (
                          <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] flex flex-col justify-between hover:border-[#7FBFC1] transition-all">
                            <div>
                              <div className="w-12 h-12 rounded-[14px] bg-[#D5ECEC] flex items-center justify-center text-[#16303B] mb-4">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <h3 className="text-xl font-serif text-[#2B3F4C] mb-1">Historial</h3>
                              <p className="text-xs text-[#4F6170] leading-relaxed mb-6">
                                Revisa resultados de evaluaciones anteriores, reportes y recomendaciones de adopción.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate('/evaluations/history')}
                              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-[14px] bg-white border border-[#D5ECEC] text-[#2B3F4C] font-semibold text-sm hover:bg-[#F6F5F3] transition cursor-pointer"
                            >
                              <span>Consultar historial</span>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {/* Módulos (si el usuario tiene permisos) */}
                        {isModulesActive && (
                          <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] flex flex-col justify-between hover:border-[#7FBFC1] transition-all">
                            <div>
                              <div className="w-12 h-12 rounded-[14px] bg-[#D5ECEC] flex items-center justify-center text-[#16303B] mb-4">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                </svg>
                              </div>
                              <h3 className="text-xl font-serif text-[#2B3F4C] mb-1">Módulos del Sistema</h3>
                              <p className="text-xs text-[#4F6170] leading-relaxed mb-6">
                                Administra los módulos y las opciones de navegación según permisos institucionales.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate('/config/modules')}
                              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-[14px] bg-[#7FBFC1] text-[#16303B] font-semibold text-sm hover:opacity-95 transition cursor-pointer"
                            >
                              <span>Gestionar módulos</span>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {/* Grupos (si el usuario tiene permisos) */}
                        {isGroupsActive && (
                          <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] flex flex-col justify-between hover:border-[#7FBFC1] transition-all">
                            <div>
                              <div className="w-12 h-12 rounded-[14px] bg-[#D5ECEC] flex items-center justify-center text-[#16303B] mb-4">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                </svg>
                              </div>
                              <h3 className="text-xl font-serif text-[#2B3F4C] mb-1">Grupos y Permisos</h3>
                              <p className="text-xs text-[#4F6170] leading-relaxed mb-6">
                                Gestiona los grupos y roles del sistema y asocia permisos a cada opción.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate('/config/groups')}
                              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-[14px] bg-white border border-[#D5ECEC] text-[#2B3F4C] font-semibold text-sm hover:bg-[#F6F5F3] transition cursor-pointer"
                            >
                              <span>Gestionar grupos</span>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ── Evaluaciones en Curso (Exclusivo Decisor, solo si tiene activa la opción) ── */}
                      {(isNewEvaluationActive || isHistoryActive) && (
                        <InProgressEvaluationsSection />
                      )}
                    </>
                  )}

                  {/* Resumen Metodológico */}
                  <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#D5ECEC] flex items-center justify-center text-[#2B3F4C]">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#2B3F4C]">Metodología GUIOS Oficial</h4>
                        <p className="text-xs text-[#4F6170]">3 Dimensiones metodológicas • 18 Factores de evaluación • 61 Subfactores técnicos</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#D5ECEC] text-[#1F7A4D]">
                      <span className="w-2 h-2 rounded-full bg-[#1F7A4D]"></span>
                      Sistema en línea
                    </span>
                  </div>
                </div>
              ) : (
                /* Contenedor limpio para las demás opciones */
                <div className="bg-white rounded-[24px] p-10 border border-[#D5ECEC] shadow-none min-h-[360px] flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-[#D5ECEC] rounded-[14px] flex items-center justify-center text-[#16303B] mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-serif text-[#2B3F4C]">
                    {currentOptionName}
                  </h3>
                  <p className="text-sm text-[#4F6170] mt-2 max-w-md">
                    Módulo de {currentModuleName}. Listo para operar según los datos metodológicos.
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
