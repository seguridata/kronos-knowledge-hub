import { generateApiKey, hashApiKey, isApiKeyToken } from './api-key.util';
import {
  ApiKeyScope,
  isRouteAllowedForScope,
  normalizeRoutePath,
} from './api-key.constants';

describe('api-key util', () => {
  it('genera llaves con prefijo kr_ y 256 bits de entropía', () => {
    const { key, prefix } = generateApiKey();
    expect(key).toMatch(/^kr_[A-Za-z0-9_-]{43}$/);
    expect(prefix).toBe(key.slice(0, 11));
    expect(isApiKeyToken(key)).toBe(true);
  });

  it('no repite llaves', () => {
    const set = new Set(Array.from({ length: 500 }, () => generateApiKey().key));
    expect(set.size).toBe(500);
  });

  it('el hash es determinista, hex de 64 y depende del pepper', () => {
    const { key } = generateApiKey();
    const h = hashApiKey(key, 'pepper-1');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(key, 'pepper-1')).toBe(h);
    expect(hashApiKey(key, 'pepper-2')).not.toBe(h);
    expect(h).not.toContain(key);
  });

  it('distingue llaves de JWT y valores vacíos', () => {
    expect(isApiKeyToken('eyJhbGciOiJIUzI1NiJ9.x.y')).toBe(false);
    expect(isApiKeyToken('')).toBe(false);
    expect(isApiKeyToken(undefined)).toBe(false);
  });
});

describe('alcance por ruta', () => {
  it('normaliza prefijo /api, query y barra final', () => {
    expect(normalizeRoutePath('/api/search?x=1')).toBe('/search');
    expect(normalizeRoutePath('/api/pages/info/')).toBe('/pages/info');
    expect(normalizeRoutePath('/mcp')).toBe('/mcp');
  });

  it('read: lectura sí, escritura y administración no', () => {
    const r = ApiKeyScope.READ;
    expect(isRouteAllowedForScope(r, 'POST', '/api/search')).toBe(true);
    expect(isRouteAllowedForScope(r, 'POST', '/api/pages/info')).toBe(true);
    expect(isRouteAllowedForScope(r, 'POST', '/mcp')).toBe(true);
    for (const p of [
      '/api/pages/create',
      '/api/pages/update',
      '/api/pages/delete',
      '/api/api-keys/create',
      '/api/api-keys/list',
      '/api/users/me',
      '/api/workspace/info',
      '/api/knowledge/reindex',
      '/api/auth/login',
    ]) {
      expect(isRouteAllowedForScope(r, 'POST', p)).toBe(false);
    }
  });

  it('write: añade crear/actualizar pero no borrar ni administrar', () => {
    const w = ApiKeyScope.WRITE;
    expect(isRouteAllowedForScope(w, 'POST', '/api/pages/create')).toBe(true);
    expect(isRouteAllowedForScope(w, 'POST', '/api/pages/update')).toBe(true);
    expect(isRouteAllowedForScope(w, 'POST', '/api/pages/delete')).toBe(false);
    expect(isRouteAllowedForScope(w, 'POST', '/api/api-keys/create')).toBe(false);
  });

  it('rechaza métodos distintos de POST y alcances desconocidos', () => {
    expect(isRouteAllowedForScope('read', 'GET', '/api/search')).toBe(false);
    expect(isRouteAllowedForScope('read', 'DELETE', '/api/search')).toBe(false);
    expect(isRouteAllowedForScope('admin', 'POST', '/api/search')).toBe(false);
    expect(isRouteAllowedForScope('', 'POST', '/api/search')).toBe(false);
  });

  it('no se puede evadir con trucos de ruta', () => {
    const r = ApiKeyScope.READ;
    expect(isRouteAllowedForScope(r, 'POST', '/api/search/../pages/create')).toBe(false);
    expect(isRouteAllowedForScope(r, 'POST', '/api/Search')).toBe(false);
    expect(isRouteAllowedForScope(r, 'POST', '/api//search')).toBe(false);
    expect(isRouteAllowedForScope(r, 'POST', '/api/search%2f..%2fusers')).toBe(false);
  });
});
