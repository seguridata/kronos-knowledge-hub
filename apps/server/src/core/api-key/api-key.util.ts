import { createHmac, randomBytes } from 'crypto';

/** Prefijo distintivo: permite detectar fugas con escáneres de secretos. */
export const API_KEY_PREFIX = 'kr_';
const DISPLAY_PREFIX_LENGTH = 11; // "kr_" + 8 caracteres

export function generateApiKey(): { key: string; prefix: string } {
  // 32 bytes de CSPRNG = 256 bits de entropía
  const key = API_KEY_PREFIX + randomBytes(32).toString('base64url');
  return { key, prefix: key.slice(0, DISPLAY_PREFIX_LENGTH) };
}

/** HMAC-SHA256 con pepper del servidor: la BD nunca guarda la llave en claro. */
export function hashApiKey(key: string, pepper: string): string {
  return createHmac('sha256', pepper).update(key).digest('hex');
}

export function isApiKeyToken(token?: string): token is string {
  return typeof token === 'string' && token.startsWith(API_KEY_PREFIX);
}
