# LOT 3 — Écrire les envois, sans envoyer

5 septembre 2026. Plan : `docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md`.
Session unique, LOT 3 seulement, à la suite du LOT 2 (route publique et
affichage, compte rendu `PUBLIC-LOT2.md`).

## Décisions prises ce lot, à confirmer avec Adel

- **Le plan demande explicitement « SMS aux seules personnes choisies,
  jamais à un groupe ».** En relisant l'existant, ce choix était déjà acté
  ailleurs mais jamais raccordé : la colonne CHECK de
  `flash_notification_dispatches` (migration LOT 1 du plan de persistance)
  interdit déjà qu'une ligne `sms` porte un `group_ref`, et
  `FlashProposalPage.tsx` affichait déjà un sélecteur de contacts fictifs
  pour le SMS (`FICTITIOUS_FLASH_SMS_CONTACTS`) — **mais jetait le choix de
  la personne avant l'envoi au serveur**. Un test existant
  (`scripts/test-flash-proposal-page.mjs`, « le SMS reste rattaché à des
  personnes choisies... et n'est pas envoyé au serveur (pas de champ dans
  le contrat LOT 1) ») verrouillait explicitement ce trou comme une
  limitation temporaire du LOT 1. Ce LOT 3 le referme : un nouveau champ
  optionnel `smsContactRefs` (`shared/flash-proposal-input.ts`) et une
  nouvelle table `flash_info_sms_contacts` (mêmes forme et garanties que
  `flash_info_audiences`, mais séparée à dessein : elle ne gouverne ni la
  visibilité ni les canaux de groupe) portent maintenant cette liste
  jusqu'à la publication. Le test verrouillant l'ancien comportement a été
  mis à jour pour verrouiller le nouveau.
- **La correction (`FlashValidationPage.tsx` / `correction.ts`) n'a
  jamais proposé de sélection SMS**, y compris pour une urgente (elle ne
  pousse que `push`/`email` dans les canaux soumis). Ce lot n'y touche pas :
  fermer ce trou appartient au plan de publication (PLAN_FLASH_PUBLICATION,
  déjà clos) ou à un lot futur explicitement dédié, pas à ce LOT 3 dont le
  périmètre est l'écriture à la **publication**. `smsContactRefs` est donc
  optionnel dans `parseFlashProposalInput` : une correction qui ne l'envoie
  jamais reste acceptée (valeur par défaut : liste vide), sans régression.
- **Le calcul des trois ensembles d'une correction
  (`shared/flash-audience-correction.ts`) n'a pas été touché.** Il continue
  de ne compter que `status = 'sent'` comme preuve d'un envoi réel — un test
  déjà existant (`test-flash-correction.mjs`) verrouille explicitement ce
  filtre. C'est volontaire et correct : une ligne `simulated` n'est PAS un
  envoi réel, et tant que les drapeaux d'envoi restent fermés, une flash déjà
  « publiée » avec des lignes simulées ne doit PAS être traitée par une future
  correction comme si elle avait réellement notifié quelqu'un. Le risque que
  le plan appelle « le point le plus délicat » n'était donc pas de changer
  ce filtre, mais de ne jamais y laisser fuiter le statut `sent` depuis la
  nouvelle écriture — voir la preuve de wiring dédiée ci-dessous.

## Ce qui a été fait

- `shared/flash-dispatch-plan.ts` (nouveau, pur, sans base ni réseau) :
  `resolveFlashDispatchPlan({ importance, channels, groupRefs,
  smsContactRefs })` calcule exactement les lignes à écrire — normale :
  rien ; push/email : une ligne par groupe (jamais de contact) ; sms : une
  ligne par personne choisie (jamais de groupe), même contrainte que la
  colonne CHECK de `flash_notification_dispatches`. Le statut n'est jamais
  décidé ici, seulement par l'appelant.
- `shared/flash-audience-correction.ts` : `parseFlashContactRef` /
  `CONTACT_REF_PATTERN`, même motif que `parseFlashGroupRef` mais la
  longueur de la colonne `contact_ref` (7 à 119 caractères après le
  premier).
- `shared/flash-proposal-input.ts` : champ `smsContactRefs` (optionnel,
  défaut liste vide), validé et croisé avec `channels` — obligatoire et non
  vide si `sms` est choisi, refusé s'il est présent sans `sms`.
- `db/schema.ts` : table `flashInfoSmsContacts`.
- `supabase/migrations/20260905150000_add_flash_notification_dispatch_simulation.sql` :
  - étend le CHECK de `flash_notification_dispatches.status` pour accepter
    `simulated`, à côté de `sent`/`skipped`/`failed` ;
  - deux index uniques partiels (`version_id, channel, group_ref` /
    `version_id, channel, contact_ref`) pour l'idempotence au niveau base,
    en plus du garde applicatif ;
  - la table `flash_info_sms_contacts` (RLS forcée, `service_role` seul
    habilité, même politique que les autres tables flash).
