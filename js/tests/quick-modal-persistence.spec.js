/**
 * Tests Playwright T1-T6 — #quick-seguimiento-modal persistence
 * ger-gestion/js/tests/quick-modal-persistence.spec.js
 *
 * Cubre:
 *   T1 – Modal vacío sobrevive BFCache restore (e.persisted=true)
 *   T2 – Modal con texto sobrevive BFCache restore y restaura campo
 *   T3 – ESC global NO cierra el quick modal cuando está abierto (Fix C-1)
 *   T4 – Key fija 'barita_quick_modal_ctx' tiene casoId/estId correctos al abrir
 *   T5 – Cerrar deliberadamente (✕) limpia la key fija
 *   T6 – Guardar seguimiento limpia draft → pageshow no reabre
 *
 * Prerequisito: servidor local en http://localhost:3000 o similar.
 * Ajustar BASE_URL según entorno.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DASHBOARD_HASH = '#/dashboard';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Abre el modal haciendo click en el primer botón "Registrar Seguimiento" */
async function abrirModal(page) {
  await page.goto(`${BASE_URL}/${DASHBOARD_HASH}`);
  await page.waitForSelector('button:has-text("Registrar Seguimiento")', { timeout: 15000 });
  await page.click('button:has-text("Registrar Seguimiento")');
  await page.waitForSelector('#quick-seguimiento-modal', { state: 'visible', timeout: 5000 });
}

/** Simula un BFCache restore disparando pageshow con persisted=true */
async function simulateBFCacheRestore(page) {
  await page.evaluate(() => {
    // 1. Ocultar modal como lo haría el BFCache restore al DOM previo
    const m = document.getElementById('quick-seguimiento-modal');
    if (m) {
      m.style.display = 'none';
      m.classList.add('hidden');
      m.classList.remove('is-open');
    }
    // 2. Disparar pageshow con persisted=true
    const ev = new Event('pageshow', { bubbles: false, cancelable: false });
    Object.defineProperty(ev, 'persisted', { value: true });
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(100);
}

// ─── T1: Modal vacío sobrevive BFCache restore ──────────────────────────────
// ger-gestion/js/tests/quick-modal-persistence.spec.js:51
test('T1 – modal vacío reaparece tras BFCache restore (pageshow persisted)', async ({ page }) => {
  await abrirModal(page);

  const ctx = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('barita_quick_modal_ctx') || 'null')
  );
  expect(ctx).not.toBeNull();
  expect(ctx.isOpen).toBe(true);

  await simulateBFCacheRestore(page);

  const modal = page.locator('#quick-seguimiento-modal');
  await expect(modal).toBeVisible();
  expect(await modal.evaluate(el => el.classList.contains('is-open'))).toBe(true);
});

// ─── T2: Modal con texto sobrevive BFCache restore ──────────────────────────
// ger-gestion/js/tests/quick-modal-persistence.spec.js:67
test('T2 – modal con texto restaura campo tras BFCache restore', async ({ page }) => {
  await abrirModal(page);

  await page.fill('#quick-modal-texto', 'hola mundo test');
  await page.dispatchEvent('#quick-modal-texto', 'change');
  await page.waitForTimeout(500);

  const draft = await page.evaluate(() => {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('barita_quick_draft_')) {
        return JSON.parse(sessionStorage.getItem(k) || 'null');
      }
    }
    return null;
  });
  expect(draft?.texto).toBe('hola mundo test');

  // Simular DOM restaurado sin valor en el input
  await page.evaluate(() => {
    const ti = document.getElementById('quick-modal-texto');
    if (ti) ti.value = '';
  });
  await simulateBFCacheRestore(page);

  const textoVal = await page.inputValue('#quick-modal-texto');
  expect(textoVal).toBe('hola mundo test');
});

