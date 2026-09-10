// Browser regression with real input validation and assistant, isolated fake identity/EDT.
// Run: node --import ./scripts/ts-test-resolver.mjs --experimental-transform-types scripts/qa-assistant-identity-continuity.mjs
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { parseSupportAssistantInput } from '../shared/support-assistant-input-policy.ts';
import { analyzeSupportConversation } from '../api/_shared/support-agent.ts';

process.env.OPENAI_API_KEY = '';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5189';
const origin = new URL(base).origin;
const out = '.vercel/qa-identity-continuity';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [390, 1440]) {
    for (const scenario of ['existing_session', 'otp', 'network_retry', 'missing_timetable']) {
      let verified = scenario === 'existing_session';
      let failedOnce = false;
      const counts = { request: 0, select: 0, verify: 0, assistant: 0, rejected: 0, reads: 0 };
      const errors = [];
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', async route => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.origin !== origin) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        if (!url.pathname.startsWith('/api/')) return route.continue();
        let value = {};
        let status = 200;
        if (url.pathname === '/api/identity/device/session') {
          assert.equal(req.method(), 'GET');
          value = { available: true, status: verified ? 'verified' : 'unavailable', personType: verified ? 'staff' : undefined };
        } else if (url.pathname === '/api/identity/device/request') {
          counts.request++;
          value = { available: true, status: 'checking' };
        } else if (url.pathname === '/api/identity/device/status') {
          value = { status: 'choose_contact', options: [{ id: 'phone', type: 'phone', label: '06 ** ** ** 57' }, { id: 'academic_email', type: 'email', label: 'c***@example.test' }] };
        } else if (url.pathname === '/api/identity/device/select') {
          counts.select++;
          value = { status: 'code_sent', destination: '06 ** ** ** 57' };
        } else if (url.pathname === '/api/identity/device/verify') {
          counts.verify++;
          verified = true;
          value = { available: true, status: 'verified', personType: 'staff', verifiedContact: { profile: 'staff', firstName: 'CamilleTest', lastName: 'MartinTest', contactType: 'phone', contact: '+33600000057' } };
        } else if (url.pathname === '/api/support/assistant') {
          counts.assistant++;
          assert.doesNotMatch(req.postData(), /CamilleTest|MartinTest|33600000057|123456/);
          const input = parseSupportAssistantInput(req.postDataJSON());
          if (!input) {
            counts.rejected++;
            status = 400;
            value = { error: 'La demande est invalide' };
          } else if (scenario === 'network_retry' && counts.assistant === 3 && !failedOnce) {
            failedOnce = true;
            status = 503;
            value = { error: 'Service temporairement indisponible' };
          } else {
            value = {
              ...await analyzeSupportConversation({
                ...input, identityVerified: verified, safetyIdentifier: 'isolated-continuity-test', now: new Date('2026-09-10T08:00:00Z'),
                scheduleDayReader: async () => {
                  assert.equal(verified, true, 'No private schedule before verification');
                  counts.reads++;
                  if (scenario === 'missing_timetable') return { ok: false, reason: 'source_unavailable' };
                  return { ok: true, courses: [{ subjectCode: 'MATH', subjectLabel: 'Mathématiques', roomCode: 'B204', startsAt: '2026-09-11T06:00:00.000Z', endsAt: '2026-09-11T07:00:00.000Z', state: 'scheduled' }], source: { versionId: '00000000-0000-4000-8000-000000000001', sourceType: 'official_export', activatedAt: '2026-09-10T06:00:00.000Z', freshUntil: '2026-09-15T22:00:00.000Z' } };
                },
              }),
              routingReceipt: null, routingReceiptExpiresAt: null, normalizationReceipt: null, normalizationReceiptExpiresAt: null, requestActionAuthorized: false,
            };
          }
        } else if (url.pathname.includes('/content')) value = { items: [], pages: [], navigation: [] };
        else if (url.pathname.includes('/flash')) value = { items: [] };
        else assert.equal(req.method(), 'GET', `Unexpected mutation: ${url.pathname}`);
        return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
      });
      await page.goto(`${base}/?view=help`);
      const composer = page.getByRole('textbox', { name: 'Votre message', exact: true });
      const send = page.getByRole('button', { name: 'Envoyer le message', exact: true });
      await composer.fill('Bonjour, je souhaite mon emploi du temps.');
      await send.click();
      if (!verified) {
        await page.getByLabel('Votre profil', { exact: true }).selectOption('staff');
        await page.getByLabel('Votre prénom', { exact: true }).fill('CamilleTest');
        await page.getByLabel('Votre nom', { exact: true }).fill('MartinTest');
        await page.getByRole('button', { name: 'Continuer', exact: true }).click();
        await page.getByRole('button', { name: /Par SMS/ }).waitFor();
        assert.equal(counts.select, 0);
        await page.getByRole('button', { name: /Par SMS/ }).click();
        await page.getByLabel('Code de vérification à six chiffres').fill('123456');
        await page.getByRole('button', { name: 'Vérifier', exact: true }).click();
      }
      await page.getByText('Souhaitez-vous consulter vos cours', { exact: false }).waitFor();
      await composer.fill('Demain');
      await send.click();
      if (scenario === 'network_retry') {
        await page.getByText('Je n’ai pas pu poursuivre cet échange', { exact: false }).waitFor();
        await page.getByRole('button', { name: 'Réessayer ma demande', exact: true }).click();
      }
      if (scenario === 'missing_timetable') {
        await page.getByText("Aucun emploi du temps validé n'est disponible", { exact: false }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Confirmer et envoyer', exact: true }).count(), 0);
        assert.equal(await composer.isVisible(), true, 'An offer must keep the chat open');
        await page.getByRole('button', { name: 'Préparer l’envoi', exact: true }).click();
        await page.getByRole('button', { name: 'Confirmer et envoyer', exact: true }).waitFor();
      } else {
        const answer = page.getByRole('region', { name: 'Votre emploi du temps de demain', exact: true });
        await answer.waitFor();
        assert.match(await answer.innerText(), /08:00/);
        assert.match(await answer.innerText(), /09:00/);
        assert.match(await answer.innerText(), /Mathématiques/);
        assert.match(await answer.innerText(), /Salle B204/);
        const popupPromise = context.waitForEvent('page');
        await answer.getByRole('button', { name: 'Imprimer / PDF' }).click();
        const popup = await popupPromise;
        await popup.getByRole('table').waitFor();
        assert.match(await popup.locator('table').innerText(), /B204/);
        assert.equal(await popup.evaluate(() => window.opener === null), true);
        await popup.close();
        await answer.scrollIntoViewIfNeeded();
        assert.equal(await page.getByRole('button', { name: 'Confirmer et envoyer', exact: true }).count(), 0);
      }
      assert.equal(counts.rejected, 0);
      assert.equal(counts.reads, 1);
      assert.equal(counts.request, scenario === 'existing_session' ? 0 : 1);
      assert.equal(counts.select, counts.request);
      assert.equal(counts.verify, counts.request);
      assert.equal(counts.assistant, scenario === 'network_retry' ? 4 : 3);
      assert.equal(await page.getByLabel('Code de vérification à six chiffres').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${out}/${scenario}-${width}.png`, animations: 'disabled' });
      results.push({ scenario, width, ...counts, errors });
      await context.close();
    }
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
