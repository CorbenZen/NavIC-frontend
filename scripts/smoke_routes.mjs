/*
 * Cross-browser shell smoke checks for every configured frontend route.
 * It exercises real app navigation in Chromium and Firefox and saves visual
 * evidence for the sidebar, glass menus, scrolled topbar, and tracking map.
 */
import { mkdir } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { NAV_ITEMS } from '../react-jsx/utils/navigation.js';
import { REPORT_CATALOG } from '../react-jsx/utils/config.js';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:5173';
const userId = process.env.SMOKE_USER_ID;
const password = process.env.SMOKE_PASSWORD;
const adminUserId = process.env.SMOKE_ADMIN_USER_ID;
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD;
const sessionToken = process.env.SMOKE_SESSION_TOKEN;
const csrfToken = process.env.SMOKE_CSRF_TOKEN;
const routes = NAV_ITEMS.map((item) => item.path);
const reportTypes = REPORT_CATALOG.flatMap((group) => group.items.map((item) => item.type));
const viewports = [
  { width: 1920, height: 1040 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];
const themes = ['light', 'dark'];
const browsers = [{ name: 'Chromium', type: chromium }, { name: 'Firefox', type: firefox }];
const screenshotDir = new URL('../../docs/screenshots/uifix7/', import.meta.url);
const failures = [];
await mkdir(screenshotDir, { recursive: true });

function record(ok, label, details = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${details ? ` · ${details}` : ''}`);
  if (!ok) failures.push(label);
}

async function loginIfNeeded(page) {
  if (userId && password) {
    await page.goto(`${baseUrl}/sign-in`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.login-screen', { timeout: 15000 });
    await page.getByLabel('User ID').fill(userId);
    await page.getByLabel('Password').first().fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForSelector('#primary-navigation', { timeout: 15000 });
    return;
  }
  if (sessionToken && csrfToken) {
    await page.context().addCookies([
      { name: 'navic_session', value: sessionToken, url: baseUrl, httpOnly: true, sameSite: 'Lax' },
      { name: 'navic_csrf', value: csrfToken, url: baseUrl, sameSite: 'Lax' },
    ]);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#primary-navigation', { timeout: 15000 });
    return;
  }
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  if (!(await page.getByText('Demo access · auth off').count())) {
    throw new Error('Set SMOKE_USER_ID and SMOKE_PASSWORD, or run against the app explicit demo-auth mode.');
  }
}

async function prepare(page, viewport, theme, collapsed, route) {
  await page.setViewportSize(viewport);
  await page.evaluate(([mode, rail]) => {
    localStorage.setItem('navic-theme', mode);
    if (rail) localStorage.setItem('cbtms-sidebar-collapsed', 'true');
    else localStorage.removeItem('cbtms-sidebar-collapsed');
  }, [theme, collapsed]);
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#primary-navigation', { timeout: 15000 });
  await page.waitForTimeout(80);
}

async function inspectSidebar(page, theme, viewport, collapsed) {
  const geometry = await page.evaluate(() => {
    const sidebar = document.querySelector('#primary-navigation');
    const buttonsAndLinks = [...sidebar.querySelectorAll('button, a')].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    const unnamed = buttonsAndLinks.filter((element) => {
      const name = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.innerText || element.getAttribute('title') || '';
      return !name.trim();
    });
    const unadorned = buttonsAndLinks.filter((element) => !element.innerText.trim() && !element.querySelector('svg, img[alt], [aria-label]'));
    const emptyPseudo = [...sidebar.querySelectorAll('*')].filter((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      return ['::before', '::after'].some((pseudo) => {
        const style = getComputedStyle(element, pseudo);
        return style.display !== 'none' && style.content === '""'
          && Number.parseFloat(style.borderTopWidth) > 0
          && Number.parseFloat(style.width) >= 12 && Number.parseFloat(style.height) >= 12;
      });
    }).map((element) => element.outerHTML.slice(0, 240));
    const topbar = document.querySelector('.topbar');
    const handle = sidebar.querySelector('.sidebar-collapse-edge');
    const breadcrumb = document.querySelector('.breadcrumb');
    const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const chip = document.querySelector('.topbar .user-menu-topbar .account-chip');
    const chipRect = chip?.getBoundingClientRect();
    const active = sidebar.querySelector('a[aria-current="page"]');
    const activeRect = active?.getBoundingClientRect();
    const markerStyle = active ? getComputedStyle(active, '::before') : null;
    const marker = activeRect && markerStyle ? {
      left: activeRect.left + Number.parseFloat(markerStyle.left || '0'),
      right: activeRect.left + Number.parseFloat(markerStyle.left || '0') + Number.parseFloat(markerStyle.width || '0'),
      top: activeRect.top + (activeRect.height - Number.parseFloat(markerStyle.height || '0')) / 2,
      bottom: activeRect.top + (activeRect.height + Number.parseFloat(markerStyle.height || '0')) / 2,
      visible: markerStyle.content !== 'none' && markerStyle.display !== 'none' && Number.parseFloat(markerStyle.opacity) > 0,
    } : null;
    return {
      unnamed: unnamed.map((element) => element.outerHTML.slice(0, 180)),
      unadorned: unadorned.map((element) => element.outerHTML.slice(0, 180)),
      emptyPseudo,
      activeLinks: sidebar.querySelectorAll('a[aria-current="page"]').length,
      activeBarInside: Boolean(activeRect && marker?.visible && marker.left >= activeRect.left - 2 && marker.right <= activeRect.right + 2 && marker.top >= activeRect.top - 2 && marker.bottom <= activeRect.bottom + 2),
      noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
      topbarRightInset: chipRect ? document.documentElement.clientWidth - chipRect.right : true,
      headerAligned: Math.abs(sidebar.querySelector('.sidebar-header').getBoundingClientRect().bottom - topbar.getBoundingClientRect().bottom) <= 1,
      breadcrumbClear: !handle || !breadcrumb || !intersects(handle.getBoundingClientRect(), breadcrumb.getBoundingClientRect()),
    };
  });
  record(!geometry.unnamed.length && !geometry.unadorned.length && !geometry.emptyPseudo.length,
    `sidebar controls named and decorated ${theme} ${viewport.width}x${viewport.height} ${collapsed ? 'rail' : 'expanded'}`,
    `unnamed=${geometry.unnamed.length} empty=${geometry.unadorned.length} bordered-empty=${geometry.emptyPseudo.length}`);
  record(geometry.activeLinks === 1 && geometry.noHorizontalScroll,
    `route and viewport ${theme} ${viewport.width}x${viewport.height}`,
    `active=${geometry.activeLinks} noScroll=${geometry.noHorizontalScroll}`);
  record(geometry.activeBarInside, `active bar is inside current link ${theme} ${viewport.width} ${collapsed ? 'rail' : 'expanded'}`);
  record(geometry.topbarRightInset >= 24 && geometry.headerAligned && geometry.breadcrumbClear,
    `topbar alignment ${viewport.width}x${viewport.height}`,
    `rightInset=${geometry.topbarRightInset.toFixed(1)} header=${geometry.headerAligned} breadcrumb=${geometry.breadcrumbClear}`);
  return geometry;
}

async function checkPaletteSearch(page, label) {
  const trigger = page.locator('.topbar .command-palette-trigger');
  await trigger.click();
  const search = page.locator('.command-palette-search');
  await search.waitFor({ state: 'visible' });
  const details = await search.evaluate((node) => {
    const input = node.querySelector('input');
    const icon = node.querySelectorAll('.search-input-icon');
    const hint = node.querySelector('kbd');
    const style = getComputedStyle(input);
    const iconRect = icon[0]?.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    return {
      iconCount: icon.length,
      iconOffset: iconRect ? iconRect.left - node.getBoundingClientRect().left : null,
      paddingLeft: Number.parseFloat(style.paddingLeft),
      iconLeft: iconRect?.left,
      textClear: iconRect ? inputRect.left + Number.parseFloat(style.paddingLeft) >= iconRect.right + 8 : false,
      hint: hint?.innerText.trim(),
      platform: navigator.userAgentData?.platform || navigator.platform || '',
    };
  });
  const expected = /mac/i.test(details.platform) ? '⌘K' : 'Ctrl K';
  record(details.iconCount === 1 && Math.abs(details.iconOffset - 16) <= 1 && details.paddingLeft === 48 && details.textClear && details.hint === expected,
    `command palette has one clear search icon ${label}`, JSON.stringify(details));
  await page.keyboard.press('Escape');
}

async function checkShellSingletons(page, label) {
  const counts = await page.evaluate(() => ({
    theme: document.querySelectorAll('.topbar .theme-trigger').length,
    search: document.querySelectorAll('.topbar .command-palette-trigger').length,
    user: document.querySelectorAll('.topbar .user-menu-topbar .account-chip').length,
  }));
  record(counts.theme === 1 && counts.search === 1 && counts.user === 1,
    `topbar controls are singletons ${label}`, JSON.stringify(counts));
}

async function checkSearchInputOwnership(page, label) {
  const outside = await page.evaluate(() => [...document.querySelectorAll('input[type="search"]')]
    .filter((input) => !input.closest('.search-input-wrapper'))
    .map((input) => input.outerHTML.slice(0, 160)));
  record(outside.length === 0, `search fields use shared SearchInput ${label}`, JSON.stringify(outside));
}

async function checkAvatarContrast(page, label) {
  const details = await page.evaluate(() => {
    const rgb = (value) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [];
    const luminance = (value) => {
      const channels = rgb(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    return [...document.querySelectorAll('.avatar:not(img), .shell-menu-avatar:not(img)')].map((node) => {
      const style = getComputedStyle(node);
      const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
      return { text: node.innerText.trim(), ratio: (values[0] + 0.05) / (values[1] + 0.05), fill: style.backgroundColor, ink: style.color };
    });
  });
  const failing = details.filter((avatar) => avatar.ratio < 4.5);
  record(details.length > 0 && failing.length === 0, `avatar initials contrast at least 4.5:1 ${label}`, JSON.stringify({ count: details.length, failing }));
}

async function checkLightBadgeReadability(page, label) {
  const results = await page.evaluate(() => {
    const luminance = (rgb) => {
      const channels = rgb.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const color = (value) => {
      const normalized = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/i);
      if (normalized) return { rgb: normalized.slice(1, 4).map((part) => Number(part) * 255), alpha: Number(normalized[4] ?? 1) };
      const parts = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 1];
      return { rgb: parts.slice(0, 3), alpha: parts[3] ?? 1 };
    };
    const contrast = (a, b) => {
      const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (high + 0.05) / (low + 0.05);
    };
    return [...document.querySelectorAll('.badge, .vehicle-status-badge, .topbar-badge, .live-chip, .nav-badge, .status-pill')]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      })
      .map((node) => {
        const style = getComputedStyle(node);
        const background = color(style.backgroundColor);
        const foreground = color(style.color).rgb;
        const composed = background.rgb.map((channel) => channel * background.alpha + 255 * (1 - background.alpha));
        return {
          text: node.innerText.trim(), className: node.className.toString(),
          backgroundLuminance: luminance(composed), contrast: contrast(foreground, composed),
          allowedSolid: node.classList.contains('nav-badge'),
        };
      });
  });
  const offenders = results.filter((badge) => (!badge.allowedSolid && badge.backgroundLuminance < 0.45) || badge.contrast < 4.5);
  record(offenders.length === 0, `light badges have soft fills and readable text ${label}`, JSON.stringify({ checked: results.length, offenders }));
}

async function checkGeofencesToolbar(page, browserName, theme, viewport) {
  await prepare(page, viewport, theme, false, '/geofences');
  const details = await page.evaluate(() => {
    const map = document.querySelector('.geofences-map-panel');
    const toolbar = document.querySelector('.geofences-map-view .map-toolbar');
    const topbar = document.querySelector('.topbar');
    const chip = document.querySelector('.topbar .user-menu-topbar .account-chip');
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    };
    const mapRect = rect(map); const toolbarRect = rect(toolbar); const topbarRect = rect(topbar); const chipRect = rect(chip);
    const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const hit = document.elementFromPoint((chipRect.left + chipRect.right) / 2, (chipRect.top + chipRect.bottom) / 2);
    return {
      insideMap: toolbarRect.left >= mapRect.left - 1 && toolbarRect.right <= mapRect.right + 1 && toolbarRect.top >= mapRect.top - 1 && toolbarRect.bottom <= mapRect.bottom + 1,
      clearsTopbar: !intersects(toolbarRect, topbarRect),
      chipHit: Boolean(chip && hit && (hit === chip || chip.contains(hit))),
      mapIsolation: getComputedStyle(map).isolation,
      toolbarPosition: getComputedStyle(toolbar).position,
    };
  });
  record(details.insideMap && details.clearsTopbar && details.chipHit && details.mapIsolation === 'isolate',
    `${browserName} ${theme} geofences toolbar contained ${viewport.width}x${viewport.height}`, JSON.stringify(details));
}

async function checkDashboardNavAtCompactHeight(page, browserName, theme) {
  const viewport = { width: 1920, height: 996 };
  for (const route of ['/', '/drivers', '/settings']) {
    await prepare(page, viewport, theme, false, route);
    const details = await page.locator('#primary-navigation').evaluate((sidebar) => {
      const nav = sidebar.querySelector('.sidebar-nav');
      const dashboard = [...nav.querySelectorAll('a')].find((link) => link.textContent.trim() === 'Dashboard');
      const navRect = nav.getBoundingClientRect(); const rect = dashboard.getBoundingClientRect();
      return { scrollTop: nav.scrollTop, visible: rect.top >= navRect.top && rect.bottom <= navRect.bottom, navHeight: nav.clientHeight, scrollHeight: nav.scrollHeight };
    });
    record(details.visible, `${browserName} ${theme} Dashboard visible at 1920x996 on ${route}`, JSON.stringify(details));
  }
}

async function checkBackendRecovery(browser, browserName) {
  const originHost = new URL(baseUrl).hostname;
  const origins = [baseUrl, `${new URL(baseUrl).protocol}//${originHost === 'localhost' ? '127.0.0.1' : 'localhost'}:${new URL(baseUrl).port}`];
  for (const origin of origins) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    if (userId && password) {
      await page.goto(`${origin}/sign-in`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.login-screen', { timeout: 15000 });
      await page.getByLabel('User ID').fill(userId);
      await page.getByLabel('Password').first().fill(password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForSelector('#primary-navigation', { timeout: 15000 });
    } else if (sessionToken && csrfToken) {
      await context.addCookies([
        { name: 'navic_session', value: sessionToken, url: origin, httpOnly: true, sameSite: 'Lax' },
        { name: 'navic_csrf', value: csrfToken, url: origin, sameSite: 'Lax' },
      ]);
    }
    await page.route('**/health', (route) => route.abort());
    await page.goto(`${origin}/trips`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#primary-navigation', { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector('.backend-offline-banner') && document.querySelector('.live-chip')?.innerText.includes('API offline'), null, { timeout: 20000 });
    record(true, `${browserName} API offline banner and pill ${origin}`);
    await page.unroute('**/health');
    await page.getByRole('button', { name: 'Retry' }).click();
    await page.waitForFunction(() => !document.querySelector('.backend-offline-banner'), null, { timeout: 15000 });
    record(page.url().endsWith('/trips'), `${browserName} trips recovers without a page reload ${origin}`);
    await context.close();
  }
}

async function checkReportsWithLiveSimulation(browser, browserName) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let simulationStarted = false;
  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#primary-navigation', { timeout: 15000 });
    const started = await context.request.post(`${baseUrl}/api/admin/demo/simulation/start`, { data: { speed_multiplier: 4 } });
    record(started.status() === 200, `${browserName} starts demo simulation at 4x`, `status=${started.status()}`);
    if (started.status() !== 200) return;
    simulationStarted = true;

    // The long wait lets moving, idle, stopped and outage phases persist through the real telemetry path.
    await page.waitForTimeout(60000);
    const tripsResponse = await context.request.get(`${baseUrl}/trips?limit=100&offset=0`);
    record(tripsResponse.ok(), `${browserName} trips endpoint returns while demo runs`, `status=${tripsResponse.status()}`);
    await page.goto(`${baseUrl}/trips`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#primary-navigation', { timeout: 15000 });
    await page.waitForTimeout(300);
    record(await page.locator('.error-banner').count() === 0, `${browserName} Trip history has no error banner with demo running`);
    record(await page.getByText('Simulated', { exact: true }).count() > 0, `${browserName} persisted demo trips carry a Simulated badge`);

    await page.goto(`${baseUrl}/reports`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.report-menu', { timeout: 15000 });
    for (const type of reportTypes) {
      const response = await context.request.get(`${baseUrl}/api/reports/${type}?limit=100&offset=0`);
      record(response.status() < 500, `${browserName} /reports ${type} while demo runs`, `status=${response.status()}`);
      await page.locator(`.report-option[data-report-type="${type}"]`).click();
      await page.waitForTimeout(120);
      record(await page.locator('.error-banner').count() === 0, `${browserName} report ${type} renders without an error banner`);
    }
  } finally {
    const stopped = simulationStarted
      ? await context.request.post(`${baseUrl}/api/admin/demo/simulation/stop`).catch(() => null)
      : null;
    if (stopped) record(stopped.status() === 200, `${browserName} stops demo simulation after report sweep`, `status=${stopped.status()}`);
    await context.close();
  }
}

async function checkAuthScreens(browser, browserName) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 990 } });
  const page = await context.newPage();
  for (const theme of themes) {
    await page.setViewportSize({ width: 1920, height: 990 });
    await page.goto(`${baseUrl}/sign-in`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((mode) => localStorage.setItem('navic-theme', mode), theme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.login-screen', { timeout: 15000 });
    for (const [path, file] of [['/sign-in', 'sign-in'], ['/sign-up', 'sign-up']]) {
      if (path !== '/sign-in') {
        await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.login-screen', { timeout: 15000 });
      }
      for (const viewport of [{ width: 1920, height: 990 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(60);
        const dimensions = await page.evaluate(() => {
          const screen = document.querySelector('.login-screen');
          const card = document.querySelector('.login-card');
          const style = card && getComputedStyle(card);
          const cssText = [...document.styleSheets].map((sheet) => {
            try { return [...sheet.cssRules].map((rule) => rule.cssText).join(''); } catch { return ''; }
          }).join('');
          // Browsers drop unknown vendor pseudo-elements from parsed rules, so
          // also read the raw style text Vite injects in development.
          const rawCss = [...document.querySelectorAll('style')].map((node) => node.textContent).join('');
          return {
            screen: Boolean(screen), card: Boolean(card),
            noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
            cardWithinScrollHeight: card ? card.getBoundingClientRect().bottom <= Math.max(innerHeight, document.documentElement.scrollHeight) + 1 : false,
            glass: style?.backdropFilter || 'none',
            autofillStylesPresent: (cssText + rawCss).includes(':-webkit-autofill') && (cssText + rawCss).includes(':-moz-autofill'),
          };
        });
        record(dimensions.screen && dimensions.card && dimensions.noHorizontalScroll && dimensions.cardWithinScrollHeight,
          `${browserName} ${theme} ${path} auth layout ${viewport.width}x${viewport.height}`, JSON.stringify(dimensions));
        record(dimensions.autofillStylesPresent, `${browserName} ${theme} ${path} autofill theme rules are loaded`);
        if (path === '/sign-in') {
          await page.waitForFunction(() => document.querySelector('.login-foot')?.textContent?.includes('v3.0.0 · development'));
          record((await page.locator('.login-foot').innerText()) === 'NavIC CBTMS v3.0.0 · development', `${browserName} sign-in footer displays v3.0.0 development`);
        }
        await saveScreenshot(page, `${browserName.toLowerCase()}-${file}-${theme}-${viewport.width}x${viewport.height}.png`);
      }
      await page.setViewportSize({ width: 1920, height: 990 });
    }
  }
  if (process.env.SMOKE_REGISTER_FLOW === '1') {
    const id = `SMOKE${Date.now().toString(36).toUpperCase()}`;
    const usn = `SM${Date.now().toString(36).toUpperCase()}`;
    const requestEvidence = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/auth/register')) requestEvidence.push({ method: request.method(), url: request.url() });
    });
    page.on('response', async (response) => {
      if (response.request().method() === 'POST' && response.url().includes('/api/auth/register')) {
        const last = requestEvidence.at(-1);
        if (last) {
          last.status = response.status();
          last.responseBody = (await response.text()).slice(0, 800);
        }
      }
    });
    await page.goto(`${baseUrl}/sign-up`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('First Name').fill('Smoke');
    await page.getByLabel('Second Name').fill('Registration');
    await page.getByLabel('User ID').fill(id);
    await page.getByLabel('USN ID').fill(usn);
    await page.getByLabel('Password').nth(0).fill('SmokePass123');
    await page.getByLabel('Confirm Password').fill('SmokePass123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.waitForURL(/sign-in\?user_id=/, { timeout: 15000 });
    console.log(`REGISTER REQUEST ${JSON.stringify(requestEvidence)}`);
    record(requestEvidence.length === 1 && requestEvidence[0].status === 201, `${browserName} registration POST returns 201`);
    record((await page.getByLabel('User ID').inputValue()) === id && await page.getByText('Account created. Sign in with your User ID.').count() === 1,
      `${browserName} registration returns to sign-in with ID prefilled and no password`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    record((await page.getByLabel('User ID').inputValue()) === id, `${browserName} sign-in prefill survives reload`);
    await page.getByLabel('User ID').fill(id);
    await page.getByLabel('Password').fill('SmokePass123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForSelector('#primary-navigation', { timeout: 15000 });
    record(true, `${browserName} newly registered account signs in`);
    const adminSummaryRequests = [];
    const captureAdminSummary = (request) => {
      if (request.url().includes('/api/dashboard/admin-summary')) adminSummaryRequests.push(request.url());
    };
    page.on('request', captureAdminSummary);
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#primary-navigation', { timeout: 15000 });
    await page.waitForTimeout(500);
    record(await page.locator('.needs-attention-panel, .fleet-hygiene-panel').count() === 0,
      `${browserName} student dashboard hides admin panels`);
    record(adminSummaryRequests.length === 0, `${browserName} student dashboard does not request admin summaries`);
    const denied = await page.evaluate(async () => (await fetch('/api/dashboard/admin-summary')).status);
    record(denied === 403, `${browserName} student admin summary request returns 403`, `status=${denied}`);
    page.off('request', captureAdminSummary);
    await page.locator('.topbar .user-menu-topbar .account-chip').click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await page.waitForSelector('.login-screen', { timeout: 10000 });
    await page.goto(`${baseUrl}/sign-in`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('User ID').fill(id);
    await page.getByLabel('Password').fill('SmokePass123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForSelector('#primary-navigation', { timeout: 15000 });
    const cookieState = await context.storageState();
    const returnVisit = await browser.newContext({ storageState: cookieState });
    const returnPage = await returnVisit.newPage();
    await returnPage.goto(`${baseUrl}/overview`, { waitUntil: 'domcontentloaded' });
    await returnPage.waitForSelector('#primary-navigation', { timeout: 15000 });
    record(await returnPage.locator('.topbar .user-menu-topbar .account-chip').count() === 1,
      `${browserName} second visit restores the saved session cookie`);
    await returnVisit.close();
  } else {
    console.log(`NOT TESTED ${browserName} registration-to-login Playwright flow: set SMOKE_REGISTER_FLOW=1 against a disposable test database`);
  }
  await context.close();
}

async function checkAdminDashboard(browser, browserName) {
  if ((!adminUserId || !adminPassword) && !(sessionToken && csrfToken)) {
    console.log(`NOT TESTED ${browserName} admin dashboard panels: set SMOKE_ADMIN_USER_ID/SMOKE_ADMIN_PASSWORD or a disposable test session`);
    return;
  }
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminContext.newPage();
  const statuses = [];
  adminPage.on('response', (response) => {
    if (response.url().includes('/api/dashboard/admin-summary')) statuses.push(response.status());
  });
  if (sessionToken && csrfToken) {
    await adminContext.addCookies([
      { name: 'navic_session', value: sessionToken, url: baseUrl, httpOnly: true, sameSite: 'Lax' },
      { name: 'navic_csrf', value: csrfToken, url: baseUrl, sameSite: 'Lax' },
    ]);
  } else {
    await adminPage.goto(`${baseUrl}/sign-in`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForSelector('.login-screen', { timeout: 15000 });
    await adminPage.getByLabel('User ID').fill(adminUserId);
    await adminPage.getByLabel('Password').first().fill(adminPassword);
    await adminPage.getByRole('button', { name: /sign in/i }).click();
    await adminPage.waitForSelector('#primary-navigation', { timeout: 15000 });
  }
  await adminPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForSelector('#primary-navigation', { timeout: 15000 });
  await adminPage.waitForSelector('.needs-attention-panel', { timeout: 15000 });
  await adminPage.waitForTimeout(500);
  record(await adminPage.locator('.fleet-hygiene-panel').count() === 1 && statuses.includes(200),
    `${browserName} admin receives both dashboard panels`, JSON.stringify(statuses));
  await adminContext.close();
}

async function saveScreenshot(page, filename) {
  const path = new URL(filename, screenshotDir).pathname;
  await page.screenshot({ path, fullPage: false });
  console.log(`SCREENSHOT ${path}`);
}

async function checkPortalMenu(page, trigger, label, { sidebar = false, screenshot } = {}) {
  await trigger.click();
  const panel = page.locator(sidebar ? '.user-menu-panel' : label === 'theme' ? '.theme-dropdown' : '.user-menu-panel').last();
  await panel.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(140);
  const details = await panel.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const sidebar = document.querySelector('#primary-navigation');
    const sidebarRect = sidebar.getBoundingClientRect();
    const alpha = getComputedStyle(node).backgroundColor.match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/)?.[1];
    const atCenter = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      inBody: node.parentElement === document.body,
      outsideSidebar: !sidebar.contains(node),
      inside: rect.left >= 8 && rect.top >= 8 && rect.right <= document.documentElement.clientWidth - 8 && rect.bottom <= innerHeight - 8,
      rightOfRail: !node.classList.contains('is-sidebar-menu') || !sidebar.classList.contains('is-rail') || rect.left >= sidebarRect.right + 8,
      width: rect.width,
      hitsPanel: node.contains(atCenter),
      blur: getComputedStyle(node).backdropFilter,
      alpha: Number(alpha),
      itemLabels: [...node.querySelectorAll('[role="menuitem"]')].map((item) => item.innerText.trim()),
    };
  });
  const menuItemsOkay = label === 'theme'
    ? ['Light', 'Dark', 'System'].every((item) => details.itemLabels.includes(item))
    : ['Profile', 'Bus Pass', 'Feedback', 'CBTMS Support', 'Settings', 'Terms & Conditions', 'Sign out'].every((item) => details.itemLabels.includes(item));
  const menuOkay = details.inBody && details.outsideSidebar && details.inside && details.rightOfRail
    && details.width >= (sidebar ? 220 : 1) && details.hitsPanel && details.blur !== 'none'
    && details.alpha < 1 && menuItemsOkay;
  record(menuOkay, `${label} portal glass menu`, `body=${details.inBody} rect=${details.inside} hit=${details.hitsPanel} blur=${details.blur} alpha=${details.alpha} width=${details.width}`);
  if (sidebar) {
    await page.locator('a[href="/tracking"]').hover();
    await page.waitForTimeout(40);
    record(await page.locator('.shell-tooltip:visible').count() === 0, 'sidebar tooltip suppressed while account menu is open');
  }
  if (screenshot) await saveScreenshot(page, screenshot);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(30);
  const focusReturned = await trigger.evaluate((node) => node === document.activeElement);
  record(!await panel.count() || !(await panel.isVisible()), `${label} Escape closes menu`);
  if (label === 'theme' || sidebar) record(focusReturned, `${label} Escape returns focus to trigger`);
  return details;
}

async function checkInteractions(page, browserName, theme) {
  for (const viewport of viewports) {
    const rail = viewport.width >= 768 && viewport.width < 1280 || viewport.width === 1920;
    await prepare(page, viewport, theme, rail, '/tracking');
    const sidebar = page.locator('#primary-navigation');
    if (viewport.width >= 768) await inspectSidebar(page, theme, viewport, rail);
    if (viewport.width === 1920 && theme === 'dark') {
      await prepare(page, viewport, theme, false, '/tracking');
      await page.getByRole('button', { name: /collapse sidebar/i }).click();
      await page.waitForTimeout(280);
      const diagnosis = await page.evaluate(() => {
        const element = document.elementFromPoint(55, 155);
        const ancestors = [];
        for (let node = element; node && ancestors.length < 5; node = node.parentElement) {
          const style = getComputedStyle(node);
          ancestors.push({ tag: node.tagName, className: node.className?.toString(), outerHTML: node.outerHTML.slice(0, 360), display: style.display, position: style.position, border: style.border, background: style.backgroundColor, backdropFilter: style.backdropFilter });
        }
        return { pointOuterHTML: element?.outerHTML, pointStyles: element ? { display: getComputedStyle(element).display, position: getComputedStyle(element).position, border: getComputedStyle(element).border, background: getComputedStyle(element).backgroundColor } : null, ancestors };
      });
      console.log(`STRAY-SQUARE DIAGNOSTIC ${browserName} ${theme} ${viewport.width}x${viewport.height}: ${JSON.stringify(diagnosis)}`);
    }

    const userTrigger = sidebar.locator('.user-menu-sidebar .account-chip');
    const railShot = viewport.width === 1920 && rail ? `collapsed-rail-${theme}.png` : null;
    if (railShot) {
      await saveScreenshot(page, railShot);
      await saveScreenshot(page, `collapsed-footer-${theme}.png`);
      const footer = await sidebar.locator('.sidebar-footer.is-rail-footer').evaluate((node) => {
        const button = node.querySelector('.account-chip');
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height, hasStatusDot: getComputedStyle(button, '::after').content !== 'none' };
      });
      record(footer.width === 40 && footer.height === 40 && footer.hasStatusDot, `collapsed footer avatar and status badge ${theme}`, JSON.stringify(footer));
    }
    if (viewport.width >= 768 && await userTrigger.count()) {
      const details = await checkPortalMenu(page, userTrigger, 'sidebar user', {
        sidebar: true,
        screenshot: viewport.width === 1920 && rail ? `collapsed-user-menu-${theme}.png` : undefined,
      });
      record(!rail || details.rightOfRail, `collapsed sidebar menu opens right ${viewport.width}`);
      if (viewport.width === 1920) {
        await userTrigger.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(80);
        const firstFocused = await page.locator('.user-menu-panel [role="menuitem"]').first().evaluate((node) => node === document.activeElement);
        await page.keyboard.press('ArrowDown');
        const moves = await page.locator('.user-menu-panel [role="menuitem"]').nth(1).evaluate((node) => node === document.activeElement);
        record(firstFocused && moves, 'account menu keyboard open and roving arrows');
        await page.keyboard.press('Escape');
        await userTrigger.click();
        await page.mouse.click(1000, 700);
        record(await page.locator('.user-menu-panel').count() === 0, 'outside click closes sidebar account menu');
      }
    }

    const topbarUser = page.locator('.topbar .user-menu-topbar .account-chip');
    await checkPortalMenu(page, topbarUser, 'topbar user', {
      screenshot: `topbar-user-menu-${theme}-${viewport.width}.png`,
    });
    const themeTrigger = page.locator('.topbar .theme-trigger');
    await checkPortalMenu(page, themeTrigger, 'theme', {
      screenshot: viewport.width === 1440 ? `theme-menu-${theme}.png` : undefined,
    });
    if (viewport.width === 1440) {
      await checkPaletteSearch(page, `${browserName} ${theme}`);
      const searchButton = page.locator('.topbar .command-palette-trigger');
      await searchButton.focus();
      await page.waitForTimeout(40);
      const searchHint = page.locator('#topbar-search-tooltip');
      record((await searchHint.textContent())?.includes('Ctrl+K'), 'topbar search tooltip includes Ctrl+K');
      await searchButton.evaluate((node) => node.blur());
    }

    const topbarCovered = await page.locator('.topbar').evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('.topbar') === node;
    });
    record(topbarCovered, `tracking map stays below topbar ${browserName} ${theme} ${viewport.width}`);
    const topbarDetails = await page.evaluate(() => {
      const bar = document.querySelector('.topbar');
      const chip = bar.querySelector('.user-menu-topbar .account-chip');
      const rect = chip.getBoundingClientRect();
      const chevron = chip.querySelector('svg:last-child')?.getBoundingClientRect();
      return {
        rightInset: document.documentElement.clientWidth - rect.right,
        chevronVisible: Boolean(chevron && chevron.left >= rect.left && chevron.right <= rect.right && chevron.width > 0),
        headerAligned: Math.abs(document.querySelector('.sidebar-header').getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom) <= 1,
      };
    });
    record(topbarDetails.rightInset >= 24 && topbarDetails.chevronVisible && topbarDetails.headerAligned,
      `topbar chip and shared header geometry ${browserName} ${theme} ${viewport.width}`,
      `rightInset=${topbarDetails.rightInset.toFixed(1)} chevron=${topbarDetails.chevronVisible} header=${topbarDetails.headerAligned}`);
  }
}

for (const { name, type } of browsers) {
  let browser;
  try {
    browser = await type.launch({ headless: true });
  } catch (error) {
    console.log(`NOT TESTED ${name}: Playwright browser launch failed: ${error.message.split('\n')[0]}`);
    failures.push(`${name} browser unavailable`);
    continue;
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(`${name} page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const source = message.location().url;
    const expectedGuardResponse = /401 \(Unauthorized\)|403 \(Forbidden\)/.test(message.text())
      && (source.includes('/api/auth/me') || source.includes('/api/dashboard/admin-summary'));
    if (!expectedGuardResponse) failures.push(`${name} console error: ${message.text()}`);
  });

  try {
    await loginIfNeeded(page);
    for (const theme of themes) {
      for (const viewport of viewports) {
        const collapsed = viewport.width < 1280 && viewport.width >= 768;
        for (const route of routes) {
          await prepare(page, viewport, theme, collapsed, route);
          const boundary = await page.getByText('The console encountered a rendering error').count();
          record(boundary === 0, `${name} ${theme} ${viewport.width}x${viewport.height} ${route} renders`);
          record(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} ${theme} ${viewport.width} ${route} no horizontal scroll`);
          record(await page.locator('#primary-navigation a[aria-current="page"]').count() === 1, `${name} ${route} has one active nav link`);
          if (route === '/settings') {
            await page.waitForFunction(() => [...document.querySelectorAll('.kv-row')].some((row) => row.textContent.includes('API version') && row.textContent.includes('3.0.0')));
            record(true, `${name} Settings displays API version 3.0.0`);
          }
          if (route === '/diagnostics') {
            await page.waitForFunction(() => [...document.querySelectorAll('.diag-item')].some((row) => row.textContent.includes('API version') && row.textContent.includes('3.0.0')));
            record(true, `${name} Diagnostics displays API version 3.0.0`);
          }
          await checkShellSingletons(page, `${name} ${theme} ${route} hard load`);
          await checkSearchInputOwnership(page, `${name} ${theme} ${route}`);
          if (theme === 'light') await checkLightBadgeReadability(page, `${name} ${route}`);
          if (viewport.width >= 768) await inspectSidebar(page, theme, viewport, collapsed);
        }
      }
      if (name === 'Chromium') {
        for (const [route, label] of [['/', 'dashboard'], ['/routes', 'routes'], ['/devices', 'devices'], ['/diagnostics', 'gnss-diagnostics'], ['/alerts', 'alerts']]) {
          await prepare(page, { width: 1440, height: 900 }, theme, false, route);
          await saveScreenshot(page, `${label}-${theme}.png`);
        }
      }
      await checkInteractions(page, name, theme);
      for (const viewport of [
        { width: 1920, height: 996 },
        { width: 1440, height: 900 },
        { width: 1024, height: 768 },
        { width: 390, height: 844 },
      ]) await checkGeofencesToolbar(page, name, theme, viewport);
      await checkDashboardNavAtCompactHeight(page, name, theme);
      await prepare(page, { width: 1440, height: 900 }, theme, false, '/drivers');
      await checkAvatarContrast(page, `${name} ${theme} Drivers`);
      const userMenu = page.locator('.topbar .user-menu-topbar .account-chip');
      await userMenu.click();
      await page.waitForSelector('.user-menu-panel', { state: 'visible' });
      await checkAvatarContrast(page, `${name} ${theme} user menu`);
      await page.keyboard.press('Escape');
      if (name === 'Chromium' && theme === 'light') {
        await saveScreenshot(page, 'drivers-light.png');
        for (const [collapsed, file] of [[false, 'sidebar-expanded-996.png'], [true, 'sidebar-collapsed-996.png']]) {
          await prepare(page, { width: 1920, height: 996 }, theme, collapsed, '/drivers');
          await saveScreenshot(page, file);
        }
      }
      if (name === 'Chromium') {
        await prepare(page, { width: 1440, height: 900 }, theme, false, '/geofences');
        await saveScreenshot(page, `geofences-${theme}.png`);
      }
    }

    for (const theme of themes) {
      for (const collapsed of [false, true]) {
        await prepare(page, { width: 1440, height: 900 }, theme, collapsed, '/');
        for (const route of routes) {
          await page.locator(`#primary-navigation .nav-item[href="${route}"]`).click();
          await page.waitForFunction((expected) => location.pathname.replace(/\/$/, '') === expected.replace(/\/$/, ''), route);
          // Let the active-bar opacity/transform transition settle before measuring.
          await page.waitForTimeout(260);
          await inspectSidebar(page, theme, { width: 1440, height: 900 }, collapsed);
          await checkShellSingletons(page, `${name} ${theme} ${route} client navigation`);
        }
      }
    }
    await checkAuthScreens(browser, name);
    await checkAdminDashboard(browser, name);
    await checkBackendRecovery(browser, name);
    await checkReportsWithLiveSimulation(browser, name);

    await prepare(page, { width: 1440, height: 900 }, 'dark', false, '/');
    await page.evaluate(() => window.scrollTo(0, 520));
    await page.waitForTimeout(120);
    record(await page.locator('.topbar[data-scrolled="true"]').count() === 1, `${name} topbar scroll observer sets elevation`);
    await saveScreenshot(page, `${name.toLowerCase()}-topbar-scrolled.png`);
    await prepare(page, { width: 1440, height: 900 }, 'dark', false, '/tracking');
    await page.locator('.topbar .user-menu-topbar .account-chip').click();
    await page.waitForTimeout(140);
    await saveScreenshot(page, `${name.toLowerCase()}-tracking-menu-open.png`);
  } catch (error) {
    failures.push(`${name} smoke setup error: ${error.stack || error.message}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

console.log(`SMOKE ${failures.length ? 'FAIL' : 'PASS'} (${routes.length} routes × 2 themes × 2 browsers × 4 viewports)`);
for (const failure of failures) console.error(`FAILURE ${failure}`);
if (failures.length) process.exitCode = 1;