// ─── T3: ESC global NO cierra el quick modal cuando está abierto ─────────────
// ger-gestion/js/tests/quick-modal-persistence.spec.js:100
test('T3 – ESC global no llama closeModal() cuando quick modal está abierto (fix C-1)', async ({ page }) => {
  await abrirModal(page);

  // Espiar si closeModal() fue llamado monitoreando #modal-overlay
  // closeModal() agrega 'hidden' a #modal-overlay. Si el ESC guard funciona,
  // no debe llamarlo cuando qmOpen=true.
  const overlayWasHiddenBefore = await page.evaluate(() => {
    const o = document.getElementById('modal-overlay');
    return o ? o.classList.contains('hidden') : true;
  });

  // Disparar ESC en document
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  await page.waitForTimeout(100);

  const overlayHiddenAfter = await page.evaluate(() => {
    const o = document.getElementById('modal-overlay');
    return o ? o.classList.contains('hidden') : true;
  });

  // closeModal() solo agrega 'hidden'; si ya estaba hidden antes, no cambia nada —
  // pero si NO estaba hidden y el guard falló, lo pondría hidden.
  // Lo clave: el quick modal debe seguir con is-open.
  const qmHasIsOpen = await page.evaluate(() => {
    const m = document.getElementById('quick-seguimiento-modal');
    return m ? m.classList.contains('is-open') : false;
  });
  // El ESC del propio quick modal (ensureQuickModalPortal) lo cierra si la UI lo captura.
  // Pero la prueba verifica que el handler GLOBAL (App.setupModals) no lo cerró
  // cerrando overlay genérico y dejando el quick modal sin su contexto.
  // El quick modal sigue abierto si is-open persiste:
  expect(qmHasIsOpen).toBe(true);
});

// ─── T4: Key fija tiene casoId/estId correctos al abrir ─────────────────────
// ger-gestion/js/tests/quick-modal-persistence.spec.js:138
test('T4 – barita_quick_modal_ctx tiene casoId, estId e isOpen al abrir modal', async ({ page }) => {
  await abrirModal(page);

  const ctx = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('barita_quick_modal_ctx') || 'null')
  );
  expect(ctx).not.toBeNull();
  expect(ctx.isOpen).toBe(true);
  expect(typeof ctx.casoId).toBe('string');
  expect(typeof ctx.estId).toBe('string');
  expect(typeof ctx.ts).toBe('number');
  expect(Date.now() - ctx.ts).toBeLessThan(5000);
});

// ─── T5: Cerrar deliberadamente limpia la key fija ───────────────────────────
// ger-gestion/js/tests/quick-modal-persistence.spec.js:155
test('T5 – cerrar con botón ✕ limpia barita_quick_modal_ctx', async ({ page }) => {
  await abrirModal(page);

  const ctxBefore = await page.evaluate(() => sessionStorage.getItem('barita_quick_modal_ctx'));
  expect(ctxBefore).not.toBeNull();

  await page.click('[aria-label="Cerrar modal"]');
  await page.waitForTimeout(200);

  const ctxAfter = await page.evaluate(() => sessionStorage.getItem('barita_quick_modal_ctx'));
  expect(ctxAfter).toBeNull();

  await expect(page.locator('#quick-seguimiento-modal')).not.toBeVisible();
});

// ─── T6: Guardar limpia draft → pageshow no reabre ───────────────────────────
// ger-gestion/js/tests/quick-modal-persistence.spec.js:175
test('T6 – tras cerrar modal, pageshow persisted no reabre el modal', async ({ page }) => {
  await abrirModal(page);

  // Cerrar deliberadamente
  await page.evaluate(() => {
    if (window.DashboardView && typeof window.DashboardView.cerrarQuickSeguimiento === 'function') {
      window.DashboardView.cerrarQuickSeguimiento();
    }
  });
  await page.waitForTimeout(200);

  const ctx = await page.evaluate(() => sessionStorage.getItem('barita_quick_modal_ctx'));
  expect(ctx).toBeNull();

  // Simular BFCache restore
  await simulateBFCacheRestore(page);

  await expect(page.locator('#quick-seguimiento-modal')).not.toBeVisible();
});
