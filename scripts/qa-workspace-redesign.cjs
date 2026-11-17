/* Visual/interaction QA only. All authenticated API data is synthetic and
 * intercepted in an isolated browser context; no real account is changed.
 * Run: node scripts/qa-workspace-redesign.cjs [path-to-playwright-module]
 */
const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const baseURL = process.env.KRONOS_QA_URL || 'http://127.0.0.1:3011';
const out = path.resolve('output/redesign-qa');
const userId = '00000000-0000-4000-8000-000000000001';
const now = new Date().toISOString();
const user = { id: userId, name: 'Equipo SeguriData', email: 'qa@example.invalid', role: 'owner', locale: 'es-ES', timezone: 'America/Mexico_City', settings: { preferences: { fullPageWidth: false, pageEditMode: 'read', editorToolbar: true } }, createdAt: now };
const workspace = { id: '00000000-0000-4000-8000-000000000002', name: 'SeguriData', settings: { ai: { chat: true } }, enforceSso: false, authProviders: [], createdAt: now };
const names = ['Operaciones', 'Producto y tecnología', 'Personas y cultura', 'Seguridad de la información'];
const spaces = names.map((name, i) => ({ id: `00000000-0000-4000-8000-00000000001${i}`, name, slug: `equipo-${i}`, description: ['Procesos, políticas y todo lo que mueve a nuestro equipo.', 'Ideas que se convierten en mejores productos.', 'Conectamos a las personas con el conocimiento.', 'Buenas prácticas para proteger lo que importa.'][i], memberCount: 6 + i, membership: { userId, role: 'admin', permissions: [{ action: 'manage', subject: 'all' }] }, settings: {}, createdAt: now }));
const pages = ['Guía de bienvenida al equipo', 'Política de seguridad de la información', 'Proceso de revisión de documentos', 'Decisiones y acuerdos del equipo'].map((title, i) => ({ id: `00000000-0000-4000-8000-00000000002${i}`, title, slugId: `doc${i}`, space: spaces[i], spaceId: spaces[i].id, updatedAt: now, createdAt: now, creatorId: userId, lastUpdatedById: userId, icon: null }));
const paginated = (items) => ({ items, meta: { hasNextPage: false, hasPrevPage: false, limit: 30, nextCursor: null, prevCursor: null } });
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.KRONOS_QA_BROWSER || 'chrome' });
  const results = [];
  try {
    // Actual unauthenticated app, without fixtures.
    const live = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const login = await live.newPage();
    await login.goto(`${baseURL}/login`);
    await login.getByRole('textbox', { name: 'Email', exact: true }).waitFor();
    await login.screenshot({ path: path.join(out, 'login-desktop.png'), fullPage: true, animations: 'disabled' });
    await login.setViewportSize({ width: 320, height: 700 });
    assert(await login.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Login overflow at 320px');
    await login.screenshot({ path: path.join(out, 'login-mobile.png'), fullPage: true, animations: 'disabled' });
    results.push({ test: 'live-login-320px', passed: true });
    await live.close();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.routeWebSocket('**/socket.io/**', ws => ws.close());
    const unknown = new Set();
    const writes = [];
    let emptySpaces = false;
    let failUser = false;
    await context.route('**/api/**', async route => {
      const endpoint = new URL(route.request().url()).pathname.replace('/api', '');
      const input = route.request().postDataJSON() || {};
      if (/\/(create|update|delete|send|stream)$/.test(endpoint)) writes.push(endpoint);
      if (endpoint === '/users/me' && failUser) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'QA simulated outage' }) });
      let data;
      switch (endpoint) {
        case '/users/me': data = { user, workspace }; break;
        case '/workspace/public': case '/workspace/info': data = workspace; break;
        case '/workspace/entitlements': data = { cloud: false, tier: 'free', features: ['audit:logs'] }; break;
        case '/auth/collab-token': data = { token: 'qa-isolated' }; break;
        case '/spaces': data = paginated(emptySpaces ? [] : spaces.filter(s => !input.query || s.name.toLowerCase().includes(input.query.toLowerCase()))); break;
        case '/spaces/info': data = spaces.find(s => s.id === input.spaceId || s.slug === input.spaceId) || spaces[0]; break;
        case '/pages/recent': case '/pages/created-by-user': data = paginated(pages); break;
        case '/favorites': data = paginated(input.type === 'space' ? spaces.slice(0, 2).map((space, i) => ({ id: `fav${i}`, space })) : pages.slice(0, 2).map((page, i) => ({ id: `favp${i}`, page, space: page.space, createdAt: now }))); break;
        case '/favorites/ids': data = paginated([]); break;
        case '/spaces/watched-ids': case '/notifications': case '/workspace/members': case '/groups': case '/pages/sidebar-pages': case '/sessions': data = paginated([]); break;
        case '/version': data = { currentVersion: '0.95.0', latestVersion: '0.95.0' }; break;
        case '/mfa/status': data = { enabled: false }; break;
        case '/spaces/watch-status': data = { watching: false }; break;
        case '/ai/chats': data = paginated([]); break;
        case '/kronos/audit/list': data = paginated([{ id: 'audit-qa', event: 'page.created', resourceType: 'page', actorType: 'user', actorName: user.name, createdAt: now, metadata: {}, changes: null }]); break;
        case '/notifications/unread-count': data = { count: 0 }; break;
        case '/personal-space/info': data = null; break;
        case '/search': data = paginated([]); break;
        default: unknown.add(endpoint); data = paginated([]);
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const routes = ['/home', '/spaces', '/favorites', '/settings/account/profile', '/settings/workspace', '/s/equipo-0', '/ai', '/settings/audit'];
    for (const route of routes) {
      await page.goto(baseURL + route);
      await page.locator('main').waitFor();
      await page.waitForFunction(() => document.querySelector('main')?.textContent.trim().length > 30);
      await page.evaluate(() => document.fonts.ready);
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: width < 400 ? 700 : 1000 });
        const overflow = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert(overflow.scroll <= overflow.viewport + 1, `${route} overflow at ${width}: ${overflow.scroll}`);
        results.push({ test: `${route}-${width}px-overflow`, passed: true });
        await page.waitForFunction(() => Array.from(document.querySelectorAll('[class*="bezel"]')).every(e => Number(getComputedStyle(e.parentElement).opacity) >= 0.999));
        if (width === 1440 || width === 390) await page.screenshot({ path: path.join(out, `${route.replaceAll('/', '_')}-${width}.png`), fullPage: true, animations: 'disabled' });
      }
    }
    await page.goto(baseURL + '/ai');
    await page.getByRole('button', { name: 'Crear una página nueva', exact: true }).click();
    const chatDraft = page.locator('main [contenteditable="true"]');
    await chatDraft.waitFor();
    assert((await chatDraft.textContent()).includes('Crea una página titulada'));
    assert.deepEqual(writes, [], 'Suggestions must prepare a draft without creating a chat or page');
    results.push({ test: 'ai-suggestion-prefills-without-sending', passed: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(baseURL + '/home');
    await page.locator('#home-title').waitFor();
    const focus = page.locator('main button[aria-pressed]');
    await focus.click();
    assert(await focus.getAttribute('aria-pressed') === 'true');
    await page.reload();
    await page.locator('#home-title').waitFor();
    assert(await page.locator('[aria-pressed="true"]').count() > 0, 'Focus preference not restored');
    await page.locator('[aria-pressed="true"]').first().click();
    results.push({ test: 'focus-mode-persists-reload', passed: true });
    await page.keyboard.press('Control+k');
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.evaluate(() => { const e = document.createElement('div'); e.contentEditable = 'true'; e.id = 'qa-editable'; document.querySelector('main').append(e); e.focus(); });
    await page.keyboard.type('/');
    assert(await page.locator('#qa-editable').textContent() === '/', 'Shortcut swallowed editable text');
    assert(await page.getByRole('dialog').count() === 0);
    await page.locator('#qa-editable').evaluate(e => e.remove());
    results.push({ test: 'search-shortcuts-and-editable-guard', passed: true });
    await page.setViewportSize({ width: 320, height: 500 });
    await page.getByRole('button', { name: /sidebar toggle|barra lateral/i }).filter({ visible: true }).click();
    const navigation = page.getByRole('dialog');
    await navigation.waitFor();
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press('Tab');
      assert(await navigation.evaluate(e => e.contains(document.activeElement)), 'Mobile navigation leaked focus');
    }
    await page.screenshot({ path: path.join(out, 'mobile-navigation-320x500.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await navigation.waitFor({ state: 'hidden' });
    results.push({ test: 'mobile-navigation-escape-320x500', passed: true });
    await page.goto(baseURL + '/settings/account/profile');
    await page.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert(await page.getByRole('dialog').locator('input').count() === 2);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(out, 'password-dialog-320x500.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    results.push({ test: 'password-dialog-accessible-320x500', passed: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(baseURL + '/home');
    await page.locator('#home-title').waitFor();
    await page.evaluate(() => localStorage.setItem('mantine-color-scheme-value', 'dark'));
    await page.reload();
    await page.locator('#home-title').waitFor();
    await page.waitForFunction(() => document.documentElement.dataset.mantineColorScheme === 'dark');
    assert(await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(17, 19, 16)', 'Dark canvas did not switch');
    assert(await page.evaluate(() => getComputedStyle(document.querySelector('header')).backgroundColor) === 'rgb(25, 28, 24)', 'Dark header did not switch');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('[class*="bezel"]')).every(e => Number(getComputedStyle(e.parentElement).opacity) >= 0.999));
    await page.screenshot({ path: path.join(out, 'home-dark.png'), fullPage: true, animations: 'disabled' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
    await page.screenshot({ path: path.join(out, 'home-reduced-motion.png'), fullPage: true });
    results.push({ test: 'dark-and-reduced-motion-render', passed: true });
    emptySpaces = true;
    await page.reload();
    await page.getByText('Aún no hay espacios', { exact: true }).waitFor();
    results.push({ test: 'empty-spaces-has-guidance', passed: true });
    failUser = true;
    await page.reload();
    await page.getByRole('heading', { name: /Unable to load your workspace|No pudimos cargar tu espacio de trabajo/ }).waitFor();
    failUser = false;
    await page.getByRole('button', { name: /Try again|Volver a intentar/ }).click();
    await page.locator('#home-title').waitFor();
    results.push({ test: 'workspace-outage-retry-recovers', passed: true });
    await page.emulateMedia({ media: 'print' });
    assert(await page.evaluate(() => getComputedStyle(document.body).color) === 'rgb(25, 25, 25)', 'Printing from dark mode must use dark text');
    results.push({ test: 'print-from-dark-mode-readable', passed: true });
    assert.deepEqual(errors, [], `Runtime errors: ${errors.join('; ')}`);
    await fs.writeFile(path.join(out, 'results.json'), JSON.stringify({ fixtureData: true, productionMutations: false, results, unknownEndpoints: [...unknown], errors }, null, 2));
    console.log(JSON.stringify({ passed: results.length, errors, unknownEndpoints: [...unknown], output: out }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
