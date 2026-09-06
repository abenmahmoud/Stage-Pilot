// Recette navigateur réelle (Chromium local) — LOT 6 du plan du coffre de
// codes (docs/operations/PLAN_COFFRE_CODES_2026-09-05.md).
//
// Le composant `CodeVaultSecureDisplay` (LOT 4) est depuis le LOT 5
// (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`) monté sur
// `src/pages/coffre/CoffreEntInactifPage.tsx`, mais cette page ne le rend
// jamais avec une vraie valeur aujourd'hui : la route du LOT 3 ne déchiffre
// et ne renvoie toujours pas le code (voir le compte rendu du LOT 5). Ce
// script continue donc de servir le composant seul, hors de toute route
// applicative, AUCUN backend, AUCUNE authentification : via un module
// virtuel Vite (même technique que `scripts/serve-support-recovery-fixture.mjs`),
// avec une valeur et un horodatage de révélation entièrement fictifs passés
// en props — exactement ce qu'un appelant réel fera le jour où un point de
// lecture existera. Aucune valeur de code de service réel n'est manipulée.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium } from "playwright";

if (process.argv.length !== 3 || process.argv[2] !== "--local-browser-only") {
  throw new Error("local_browser_confirmation_required");
}

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_DIR = path.join(ROOT, ".vercel", "code-vault-recette");
mkdirSync(OUT_DIR, { recursive: true });

const FICTITIOUS_VALUE = "FICTIF-LOT6-9F3K-2QRT";
const port = 5199;
const harnessModule = "\0code-vault-secure-display-harness";

let assertions = 0;
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  assertions++;
};

const server = await createServer({
  root: ROOT,
  configFile: false,
  envDir: false,
  envPrefix: [],
  server: { host: "127.0.0.1", port, strictPort: true },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "code-vault-secure-display-harness",
      enforce: "pre",
      resolveId(id) {
        if (id === "/__code_vault_harness.jsx") return harnessModule;
      },
      load(id) {
        if (id === harnessModule) {
          return `
            import React from "react";
            import { createRoot } from "react-dom/client";
            import { CodeVaultSecureDisplay } from "/src/components/CodeVaultSecureDisplay.tsx";
            import "/src/index.css";
            const revealedAt = new Date();
            const root = createRoot(document.getElementById("root"));
            root.render(
              React.createElement(React.StrictMode, null,
                React.createElement("div", { style: { maxWidth: 480, margin: "0 auto", padding: 16 } },
                  React.createElement(CodeVaultSecureDisplay, {
                    service: "cantine",
                    value: ${JSON.stringify(FICTITIOUS_VALUE)},
                    revealedAt,
                  })
                )
              )
            );
            // LOT 5 (plan du 6 septembre 2026) : point d'entrée pour prouver
            // en navigateur réel que le minuteur d'effacement du
            // presse-papier survit à la sortie de l'écran plutôt que d'être
            // annulé au démontage.
            window.__unmountCodeVaultDisplay = () => root.unmount();
          `;
        }
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url, `http://127.0.0.1:${port}`);
          if (url.pathname === "/") {
            const html = await vite.transformIndexHtml(
              url.pathname,
              '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
                '<meta name="viewport" content="width=device-width, initial-scale=1">' +
                "<title>Recette locale — composant sécurisé du coffre</title></head>" +
                '<body><div id="root"></div>' +
                '<script type="module" src="/__code_vault_harness.jsx"></script></body></html>'
            );
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
            return res.end(html);
          }
          next();
        });
      },
    },
  ],
});
await server.listen();

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto(`http://127.0.0.1:${port}/`);

  const codeElement = page.getByTestId("vault-code-value");
  await codeElement.waitFor({ state: "visible", timeout: 10_000 });
  check((await codeElement.textContent())?.trim(), FICTITIOUS_VALUE, "fictitious_value_rendered_in_non_editable_code_element");

  // Aucune fuite structurelle : ni le titre, ni l'URL ne portent la valeur.
  check(await page.title(), "Recette locale — composant sécurisé du coffre", "page_title_never_carries_the_value");
  check(page.url().includes(FICTITIOUS_VALUE), false, "url_never_carries_the_value");
  check(await page.evaluate(() => document.querySelector("input") !== null), false, "value_never_rendered_in_an_editable_input");
  check(await page.evaluate(() => document.querySelector("a[download]") !== null), false, "no_downloadable_link");
  check(await page.evaluate(() => document.querySelector("table") !== null), false, "no_table_layout");

  // Compte à rebours réellement observé (pas seulement présent dans le code
  // source, contrairement au LOT 4 qui n'avait qu'une vérification statique).
  const timer = page.getByRole("timer");
  const firstReading = (await timer.textContent())?.trim();
  check(/^Expire dans \d{1,2}:\d{2}$/.test(firstReading ?? ""), true, "countdown_timer_renders_expected_format");
  await page.waitForTimeout(1_100);
  const secondReading = (await timer.textContent())?.trim();
  check(firstReading !== secondReading, true, "countdown_timer_actually_ticks_down_in_a_real_browser");

  // Recette responsive à 320, 390 et 1 440 px : pas de débordement
  // horizontal, cible tactile du bouton de copie ≥ 40 px, capture d'écran
  // pour preuve visuelle.
  const widths = [320, 390, 1440];
  const responsiveResults = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    const copyButton = page.getByRole("button", { name: "Copier le code" });
    const box = await copyButton.boundingBox();
    await page.screenshot({
      path: path.join(OUT_DIR, `code-vault-secure-display-${width}.png`),
      fullPage: true,
    });
    responsiveResults.push({ width, overflow, copyButtonHeight: box?.height ?? 0 });
  }

  for (const result of responsiveResults) {
    check(result.overflow, 0, `no_horizontal_overflow_at_${result.width}px`);
    check(result.copyButtonHeight >= 40, true, `copy_button_touch_target_at_least_40px_at_${result.width}px`);
  }

  // Copie réelle : `navigator.clipboard.writeText` exercé dans un vrai
  // contexte navigateur (permissions accordées explicitement, Chromium
  // headless seulement), jamais observé en LOT 4.
  const context = page.context();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copier le code" }).click();
  const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
  check(clipboardContent, FICTITIOUS_VALUE, "real_clipboard_copy_matches_fictitious_value");
  // L'attribut `aria-label` du bouton reste fixe ("Copier le code") : c'est
  // le TEXTE VISIBLE qui bascule sur "Copié", pas le nom accessible.
  await page.getByText("Copié", { exact: true }).waitFor({ state: "visible", timeout: 2_000 });

  // LOT 5 (plan du 6 septembre 2026) : le minuteur d'effacement doit
  // survivre à la sortie de l'écran. On démonte le composant tout de suite
  // après la copie, puis on attend plus que le délai d'effacement (30 s) :
  // avant le correctif, le `useEffect` de nettoyage annulait ce minuteur au
  // démontage et le presse-papier gardait la valeur indéfiniment.
  await page.evaluate(() => window.__unmountCodeVaultDisplay());
  await page.waitForTimeout(31_000);
  const clipboardAfterUnmount = await page.evaluate(() => navigator.clipboard.readText());
  check(clipboardAfterUnmount, "", "clipboard_cleared_even_after_leaving_the_screen_lot5_fix");

  check(consoleErrors, [], "no_console_error_in_a_real_browser_render");

  console.log(
    JSON.stringify(
      {
        assertions,
        responsiveResults,
        realBrowser: "chromium",
        realData: false,
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
  await server.close();
}
