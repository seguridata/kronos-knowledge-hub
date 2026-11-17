# Base de conocimiento para personas, IA y herramientas

Kronos expone el contenido de la empresa a asistentes de IA y a otras herramientas
con tres piezas que respetan los permisos de cada espacio:

1. **Llaves de API** (`kr_…`) para integraciones.
2. **Servidor MCP** (`POST /mcp`) de solo lectura.
3. **Búsqueda híbrida** (texto en español + vectores) con indexado automático.

## 1. Llaves de API

Solo owner/admin las gestionan, con sesión iniciada (una llave nunca puede crear llaves).

```bash
# Crear (la llave en claro se muestra UNA sola vez)
curl -X POST $URL/api/api-keys/create -H "Cookie: authToken=<jwt>" \
  -H 'content-type: application/json' \
  -d '{"name":"Claude Desktop - Ana","scope":"read","expiresInDays":90}'

curl -X POST $URL/api/api-keys/list   -H "Cookie: authToken=<jwt>" -d '{}' -H 'content-type: application/json'
curl -X POST $URL/api/api-keys/revoke -H "Cookie: authToken=<jwt>" -H 'content-type: application/json' -d '{"apiKeyId":"<id>"}'
```

- **Permisos = los del usuario que la creó.** Para una integración, crea un usuario de
  servicio y agrégalo solo a los espacios que debe ver.
- **Alcance:** `read` (por defecto) solo puede consultar; `write` añade crear/actualizar
  páginas. Nunca pueden borrar, administrar usuarios, ajustes ni llaves.
- Caducan (máx. 365 días, 90 por defecto), se pueden revocar al instante y dejan de
  funcionar si su dueño se desactiva. En la base solo se guarda un hash (HMAC-SHA256).

## 2. Servidor MCP

Endpoint: `POST https://<tu-dominio>/mcp` con `Authorization: Bearer kr_…`.

Herramientas (todas de solo lectura): `list_spaces`, `search_pages`, `get_page`, `list_pages`.

```bash
# Claude Code
claude mcp add --transport http kronos https://<tu-dominio>/mcp \
  --header "Authorization: Bearer kr_xxxxxxxx"
```

```jsonc
// Cursor / VS Code / clientes MCP genéricos
{ "mcpServers": { "kronos": { "type": "http", "url": "https://<tu-dominio>/mcp",
    "headers": { "Authorization": "Bearer kr_xxxxxxxx" } } } }
```

El contenido de las páginas se entrega marcado como **dato no confiable** (mitigación de
inyección de prompts) y "sin acceso" responde igual que "no existe".

## 3. Búsqueda híbrida e indexado

`POST /api/search` acepta `"mode": "hybrid"`; el MCP la usa siempre. Combina
texto (stemming español + inglés, sin acentos) y similitud vectorial con
Reciprocal Rank Fusion. Sin proveedor de embeddings, degrada a búsqueda por texto.

### Activar embeddings con un proveedor externo

Variables de entorno (ejemplos):

```env
# OpenAI
AI_DRIVER=openai
OPENAI_API_KEY=sk-...
AI_EMBEDDING_MODEL=text-embedding-3-small      # 1536 dims nativas
AI_COMPLETION_MODEL=gpt-4o-mini                # exigido por la validación de entorno
AI_EMBEDDING_DIMENSION=1536

# Gemini
AI_DRIVER=gemini
GEMINI_API_KEY=...
AI_EMBEDDING_MODEL=gemini-embedding-001
AI_COMPLETION_MODEL=gemini-2.5-flash
AI_EMBEDDING_DIMENSION=1536

# Cualquier API compatible con OpenAI (Together, Voyage, vLLM, …)
AI_DRIVER=openai-compatible
OPENAI_API_URL=https://…/v1
OPENAI_API_KEY=...
```

- La dimensión del índice es **fija al migrar** (por defecto 1536; máx. 2000 por el índice
  HNSW). Para `text-embedding-3-large` usa `AI_EMBEDDING_DIMENSION=1536` y
  `AI_EMBEDDING_SUPPORTS_MRL=true`. Si cambias de dimensión, recrea `page_embeddings`.
- Cambiar de modelo reindexa solo (el modelo queda guardado con cada vector).
- `AI_SEMANTIC_MAX_DISTANCE` (0.65 por defecto) descarta vecinos poco relevantes; afínalo
  con la evaluación de abajo.
- `AI_DRIVER=test` es solo para desarrollo (vectores léxicos, sin semántica; ignorado en producción).
- **Privacidad:** con un proveedor externo, el texto de las páginas indexadas sale de tu
  red hacia ese proveedor. Para que no salga, usa `AI_DRIVER=ollama` con un modelo local.

### Operación

- El indexado corre cada minuto, solo re-embebe páginas nuevas o editadas, y limpia las borradas.
- `POST /api/knowledge/status` (owner/admin): páginas, indexadas, pendientes, modelo.
- `POST /api/knowledge/reindex` con `{"full":true,"wait":true}`: reconstruye todo.

## Pruebas

```bash
# Unitarias
pnpm --filter server test -- src/core/knowledge src/core/api-key

# Extremo a extremo (API arriba con AI_DRIVER=test; crea y borra datos "kbtest-*")
AI_DRIVER=test AI_EMBEDDING_MODEL=hash-test pnpm server:dev
KB_EMAIL=<owner> KB_PASSWORD=<clave> node apps/server/test/kb/e2e-kb.mjs

# Calidad con preguntas reales (con embeddings reales activados)
KB_API_KEY=kr_... node apps/server/test/kb/evaluate.mjs preguntas.json 3
```

El e2e cubre llaves (formato, hash, alcance, expiración, revocación, usuario desactivado),
MCP (herramientas, truncado, inyección, no filtración de existencia), permisos en la
búsqueda (incluida una página movida de espacio), indexado incremental y una evaluación
de 10 preguntas. Con `AI_DRIVER=test` valida el pipeline y la seguridad; **la calidad
semántica real solo se mide con `evaluate.mjs` y un modelo real.**

## Pendiente / límites conocidos

- No hay chat con IA integrado (fase 4); las IA externas consultan por MCP.
- Las llaves no tienen restricción por espacio propia: la da el usuario dueño de la llave.
- Falta límite de peticiones por llave (hoy solo el de autenticación existente).
- El código bajo `apps/client/src/ee` y `packages/ee` conserva la licencia propietaria de
  Docmost (ver `packages/ee/LICENSE`): su uso en producción exige suscripción. Conviene
  reemplazarlo por implementaciones propias.
