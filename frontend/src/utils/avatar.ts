/**
 * Normaliza la URL de un avatar para garantizar su correcta carga en el navegador,
 * resolviendo rutas relativas a través del proxy de Vite o servidores locales.
 */
export const getAvatarUrl = (rawUrl?: string | null): string | null => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Si es un Blob o Data URL generado localmente en el navegador (vista previa previa a guardar)
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Si contiene una ruta de medios (/media/...), asegurar que se resuelva a nivel raíz /media/...
  if (trimmed.includes('/media/')) {
    const mediaIndex = trimmed.indexOf('/media/');
    return trimmed.substring(mediaIndex);
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return `/${trimmed}`;
};
