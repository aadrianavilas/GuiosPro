/**
 * Constantes de Rutas del Sistema GuiosPro
 * Permite centralizar los paths para navegación, links y refactorizaciones rápidas.
 */
export const ROUTES = {
  // Autenticación y Seguridad
  AUTH: {
    LOGIN: '/',
    REGISTER: '/register',
    ORGANIZATION_SETUP: '/organization/setup',
    VERIFY_EMAIL: '/verify-email',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    MFA_EMAIL: '/auth/email-mfa',
    MFA_WEBAUTHN: '/auth/webauthn',
  },

  // Panel Principal
  DASHBOARD: {
    HOME: '/dashboard',
  },

  // Organización
  ORGANIZATION: {
    VIEW: '/organization',
  },

  // Perfil de Usuario
  USER: {
    PROFILE: '/profile',
  },

  // Módulo de Evaluación Metodológica (FLOSS)
  EVALUATION: {
    LIST: '/evaluations',
    NEW: '/evaluations/new',
    DETAIL: (id: string | number) => `/evaluations/${id}`,
    FACTORS: (id: string | number) => `/evaluations/${id}/factors`,
    SUBFACTORS: (id: string | number) => `/evaluations/${id}/subfactors`,
    SWOT: (id: string | number) => `/evaluations/${id}/swot`,
    AI_RECOMMENDATION: (id: string | number) => `/evaluations/${id}/ai-recommendation`,
    HISTORY: '/evaluations/history',
  },

  // Metodología y Configuración
  METHODOLOGY: {
    DIMENSIONS: '/methodology/dimensions',
    SCALES: '/methodology/scales',
    AI_CITATIONS: '/methodology/ai-citations',
    SCOPES: '/methodology/scopes',
    RECOMMENDATIONS: '/methodology/recommendations',
  },

  ADMIN: {
    CONFIG: '/config',
    MODULES: '/config/modules',
    GROUPS: '/config/groups',
    USERS: '/config/users',
  },
} as const;

export type AppRoutes = typeof ROUTES;
