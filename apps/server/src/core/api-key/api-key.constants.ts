export const ApiKeyScope = {
  READ: 'read',
  WRITE: 'write',
} as const;

export type ApiKeyScope = (typeof ApiKeyScope)[keyof typeof ApiKeyScope];

/**
 * Lista blanca de rutas por alcance (mínimo privilegio).
 * Casi todo el API de Kronos usa POST, así que el método HTTP no basta
 * para distinguir lectura de escritura: se autoriza por ruta.
 * Cualquier ruta que no esté aquí (usuarios, ajustes, auth, gestión de
 * llaves, borrado, etc.) queda vedada para las API keys.
 */
const READ_ROUTES = [
  '/search',
  '/search/suggest',
  '/pages/info',
  '/pages/recent',
  '/pages/sidebar-pages',
  '/pages/breadcrumbs',
  '/pages/backlinks',
  '/spaces',
  '/spaces/info',
  '/mcp',
];

const WRITE_ROUTES = [...READ_ROUTES, '/pages/create', '/pages/update'];

const ROUTES_BY_SCOPE: Record<ApiKeyScope, ReadonlySet<string>> = {
  [ApiKeyScope.READ]: new Set(READ_ROUTES),
  [ApiKeyScope.WRITE]: new Set(WRITE_ROUTES),
};

export function normalizeRoutePath(url: string): string {
  let path = url.split('?')[0];
  if (path.startsWith('/api/') || path === '/api') {
    path = path.slice(4) || '/';
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}

export function isRouteAllowedForScope(
  scope: string,
  method: string,
  url: string,
): boolean {
  if (method.toUpperCase() !== 'POST') return false;
  const routes = ROUTES_BY_SCOPE[scope as ApiKeyScope];
  return !!routes && routes.has(normalizeRoutePath(url));
}
