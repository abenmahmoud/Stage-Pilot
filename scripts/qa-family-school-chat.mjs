// Isolated browser recipe: real chat + validators + deterministic readers, only fictitious records.
// node --import ./scripts/ts-test-resolver.mjs --experimental-strip-types scripts/qa-family-school-chat.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseSupportAssistantInput } from '../shared/support-assistant-input-policy.ts';
import { analyzeSupportConversation } from '../api/_shared/support-agent.ts';
import { familySchoolChatService } from '../api/_shared/family-school-chat-service.ts';
import { isValidSupportAssistantPayload } from '../shared/support-assistant-payload-policy.ts';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:4186';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Only a local isolated server is allowed');
process.env.OPENAI_API_KEY = '';
const out = '../Preparation_agent_2026-09-12/02_Controles/qa-family-school-chat';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true }), results = [];
try {
  for (const width of [1440, 390, 320]) for (const scenario of ['linked_parent', 'otp_parent', 'missing_timetable']) {
    const now = new Date(), expiresAt = new Date(now.getTime() + 30 * 60_000);
    let verified = scenario !== 'otp_parent';
    const identity = { id: 'fixture-session', institutionId: 'fixture-school', sourceImportId: 'fixture-import', personRef: 'fixture-parent', personType: 'guardian', expiresAt };
    const targets = [{ key: 'a'.repeat(64), personRef: 'fixture-child-one', classRef: '2GT1', label: 'Enfant 1 · 2GT1' }, { key: 'b'.repeat(64), personRef: 'fixture-child-two', classRef: '2GT2', label: 'Enfant 2 · 2GT2' }];
    const counts = { assistant: 0, schedule: 0, otp: 0, choice: 0, rejected: 0 }, wires = [], errors = [];
    const context = await browser.newContext({ viewport: { width, height: 940 }, locale: 'fr-FR', serviceWorkers: 'block' });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    if (scenario === 'linked_parent') await page.clock.install({ time: now });
    page.on('pageerror', e => errors.push(e.message));
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== new URL(base).origin) return route.fulfill({ json: {} });
      if (!url.pathname.startsWith('/api/')) return route.continue();
      let value = {};
      if (url.pathname === '/api/identity/device/session') {
        assert.equal(req.method(), 'GET');
        value = { available: true, status: verified ? 'verified' : 'unavailable', ...(verified ? { personType: 'guardian', expiresAt: expiresAt.toISOString() } : {}) };
      } else if (url.pathname === '/api/identity/device/request') {
        value = { available: true, status: 'checking' };
      } else if (url.pathname === '/api/identity/device/status') {
        value = { status: 'choose_contact', options: [{ id: 'phone', type: 'phone', label: '06 ** ** ** 57' }] };
      } else if (url.pathname === '/api/identity/device/select') {
        counts.otp++; value = { status: 'code_sent', destination: '06 ** ** ** 57' };
      } else if (url.pathname === '/api/identity/device/verify') {
        verified = true;
        value = { available: true, status: 'verified', personType: 'guardian', expiresAt: expiresAt.toISOString(), verifiedContact: { profile: 'guardian', firstName: 'ParentTest', lastName: 'ExempleTest', contactType: 'phone', contact: '+33600000057' } };
      } else if (url.pathname === '/api/support/assistant') {
        counts.assistant++;
        const input = parseSupportAssistantInput(req.postDataJSON());
        if (!input) { counts.rejected++; return route.fulfill({ status: 400, json: { error: 'Invalid fixture input' } }); }
        wires.push(input);
        assert.doesNotMatch(JSON.stringify(input.messages), /Mathématiques|fixture-child|ParentTest|ExempleTest|33600000057/);
        value = { ...await analyzeSupportConversation({ ...input, now, safetyIdentifier: 'isolated-family-recipe', identityVerified: verified,
          familySchoolReader: intent => familySchoolChatService(intent, input.schoolTargetKey, {
            identity: async () => verified ? identity : null,
            targets: async () => targets,
            schedule: async (target, bounds) => {
              counts.schedule++; assert.equal(target.personRef, targets[1].personRef, 'Only the explicitly chosen child may be read');
              if (scenario === 'missing_timetable') return { ok: false, reason: 'source_unavailable' };
              const startsAt = new Date(bounds.dayStart.getTime() + 8 * 3600_000), endsAt = new Date(startsAt.getTime() + 3600_000);
              return { ok: true, courses: [{ subjectCode: 'MATH', subjectLabel: 'Mathématiques', roomCode: '204', startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), state: 'scheduled' }],
                source: { versionId: 'fixture-private-version', sourceType: 'official_export', activatedAt: now.toISOString(), freshUntil: new Date(now.getTime() + 7 * 86400_000).toISOString() } };
            },
          }),
        }), routingReceipt: null, routingReceiptExpiresAt: null, normalizationReceipt: null, normalizationReceiptExpiresAt: null, requestActionAuthorized: false };
        assert.ok(isValidSupportAssistantPayload(value), 'Server result satisfies the real browser contract');
        if (value.schoolTargets) counts.choice++;
      } else if (url.pathname.includes('content')) value = { items: [], pages: [], navigation: [] };
      else if (url.pathname.includes('flash')) value = { items: [] };
      else assert.equal(req.method(), 'GET', `Unexpected write: ${url.pathname}`);
      return route.fulfill({ json: value });
    });
    try {
      await page.goto(`${base}/?view=help`);
      const composer = page.getByRole('textbox', { name: 'Votre message', exact: true });
      const send = page.getByRole('button', { name: 'Envoyer le message', exact: true });
      await composer.fill('Je veux les cours de mon enfant'); await send.click();
      if (!verified) {
        await page.getByLabel('Votre profil', { exact: true }).selectOption('guardian');
        await page.getByLabel('Votre prénom', { exact: true }).fill('ParentTest');
        await page.getByLabel('Votre nom', { exact: true }).fill('ExempleTest');
        await page.getByRole('button', { name: 'Continuer', exact: true }).click();
        await page.getByRole('button', { name: /Par SMS/ }).click();
        await page.getByLabel('Code de vérification à six chiffres').fill('123456');
        await page.getByRole('button', { name: 'Vérifier', exact: true }).click();
      }
      const choice = page.getByRole('group', { name: 'Choisir l’enfant concerné' });
      await choice.waitFor();
      assert.equal(await page.locator('.lycee-guided-thread [data-speaker="requester"]').count(), 1);
      assert.equal(counts.schedule, 0);
      await choice.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/${scenario}-${width}-choices.png`, animations: 'disabled' });
      await choice.getByRole('button', { name: 'Enfant 2 · 2GT2', exact: true }).click();
      await page.getByText('Enfant 2 · 2GT2 : souhaitez-vous consulter', { exact: false }).waitFor();
      assert.equal(await page.locator('.lycee-guided-thread [data-speaker="requester"]').count(), 1, 'Choosing a child resumes the same question');
      await composer.fill('Demain'); await send.click();
      if (scenario === 'missing_timetable') {
        await page.getByText("Aucun emploi du temps validé n'est disponible", { exact: false }).waitFor();
        assert.equal(await composer.isVisible(), true);
        assert.equal(await page.getByRole('button', { name: 'Confirmer et envoyer', exact: true }).count(), 0);
      } else {
        const card = page.getByRole('region', { name: 'Enfant 2 · 2GT2 · Demain', exact: true });
        await card.waitFor(); assert.match(await card.innerText(), /Mathématiques/);
        await card.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/${scenario}-${width}-schedule.png`, animations: 'disabled' });
        // A new subject drops the selection and never retransmits the private answer.
        await composer.fill('Je veux la classe de mon enfant'); await send.click();
        await choice.waitFor(); assert.equal(wires.at(-1).schoolTargetKey, undefined);
        await choice.getByRole('button', { name: 'Enfant 2 · 2GT2', exact: true }).click();
        await page.getByText('la classe indiquée dans l’annuaire actif du lycée est 2GT2', { exact: false }).waitFor();
        if (scenario === 'linked_parent') {
          await page.clock.fastForward(31 * 60_000);
          await page.getByLabel('Votre profil', { exact: true }).waitFor();
          assert.equal(await page.getByRole('region', { name: /Enfant 2/ }).count(), 0, 'Expired identity clears private timetable');
          assert.equal(await page.getByText('la classe indiquée dans l’annuaire actif du lycée est 2GT2', { exact: false }).count(), 0);
        }
      }
      assert.equal(counts.schedule, 1); assert.equal(counts.otp, scenario === 'otp_parent' ? 1 : 0); assert.equal(counts.rejected, 0);
      assert.equal(await page.getByLabel('Code de vérification à six chiffres').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(errors, []);
      results.push({ width, scenario, ...counts, errors, horizontalOverflow: false });
    } catch (error) {
      await page.screenshot({ path: `${out}/failure-${scenario}-${width}.png`, fullPage: true });
      await writeFile(`${out}/failure-${scenario}-${width}.txt`, await page.locator('body').innerText());
      throw error;
    } finally { await context.close(); }
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
