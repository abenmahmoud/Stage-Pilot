// Real assistant and public UI; isolated synthetic identities, no deliveries or requests.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { analyzeSupportConversation } from '../api/_shared/support-agent.ts';
import { parseSupportAssistantInput } from '../shared/support-assistant-input-policy.ts';

process.env.OPENAI_API_KEY = '';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5189';
const origin = new URL(base).origin;
const out = '.vercel/qa-support-service-flow';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [390, 1440]) for (const scenario of ['own_class', 'class_unavailable', 'recovery_failed', 'public_catering']) {
    let verified = false;
    const counts = { otp: 0, classReads: 0, assistant: 0 };
    const errors = [];
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.origin !== origin) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      if (!url.pathname.startsWith('/api/')) return route.continue();
      let value = {};
      if (url.pathname === '/api/identity/device/session') value = { available: true, status: verified ? 'verified' : 'unavailable', personType: verified ? 'student' : undefined };
      else if (url.pathname === '/api/identity/device/request') value = { available: true, status: 'checking' };
      else if (url.pathname === '/api/identity/device/status') value = { status: 'choose_contact', options: [{ id: 'academic_email', type: 'email', label: 'c***@example.test' }] };
      else if (url.pathname === '/api/identity/device/select') { counts.otp++; value = { status: 'code_sent', destination: 'c***@example.test' }; }
      else if (url.pathname === '/api/identity/device/verify') {
        verified = true; value = { available: true, status: 'verified', personType: 'student', verifiedContact: { profile: 'student', firstName: 'CamilleTest', lastName: 'MartinTest', contactType: 'email', contact: 'camille@example.test' } };
      } else if (url.pathname === '/api/support/assistant') {
        counts.assistant++;
        const input = parseSupportAssistantInput(request.postDataJSON());
        assert.ok(input);
        assert.doesNotMatch(request.postData(), /CamilleTest|MartinTest|camille@example|123456/);
        value = { ...await analyzeSupportConversation({ ...input, identityVerified: verified, safetyIdentifier: 'synthetic-service-qa',
          ownClassReader: async () => {
            if (!verified) return { ok: false, reason: 'identity_required' };
            counts.classReads++;
            return scenario === 'class_unavailable' ? { ok: false, reason: 'class_unavailable' } : { ok: true, classRef: '2GT-TEST' };
          },
        }), routingReceipt: null, routingReceiptExpiresAt: null, normalizationReceipt: null, normalizationReceiptExpiresAt: null, requestActionAuthorized: false };
      } else if (url.pathname.includes('/content')) value = { items: [], pages: [], navigation: [] };
      else if (url.pathname.includes('/flash')) value = { items: [] };
      else assert.equal(request.method(), 'GET', `Unexpected mutation ${url.pathname}`);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
    });
    await page.goto(`${base}/?view=help`);
    const composer = page.getByRole('textbox', { name: 'Votre message', exact: true });
    const send = async text => { await composer.fill(text); await page.getByRole('button', { name: 'Envoyer le message', exact: true }).click(); };
    if (scenario === 'own_class' || scenario === 'class_unavailable') {
      await send('Bonjour, quelle est ma classe ?');
      await page.getByLabel('Votre profil', { exact: true }).selectOption('student');
      await page.getByLabel('Votre prénom', { exact: true }).fill('CamilleTest');
      await page.getByLabel('Votre nom', { exact: true }).fill('MartinTest');
      await page.getByRole('button', { name: 'Continuer', exact: true }).click();
      await page.getByRole('button', { name: /Par email/ }).click();
      await page.getByLabel('Code de vérification à six chiffres').fill('123456');
      await page.getByRole('button', { name: 'Vérifier', exact: true }).click();
      if (scenario === 'own_class') await page.getByText('Selon l’annuaire actif du lycée, votre classe est 2GT-TEST.', { exact: true }).waitFor();
      else await page.getByRole('button', { name: 'Préparer l’envoi', exact: true }).waitFor();
      assert.equal(counts.otp, 1);
      assert.equal(counts.classReads, 1);
      assert.equal(await page.getByLabel('Code de vérification à six chiffres').count(), 0);
      assert.equal(await composer.isVisible(), true);
      assert.equal(await page.getByRole('button', { name: 'Confirmer et envoyer', exact: true }).count(), 0);
    } else if (scenario === 'recovery_failed') {
      await send('Comment réinitialiser mon mot de passe ENT ?');
      await page.getByText('Pour récupérer votre accès, utilisez', { exact: false }).waitFor();
      await send('J’ai déjà essayé, je ne reçois aucun email.');
      await page.getByText('vous n’avez pas à refaire le même essai', { exact: false }).waitFor();
      assert.equal(await page.getByLabel('Votre prénom', { exact: true }).count(), 0);
      await send('Oui');
      const intake = page.getByRole('form', { name: 'Préparer ma demande dans le chat', exact: true });
      await intake.waitFor();
      await intake.getByRole('combobox').selectOption('eleve');
      await intake.getByLabel('Votre prénom', { exact: true }).fill('CamilleTest');
      await intake.getByLabel('Votre nom', { exact: true }).fill('MartinTest');
      await intake.getByRole('button', { name: 'Continuer', exact: true }).click();
      await intake.getByLabel('Votre adresse email', { exact: true }).fill('camille@example.test');
      await intake.getByRole('button', { name: 'Continuer', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmer et envoyer', exact: true }).waitFor();
      assert.match(await intake.innerText(), /déjà essayé/);
      assert.equal(counts.otp, 0);
    } else {
      await send('Comment payer la cantine pour mon enfant ?');
      await page.waitForFunction(() => document.querySelectorAll('.lycee-chat-message-body').length >= 3);
      assert.equal(await composer.isVisible(), true);
      assert.equal(await page.getByLabel('Code de vérification à six chiffres').count(), 0);
      assert.equal(counts.otp, 0);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${out}/${scenario}-${width}.png`, animations: 'disabled' });
    results.push({ scenario, width, ...counts, errors });
    await context.close();
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
