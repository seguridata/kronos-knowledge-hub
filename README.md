# Seguridata (Kronos document ledger)

Wiki colaborativa self-hosted para conocimiento empresarial. Fork de [Docmost](https://github.com/docmost/docmost) con marca Seguridata y una capa propia (**Kronos**) para capacidades que no dependen de la licencia Enterprise de Docmost (por ahora, persistencia y listado de audit logs).

| Servicio                  | URL                                  |
| ------------------------- | ------------------------------------ |
| App (Vite, desarrollo)    | http://127.0.0.1:3011                |
| API + collab + websockets | http://127.0.0.1:3010                |
| Health                    | http://127.0.0.1:3010/api/health     |
| Primer workspace          | http://127.0.0.1:3011/setup/register |
| Login                     | http://127.0.0.1:3011/login          |

## Requisitos

- [Node.js](https://nodejs.org/) 22 o superior
- [pnpm](https://pnpm.io/) 10.4.0 (`corepack enable` y `corepack prepare pnpm@10.4.0 --activate`)
- Docker (Postgres 18 y Redis 8)
- `openssl` para generar `APP_SECRET`

En este repo Docker publica **Postgres en 5433** y **Redis en 6380** para no chocar con instancias locales en 5432/6379.

## Paso a paso: desarrollo local

Usa este flujo si trabajas en Linux, macOS, o **WSL con el código en el disco Linux** (`~/…`, no `/mnt/c`).

### 1. Clonar e instalar

```bash
git clone <url-de-este-repo> kronos-document-ledger
cd kronos-document-ledger
pnpm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env`:

1. Genera un secreto de al menos 32 caracteres:

   ```bash
   openssl rand -hex 32
   ```

   Pégalo en `APP_SECRET`.

2. Copia usuario, contraseña y base de `docker-compose.yml` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) a `DATABASE_URL`. El host y el puerto publicados son `127.0.0.1:5433`.

   ```
   DATABASE_URL="postgresql://docmost:<POSTGRES_PASSWORD>@127.0.0.1:5433/docmost"
   REDIS_URL=redis://127.0.0.1:6380
   APP_URL=http://localhost:3010
   PORT=3010
   ```

No dejes `APP_SECRET=REPLACE_WITH_LONG_SECRET` ni `CHANGE_ME` en la URL de Postgres: el servidor no arranca.

### 3. Base de datos y Redis

Desde la raíz del repo:

```bash
docker compose up -d
docker compose ps
```

Espera a que `db` y `redis` estén `Up`. Las migraciones de Postgres las aplica Nest al arrancar.

### 4. Arrancar API y cliente

```bash
pnpm run dev
```

Eso levanta en paralelo:

- frontend Vite en `127.0.0.1:3011` (`pnpm run client:dev`)
- API Nest en el puerto `3010` (`pnpm run server:dev`)

La colaboración en tiempo real va en el mismo proceso de Nest (`/collab`). Vite reenvía `/api`, `/socket.io` y `/collab` a `APP_URL`.

### 5. Comprobar

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3010/api/health
```

Debe devolver `200`. Abre http://127.0.0.1:3011 — no el puerto 3010 — para usar la UI de desarrollo.

### 6. Primer usuario

Si la base está vacía, entra a http://127.0.0.1:3011/setup/register y crea el workspace. Después el login es http://127.0.0.1:3011/login.

El audit log Kronos está en **Configuración → Audit log** (rol admin u owner, self-host).

---

## Windows + Docker en WSL

Docker Desktop con el motor **dentro de WSL** no expone bien 5433/6380 al Node que corre en Windows (`ECONNREFUSED` / 502). Nest sobre `/mnt/c/...` además puede quedarse colgado en estado D.

Haz esto:

1. En WSL, clona o copia el repo al home Linux, por ejemplo `/home/<usuario>/kronos-document-ledger`.
2. Ahí: `pnpm install`, `.env` como arriba, `docker compose up -d`.
3. Arranca la API **en WSL, sobre ese directorio Linux**:

   ```bash
   cd ~/kronos-document-ledger
   pnpm run server:dev
   ```

   Alternativa ya compilada:

   ```bash
   pnpm --filter ./apps/server run build
   cd apps/server
   NODE_ENV=development node dist/main.js
   ```

4. El cliente Vite puede ir en Windows o en WSL:

   ```bash
   pnpm run client:dev
   ```

   Con `APP_URL=http://localhost:3010`, el proxy de Vite llega a Nest en WSL (modo de red mirrored). Abre siempre http://127.0.0.1:3011.

Si cambias código del servidor en Windows y Nest corre desde la copia Linux, vuelve a copiar `apps/server/dist` (o el fuente) y reinicia `node dist/main.js`.\*\*

---

## Un solo comando

```bash
pnpm dev:all
```

`scripts/dev.mjs` hace, en orden: valida `.env`, levanta Postgres y Redis y espera a que estén `healthy`, y arranca cliente + API (`pnpm run dev`). En esta máquina Docker vive dentro de WSL y el `docker.exe` de Windows no trae `compose`, así que el script corre la parte de infra como `wsl docker compose`. Si el daemon está apagado, en WSL: `sudo service docker start`.

## Comandos útiles

| Comando                                 | Qué hace                                        |
| --------------------------------------- | ---------------------------------------------- |
| `pnpm dev:all`                          | `.env` + infra (espera healthy) + cliente + API |
| `pnpm infra:up`                         | Solo Postgres (5433) y Redis (6380)            |
| `pnpm infra:down`                       | Para db/redis (conserva volúmenes)             |
| `pnpm run dev`                          | Cliente + API en desarrollo                     |
| `pnpm run client:dev`                   | Solo Vite (`127.0.0.1:3011`)                    |
| `pnpm run server:dev`                   | Solo Nest (`PORT`, por defecto 3010)            |
| `pnpm --filter ./apps/server run build` | Compila la API a `apps/server/dist`             |
| `pnpm run build`                        | Compila todo el monorepo                        |

## Producción (Docker)

`docker-compose.prod.yml` levanta app + Postgres + Redis. Sustituye `APP_SECRET`, `POSTGRES_PASSWORD` y `APP_URL` antes de usarlo. La imagen se construye con el `Dockerfile` de la raíz (`pnpm build` dentro).

## Licencia

El core (fork de Docmost) está bajo **AGPL 3.0**. Los directorios `apps/client/src/ee`, `apps/server/src/ee` y `packages/ee` siguen bajo la licencia Enterprise de Docmost. Kronos (`apps/server/src/kronos`, `apps/client/src/kronos`) es código propio de Seguridata sobre el core AGPL.
