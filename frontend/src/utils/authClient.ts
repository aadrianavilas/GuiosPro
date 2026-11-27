/**
 * Cliente de Autenticación y Renovación Automática de Tokens - GuiosPro
 * 
 * 1. Renueva el access token automáticamente al recibir 401 mediante /api/v1/auth/token/refresh/
 * 2. Inyecta el encabezado X-Active-Group en todas las peticiones a la API según el grupo activo seleccionado.
 * 3. Proporciona la función logoutUser() para invalidar refresh tokens en la blacklist del backend y eliminar cookies.
 */

let isRefreshing = false;
let refreshSubscribers: ((success: boolean) => void)[] = [];

function notifySubscribers(success: boolean) {
  refreshSubscribers.forEach((callback) => callback(success));
  refreshSubscribers = [];
}

/**
 * Función para cerrar sesión formalmente:
 * Invalida el refresh token en la blacklist del backend, elimina cookies y limpia localStorage.
 */
export async function logoutUser(reason?: 'inactivity' | 'user_manual' | 'token_expired'): Promise<void> {
  try {
    await fetch('/api/v1/auth/logout/', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Si la red falla, continuar con la limpieza local
  } finally {
    localStorage.removeItem('guiospro_user');
    localStorage.removeItem('guiospro_active_group');

    if (reason === 'inactivity') {
      sessionStorage.setItem('guiospro_logout_reason', 'inactivity');
    }

    window.location.href = '/';
  }
}

/**
 * Configurar el interceptor global de fetch para:
 * 1. Añadir X-Active-Group
 * 2. Renovar automáticamente el Access Token expirado
 */
export function initAuthInterceptor(): void {
  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    const modifiedInit: RequestInit = { ...(init || {}) };
    const headers = new Headers(modifiedInit.headers || {});

    // Inyectar X-Active-Group si la petición va dirigida a la API de GuiosPro
    const activeGroup = localStorage.getItem('guiospro_active_group');
    if (activeGroup && url.includes('/api/v1/')) {
      if (!headers.has('X-Active-Group')) {
        headers.set('X-Active-Group', activeGroup);
      }
    }

    modifiedInit.headers = headers;
    modifiedInit.credentials = modifiedInit.credentials || 'include';

    // Ejecutar petición inicial
    let response: Response;
    try {
      response = await originalFetch(input, modifiedInit);
    } catch (err) {
      throw err;
    }

    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/token/refresh') ||
      url.includes('/auth/logout') ||
      url.includes('/auth/register');

    // Si recibimos 401 en una petición protegida, intentar renovar el token
    if (response.status === 401 && !isAuthRoute) {
      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const refreshResponse = await originalFetch('/api/v1/auth/token/refresh/', {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshResponse.ok) {
            isRefreshing = false;
            notifySubscribers(true);

            // Reintentar la petición original con los nuevos tokens en cookies
            return originalFetch(input, modifiedInit);
          } else {
            isRefreshing = false;
            notifySubscribers(false);
            window.dispatchEvent(new CustomEvent('guiospro_session_expired'));
            logoutUser('token_expired');
            return response;
          }
        } catch {
          isRefreshing = false;
          notifySubscribers(false);
          window.dispatchEvent(new CustomEvent('guiospro_session_expired'));
          logoutUser('token_expired');
          return response;
        }
      } else {
        // Encolar peticiones concurrentes mientras se renueva el token
        return new Promise<Response>((resolve) => {
          refreshSubscribers.push(async (success: boolean) => {
            if (success) {
              const retryResponse = await originalFetch(input, modifiedInit);
              resolve(retryResponse);
            } else {
              resolve(response);
            }
          });
        });
      }
    }

    return response;
  };
}
