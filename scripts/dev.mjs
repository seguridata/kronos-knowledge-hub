#!/usr/bin/env node
// Levanta todo el entorno de desarrollo con un solo comando.
//
//   pnpm dev:all        1) verifica .env
//                       2) docker compose up -d --wait  (Postgres 18 + Redis 8)
//                       3) pnpm run dev                 (cliente Vite + API Nest)
//
//   pnpm infra:up       solo la infra
//   pnpm infra:down     apaga db/redis (conserva volúmenes)
//
// Docker vive dentro de WSL en esta máquina: el cliente docker.exe de Windows
// no trae el plugin `compose`, así que la parte de infra se ejecuta como
// `wsl docker compose ...`. Si algún día hay un `docker compose` nativo, se usa
// ese automáticamente.

import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const mode = process.argv[2] ?? 'all'; // all | infra-up | infra-down

function run(cmd, args, { optional = false } = {}) {
  const res = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: isWin });
  if (res.error) {
    if (optional) return 1;
    console.error(`\n✖ No se pudo ejecutar "${cmd}": ${res.error.message}`);
    process.exit(1);
  }
  return res.status ?? 0;
}

// Elige cómo invocar docker compose: nativo si existe, si no vía WSL.
function resolveCompose() {
  const native = spawnSync('docker', ['compose', 'version'], { shell: isWin });
  if (native.status === 0) return ['docker', 'compose'];
  const wsl = spawnSync('wsl', ['docker', 'compose', 'version'], { shell: isWin });
  if (wsl.status === 0) return ['wsl', 'docker', 'compose'];
  console.error('✖ No encontré `docker compose` ni nativo ni en WSL.');
  console.error('  Abre WSL y verifica que el daemon está vivo: sudo service docker start');
  process.exit(1);
}

function compose(...args) {
  const [bin, ...prefix] = resolveCompose();
  return run(bin, [...prefix, ...args]);
}

// --- .env ----------------------------------------------------------------
function checkEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) {
    const example = join(root, '.env.example');
    if (!existsSync(example)) {
      console.error('✖ No existe .env ni .env.example.');
      process.exit(1);
    }
    copyFileSync(example, envPath);
    console.warn('⚠ Se creó .env desde .env.example.');
    console.warn('  Configura APP_SECRET (openssl rand -hex 32) y DATABASE_URL, y vuelve a correr.');
    process.exit(1);
  }
  const env = readFileSync(envPath, 'utf8');
  const bad = ['REPLACE_WITH_LONG_SECRET', 'CHANGE_ME', 'CHANGEME'].filter((p) => env.includes(p));
  if (bad.length) {
    console.error(`✖ .env tiene valores sin configurar: ${bad.join(', ')}`);
    console.error('  El servidor no arranca hasta reemplazarlos.');
    process.exit(1);
  }
}

// --- flujo -------------------------------------------------------------------
if (mode === 'infra-down') {
  process.exit(compose('down'));
}

checkEnv();

console.log('▶ Levantando Postgres y Redis (docker compose up -d --wait)…');
if (compose('up', '-d', '--wait') !== 0) {
  console.error('✖ docker compose falló. ¿El daemon de Docker en WSL está corriendo?');
  process.exit(1);
}
console.log('✔ Infra lista — Postgres 127.0.0.1:5433 · Redis 127.0.0.1:6380\n');

if (mode === 'infra-up') process.exit(0);

console.log('▶ Arrancando cliente (127.0.0.1:3011) y API (127.0.0.1:3010)…\n');
process.exit(run('pnpm', ['run', 'dev']));
