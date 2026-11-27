import React, { useState, useEffect, useRef } from 'react';
import type { NavigationModule, NavigationOption } from '@/types';
import { DynamicIcon } from './DynamicIcon';
import { getAvatarUrl } from '@/utils/avatar';
import { GuiosProLogo } from '@/components/brand/GuiosProLogo';
import { GuiosProIcon } from '@/components/brand/GuiosProIcon';

interface SidebarProps {
  modules: NavigationModule[];
  currentPath: string;
  onNavigate: (path: string) => void;
  userName?: string;
  userRole?: string;
  userAvatar?: string | null;
  userGroups?: string[];
  activeGroup?: string;
  onChangeGroup?: (groupName: string) => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  modules,
  currentPath,
  onNavigate,
  userName = 'Usuario',
  userRole = 'Decisor',
  userAvatar,
  userGroups = [],
  activeGroup,
  onChangeGroup,
  onLogout,
}) => {
  const [imgError, setImgError] = useState<boolean>(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const [isGroupsSubmenuOpen, setIsGroupsSubmenuOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('guiospro_sidebar_collapsed') === 'true';
  });
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('guiospro_sidebar_collapsed', String(next));
      return next;
    });
  };

  const normalizedAvatar = getAvatarUrl(userAvatar);

  // Lista consolidada de grupos asignados al usuario
  const availableGroups = userGroups.length > 0 ? userGroups : [userRole];

  useEffect(() => {
    setImgError(false);
  }, [userAvatar]);

  // Cerrar menú al hacer clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
        setIsGroupsSubmenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  return (
    <aside
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } h-screen bg-[#D5ECEC] border-r border-[#B4D6D6] flex flex-col shrink-0 select-none transition-all duration-300 font-sans relative`}
    >
      {/* ── Header con Logo GuiosPro y botón de alternar panel (cerrar/abrir) ── */}
      <div
        className={`h-16 flex items-center shrink-0 border-b border-[#B4D6D6]/60 transition-all ${
          isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}
      >
        {!isCollapsed ? (
          <>
            <GuiosProLogo showSubtitle />
            {/* Botón cerrar sidebar */}
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Cerrar barra lateral"
              title="Cerrar barra lateral"
              className="w-7 h-7 rounded-[8px] bg-white border border-[#B4D6D6] flex items-center justify-center text-[#4F6170] hover:text-[#2B3F4C] hover:border-[#7FBFC1] transition shadow-none cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          </>
        ) : (
          /* Botón abrir sidebar cuando está colapsado */
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Abrir barra lateral"
            title="Abrir barra lateral"
            className="group relative flex items-center justify-center p-1.5 rounded-xl hover:bg-white/50 transition cursor-pointer"
          >
            <GuiosProIcon className="w-8 h-8 shrink-0 group-hover:scale-105 transition-transform" />
            <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border border-[#B4D6D6] rounded-full flex items-center justify-center text-[#4F6170] opacity-0 group-hover:opacity-100 transition shadow-sm">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </button>
        )}
      </div>

      {/* ── Lista de Módulos y Opciones (consultadas de la BD) ── */}
      <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-3.5'} py-3 space-y-4`}>
        {modules.length === 0 ? (
          <div className="space-y-3 p-3">
            <div className="h-3 bg-[#BFE0E0] rounded-md animate-pulse w-24" />
            <div className="h-9 bg-[#BFE0E0]/60 rounded-[14px] animate-pulse" />
            <div className="h-9 bg-[#BFE0E0]/60 rounded-[14px] animate-pulse" />
            <div className="h-3 bg-[#BFE0E0] rounded-md animate-pulse w-20 mt-4" />
            <div className="h-9 bg-[#BFE0E0]/60 rounded-[14px] animate-pulse" />
          </div>
        ) : (
          modules.map((mod) => (
            <div key={mod.id || mod.name} className="space-y-1">
              {/* Título de la Sección */}
              {!isCollapsed ? (
                <div className="px-3 text-[10px] font-bold text-[#2B3F4C]/70 uppercase tracking-widest truncate">
                  {mod.name}
                </div>
              ) : (
                <div className="my-2 border-t border-[#B4D6D6]/40 mx-2" />
              )}

              {/* Opciones del Módulo */}
              <div className="space-y-1">
                {mod.options.map((opt: NavigationOption) => {
                  const isActive = currentPath === opt.path;

                  if (isCollapsed) {
                    return (
                      <button
                        key={opt.id || opt.path}
                        type="button"
                        onClick={() => onNavigate(opt.path)}
                        title={opt.name}
                        aria-label={opt.name}
                        className={`group w-10 h-10 mx-auto flex items-center justify-center rounded-[14px] text-sm transition-all duration-150 cursor-pointer ${
                          isActive
                            ? 'bg-[#F7A35F] text-[#1F3340] font-bold shadow-sm'
                            : 'text-[#2B3F4C] hover:bg-[#BFE0E0]/60 hover:text-[#1F3340]'
                        }`}
                      >
                        <DynamicIcon
                          name={opt.icon}
                          className={`w-5 h-5 transition-transform duration-150 group-hover:scale-110 ${
                            isActive ? 'text-[#1F3340]' : 'text-[#4F6170] group-hover:text-[#1F3340]'
                          }`}
                        />
                      </button>
                    );
                  }

                  return (
                    <button
                      key={opt.id || opt.path}
                      type="button"
                      onClick={() => onNavigate(opt.path)}
                      className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-sm transition-all duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-[#F7A35F] text-[#1F3340] font-bold shadow-none'
                          : 'text-[#2B3F4C] hover:bg-[#BFE0E0]/60 hover:text-[#1F3340] font-medium'
                      }`}
                    >
                      <span className="flex items-center justify-center w-5 h-5 shrink-0">
                        <DynamicIcon
                          name={opt.icon}
                          className={`w-4 h-4 transition-transform duration-150 group-hover:scale-110 ${
                            isActive ? 'text-[#1F3340]' : 'text-[#4F6170] group-hover:text-[#1F3340]'
                          }`}
                        />
                      </span>
                      <span className="truncate">{opt.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Perfil de Usuario en el Footer con Menú Desplegable ── */}
      <div className="p-3 border-t border-[#B4D6D6]/60 bg-[#D5ECEC] shrink-0 relative" ref={profileMenuRef}>
        {/* Menú Flotante (hacia arriba cuando está expandido, hacia la derecha cuando está colapsado) */}
        {isProfileMenuOpen && (
          <div
            className={`absolute bg-white rounded-[20px] border border-[#B4D6D6] shadow-2xl p-2 z-50 text-xs font-sans animate-fade-in space-y-1 ${
              isCollapsed
                ? 'bottom-2 left-full ml-3 w-64'
                : 'bottom-full mb-2 left-2 right-2'
            }`}
          >
            {/* Header del Menú */}
            <div className="px-3 py-2 border-b border-[#D5ECEC]/70 flex items-center justify-between">
              <div className="truncate">
                <span className="block text-[10px] font-bold text-[#4F6170] uppercase tracking-wider">
                  Cuenta activa
                </span>
                <span className="font-bold text-xs text-[#2B3F4C] truncate block">{userName}</span>
              </div>
              <span className="text-[10px] font-bold text-[#5B4A12] bg-[#F9E8A0] px-2 py-0.5 rounded-full shrink-0">
                {activeGroup || userRole}
              </span>
            </div>

            {/* Opción 1: Perfil */}
            <button
              type="button"
              onClick={() => {
                setIsProfileMenuOpen(false);
                setIsGroupsSubmenuOpen(false);
                onNavigate('/profile');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-[#2B3F4C] hover:bg-[#F6F5F3] font-medium transition cursor-pointer text-left"
            >
              <div className="w-6 h-6 rounded-lg bg-[#D5ECEC] flex items-center justify-center text-[#16303B] shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div className="flex-1">
                <span className="block font-semibold text-xs">Perfil</span>
                <span className="block text-[10px] text-[#4F6170]">Ver datos personales y seguridad</span>
              </div>
            </button>

            {/* Opción 2: Cambiar grupo */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setIsGroupsSubmenuOpen(!isGroupsSubmenuOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[#2B3F4C] hover:bg-[#F6F5F3] font-medium transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#F9E8A0] flex items-center justify-center text-[#5B4A12] shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                  </div>
                  <div>
                    <span className="block font-semibold text-xs">Cambiar grupo</span>
                    <span className="block text-[10px] text-[#4F6170]">
                      {availableGroups.length > 1
                        ? `${availableGroups.length} roles asignados`
                        : '1 rol asignado'}
                    </span>
                  </div>
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-[#4F6170] transition-transform ${isGroupsSubmenuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {/* Submenú desplegable de grupos */}
              {isGroupsSubmenuOpen && (
                <div className="px-2 py-1.5 bg-[#F6F5F3] rounded-[14px] border border-[#D5ECEC] space-y-1">
                  {availableGroups.map((grp) => {
                    const isCurrent = (activeGroup || userRole) === grp;
                    return (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => {
                          if (onChangeGroup && !isCurrent) {
                            onChangeGroup(grp);
                          }
                          setIsProfileMenuOpen(false);
                          setIsGroupsSubmenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[10px] text-xs font-semibold transition cursor-pointer ${
                          isCurrent
                            ? 'bg-[#7FBFC1] text-[#16303B]'
                            : 'bg-white hover:bg-[#D5ECEC]/60 text-[#2B3F4C] border border-[#D5ECEC]'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isCurrent ? 'bg-[#16303B]' : 'bg-[#7FBFC1]'
                            }`}
                          />
                          <span className="truncate">{grp}</span>
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold bg-[#16303B] text-white px-1.5 py-0.5 rounded-full shrink-0">
                            Activo
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Separador */}
            <div className="border-t border-[#D5ECEC]/70 pt-1">
              {/* Opción 3: Cerrar sesión */}
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setIsGroupsSubmenuOpen(false);
                  if (onLogout) onLogout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[12px] text-[#B84318] hover:bg-[#B84318]/10 font-medium transition cursor-pointer text-left"
              >
                <div className="w-6 h-6 rounded-lg bg-[#B84318]/15 flex items-center justify-center text-[#B84318] shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                </div>
                <div>
                  <span className="block font-semibold text-xs">Cerrar sesión</span>
                  <span className="block text-[10px] text-[#B84318]/80">Salir de GuiosPro</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Tarjeta de Perfil visible */}
        {!isCollapsed ? (
          <div
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center justify-between p-1.5 pr-3 rounded-full bg-white border border-[#B4D6D6] hover:border-[#7FBFC1] transition shadow-none cursor-pointer group"
            title="Opciones de perfil y cambio de rol"
          >
            <div className="flex items-center gap-2 min-w-0 text-left flex-1">
              <div className="w-8 h-8 rounded-full bg-[#F7A35F] text-[#1F3340] flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                {normalizedAvatar && !imgError ? (
                  <img
                    src={normalizedAvatar}
                    alt="Avatar"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  userName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-[#2B3F4C] truncate leading-tight group-hover:text-[#16303B]">
                  {userName}
                </p>
                <span className="inline-block text-[9px] font-bold text-[#5B4A12] bg-[#F9E8A0] px-1.5 py-0.2 rounded-full leading-none">
                  {activeGroup || userRole}
                </span>
              </div>
            </div>

            <div className="p-1 text-[#4F6170] group-hover:text-[#2B3F4C] transition">
              <svg
                className={`w-4 h-4 transition-transform ${isProfileMenuOpen ? 'rotate-180 text-[#16303B]' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="w-10 h-10 mx-auto rounded-full bg-[#F7A35F] text-[#1F3340] flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden cursor-pointer shadow-sm hover:ring-2 hover:ring-[#7FBFC1] transition"
            title={`${userName} (${activeGroup || userRole}) - Opciones de perfil`}
          >
            {normalizedAvatar && !imgError ? (
              <img
                src={normalizedAvatar}
                alt="Avatar"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              userName.charAt(0).toUpperCase()
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
