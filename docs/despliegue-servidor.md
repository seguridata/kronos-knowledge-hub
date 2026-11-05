# Despliegue en servidor

Archivos: `docker-compose.server.yml` y `.env.server.example`. La app no publica puertos; un Caddy compartido la alcanza por la red `proxy_net` en `kronos:3010`.

## Requisitos

- Docker con Compose v2.
- La red externa `proxy_net` ya creada (`docker network create proxy_net`, si no existe) y el Caddy compartido conectado a ella.
- Un dominio HTTPS apuntando al servidor (por confirmar).
- Datos de correo (SMTP o Postmark).

## Pasos

```bash
cp .env.server.example .env
openssl rand -hex 32   # pegar en APP_SECRET
openssl rand -hex 32   # pegar en POSTGRES_PASSWORD
# editar .env: APP_URL, MAIL_*, SMTP_*
docker compose -f docker-compose.server.yml up -d --build
```

Para usar la imagen publicada en lugar de construir: `docker compose -f docker-compose.server.yml pull && docker compose -f docker-compose.server.yml up -d`.

Las migraciones de base de datos corren solas al arrancar (`NODE_ENV=production`).

## Caddy

```caddy
kronos.example.com {
    reverse_proxy kronos:3010
}
```

## Verificación

```bash
docker compose -f docker-compose.server.yml ps          # kronos debe quedar "healthy"
curl -f https://kronos.example.com/api/health
```

## Advertencias

- **No cambiar `APP_SECRET`** después del primer arranque: invalida sesiones y datos firmados.
- **`APP_URL` debe coincidir** con el dominio HTTPS que sirve Caddy.
- **El servidor nuevo arranca con base vacía.** No se migran datos del VPS actual.
- Si el paquete en GHCR es privado, hace falta `docker login ghcr.io` o construir en el servidor con `--build`.
- El `docker-compose.yml` de desarrollo tiene una contraseña de Postgres escrita en claro: no la reutilices en producción.
