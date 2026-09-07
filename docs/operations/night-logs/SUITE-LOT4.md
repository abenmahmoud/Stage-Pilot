# LOT 4 — Remettre CLAUDE.md à jour

Plan : `docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md`, §LOT 4.
Portée stricte : corriger le texte d'état contre l'état réel de
`specs/002-agent-etablissement-adaptatif/tasks.md`. Aucune règle de
sécurité touchée, aucun code touché.

## Constat vérifié dans tasks.md

Grep ciblé sur `T071` et `T064` (pas de lecture intégrale du fichier) :

- `T071`, `T071A`, `T071B`, `T071C`, `T071D`, `T071E`, `T071F` sont toutes
  `[x]` (closes). La CLAUDE.md précédente affirmait le contraire pour
  T071/T071A/T071B/T071C/T071E, en citant `PERSIST-LOT9.md` — texte devenu
  faux depuis la clôture du plan de publication publique du 5 septembre 2026.
- `T071F` (close) est précisément ce qui a comblé le « trou bloquant » cité
  par l'ancien texte : elle a ouvert la route `POST
  /api/flash/proposals/[id]/publication` (`validee` -> `publiee`).
- `T071G` existe et reste `[ ]` (ouverte) : corriger une information déjà
  publiée la fait aujourd'hui disparaître du site public, ce qui est
  l'inverse de l'intention de la règle de correction. C'est le seul vrai
  trou restant sur ce domaine — l'ancienne CLAUDE.md ne le mentionnait pas
  du tout puisqu'il a été créé après elle.
- `T064` (coffre de codes Koxo/ENT/cantine) est `[x]`, preuve
  `docs/operations/night-logs/BRANCHE-LOT7.md` — absente de l'ancienne
  CLAUDE.md, comme signalé par le plan.
- `T064A` (décision administration sur remise de code à un parent) reste
  `[ ]` ouverte.
- `T010B4B` reste `[ ]` ouverte — l'ancienne mention restait exacte, gardée
  telle quelle.

## Modification faite

Dans `CLAUDE.md` :
- Le paragraphe « Trou bloquant » de la section « Informations flash —
  persistance » est réécrit : il annonce que T071F a comblé le trou le
  5 septembre 2026, liste la famille T071 comme close, et signale T071G
  comme le trou réel restant (avec la décision d'Adel du 5 septembre 2026
  à implémenter).
- La section « État au 3 septembre 2026 » devient « État au 6 septembre
  2026 » : T010B4B reste listée ouverte (inchangé), T064 est ajoutée comme
  close avec sa preuve, T064A est ajoutée comme ouverte. Le compteur de
  migrations est corrigé de 94 à 111 (compté réellement dans
  `supabase/migrations/`, voir preuve ci-dessous) ; le blocage Docker
  Desktop est reformulé en « à revérifier » plutôt que réaffirmé comme
  vrai aujourd'hui, faute de round PostgreSQL réel exécuté dans ce lot pour
  le confirmer.

Aucune règle de sécurité, aucun `Interdit absolu`, aucune commande utile
n'a été modifiée.

## Preuves exécutées dans ce lot

- `ls supabase/migrations | grep -c '\.sql$'` → `111` (compte réel des
  fichiers de migration, utilisé pour corriger le chiffre caduc).
- `npm run test:preview-security-gate` → vert (tous les sous-tests,
  y compris `test:migration-integrity` qui confirme `"migrations":111`).
- `npm run test:spec-integrity` → vert,
  `"002-agent-etablissement-adaptatif":{"completed":229,"open":71}`.

Non vérifié dans ce lot (hors périmètre LOT 4, pas de recette PostgreSQL
relancée) : l'état réel de la pile Supabase locale et si les 111 migrations
rejouent proprement aujourd'hui. C'est pourquoi le texte dit désormais « à
revérifier » plutôt que d'affirmer un blocage daté du dernier lot.

## Ce qui reste

- Rien d'autre n'était dans le périmètre du LOT 4. Le LOT 5 (clôture
  honnête) et ses contrôles (`tsc --noEmit`, `vite build`,
  `test:preview-security-gate`, `test:spec-integrity`) ne sont pas dans ce
  lot.