- `api/flash/proposals/index.ts` : écrit `flash_info_sms_contacts` à la
  création, à côté de `flash_info_audiences`.
- `api/flash/proposals/[id]/publication.ts` (LOT 1 du plan de publication,
  complété ici) : après la transition `validee -> publiee` réussie (jamais
  dans la branche « déjà publiée », qui retourne avant tout calcul), lit
  l'audience et les contacts SMS **réels** de la version, appelle
  `resolveFlashDispatchPlan`, et insère les lignes obtenues dans
  `flash_notification_dispatches` au statut littéral `simulated` — jamais
  `sent` — avec `onConflictDoNothing()` (retombe sur les deux index uniques
  partiels de la migration, quel que soit le canal).
- `src/pages/admin/FlashProposalPage.tsx` : envoie désormais
  `smsContactRefs: smsContacts` dans le corps de la requête (au lieu de le
  jeter avant l'envoi).
- Tests : `scripts/test-flash-dispatch-plan.mjs` (nouveau, 8 cas, pur),
  `scripts/test-flash-notification-dispatch.mjs` (nouveau, preuve de wiring
  par lecture de la route — statut littéral `simulated`, jamais `sent`,
  audience/contacts lus depuis les tables réelles jamais depuis
  `req.body`, aucun appel réseau, `onConflictDoNothing` présent, retour
  anticipé avant calcul pour une version déjà publiée), plus des cas
  ajoutés à `test-flash-proposal-input.mjs` et
  `test-flash-audience-correction.mjs`, et la mise à jour du test devenu
  faux dans `test-flash-proposal-page.mjs` (voir décisions ci-dessus).

## Preuves réellement exécutées

- `npm run test:flash-dispatch-plan` (nouveau) → 8/8.
- `npm run test:flash-notification-dispatch` (nouveau) → 7/7.
- `npm run test:flash-recette` (agrégat complet, inclut désormais les deux
  scripts ci-dessus et les cas SMS ajoutés) → intégralement vert.
- `npm run test:migration-integrity` → 101 migrations, versions uniques,
  aucune référence orpheline.
- `npm run test:spec-integrity` → inchangé, vert.
- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npm run build` (`vite build`, a fonctionné dans ce shell ce soir) →
  succès, `dist/` produit.
- `npm run test:preview-security-gate` → code de sortie 0, aucun `fail`
  différent de 0 dans la sortie complète.

## Ce qui reste supposé, pas prouvé

- **Aucune preuve PostgreSQL réelle, encore une fois.** Docker Desktop
  reste indisponible dans ce shell ce soir (`docker info` échoue :
  `dockerDesktopLinuxEngine` introuvable). La migration
  `20260905150000_add_flash_notification_dispatch_simulation.sql` n'a
  jamais tourné : ni l'extension du CHECK `status`, ni les deux index
  uniques partiels, ni la nouvelle table `flash_info_sms_contacts` n'ont
  été vérifiés à l'exécution contre un PostgreSQL réel. Ce texte SQL a été
  relu, pas exécuté — même limite que `PERSIST-LOT4.md` et
  `PUBLIC-LOT2.md` avant lui.
- **L'idempotence applicative (retour anticipé sur `status === "publiee"`)
  n'a donc jamais été exercée en base réelle non plus.** Le raisonnement
  (le calcul des lignes d'envoi n'est atteint que dans la branche où la
  transition `validee -> publiee` vient réellement de réussir) est prouvé
  par lecture de la route et par la preuve de wiring dédiée, pas par une
  republication effective observée.
- **Aucune preuve navigateur.** Le changement dans `FlashProposalPage.tsx`
  (envoi de `smsContactRefs`) n'a été ni ouvert dans un navigateur ni
  capturé — seule la lecture du fichier source le vérifie.
- **La correction ne sait toujours pas choisir de personnes pour le SMS.**
  Rappel volontaire (voir décisions ci-dessus) : ni l'écran
  (`FlashValidationPage.tsx`) ni la route (`correction.ts`) ne permettent
  de faire évoluer `flash_info_sms_contacts` après la proposition initiale.
  Une correction qui voudrait ajouter ou retirer des destinataires SMS n'a
  aujourd'hui aucun moyen de le faire depuis un écran.
- **Aucun essai avec une audience ou des contacts SMS résolus en
  personnes réelles.** LOT 3 écrit des lignes par groupe (push/email) ou
  par référence de contact fictive (sms) ; la résolution de ces références
  en adresses ou numéros réels reste, comme prévu par le plan, le travail
  du LOT 4 (file durable existante, Webmail seul habilité à résoudre une
  adresse et à appeler un fournisseur).

## Portée strictement respectée

Rien d'autre que le LOT 3 n'a été touché : aucun raccordement à la file
durable de la spec 005 (LOT 4), aucun changement à la porte de l'écran de
validation (LOT 5), aucune recette PostgreSQL ou navigateur (LOT 6). Aucun
drapeau ouvert, aucun envoi réel, aucune donnée réelle, aucun `git push`.
