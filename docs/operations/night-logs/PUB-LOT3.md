# LOT 3 — Brancher la publication et la correction dans l'écran (clôture)

Plan : `docs/operations/PLAN_FLASH_PUBLICATION_2026-09-05.md`, section LOT 3.
Session Claude Code du 5 septembre 2026, branche `codex/lycee-connect-prototype`.
Aucun `git push`. Un seul commit local pour ce lot.

## Ce qui est prouvé par une commande exécutée

- **Bouton de publication branché.** Nouvelle route
  `GET /api/flash/validation/publishable.ts` : jumelle exacte de
  `api/flash/validation/queue.ts` (LOT 3 du plan de persistance), filtrée sur
  `status = 'validee'`, triée par `expiresAt` croissant, même accès
  (`assertFlashValidationQueueAccess`) et même calcul d'autorisation par item
  (`decideFlashValidationAccess`) que la file de validation — publier suit
  exactement la même règle que valider (§13), jamais un contrôle réécrit sur
  place. `FlashValidationPage.tsx` l'appelle, affiche l'état ("Validée") et
  l'échéance, et pose un bouton "Publier" qui appelle
  `POST /api/flash/proposals/[id]/publication` (route du LOT 1, jusqu'ici
  inatteignable par aucun écran). La réponse `alreadyPublished` est distinguée
  à l'écran (message différent, pas une seconde publication silencieuse).
- **Correction après publication enfin branchée (T071B).** Nouvelle route
  `GET /api/flash/validation/published.ts` : filtrée sur `status = 'publiee'`,
  renvoie pour chaque version son audience RÉELLE (`flash_info_audiences`, via
  une seconde requête à plat puis un regroupement en mémoire — jamais une
  sous-requête corrélée Drizzle, piège déjà payé et documenté dans
  `CLAUDE.md`). L'écran affiche chaque information publiée, ouvre un
  formulaire de correction préfrempli avec le texte, l'importance, les
  canaux, l'expiration et le public RÉELS de la version courante (jamais
  ressaisis à l'aveugle), puis appelle
  `POST /api/flash/proposals/[id]/correction` — la route écrite au LOT 4 du
  plan de persistance et jamais appelée par aucun écran jusqu'à ce soir.
- **Les trois ensembles, leurs effectifs et leurs trois textes sont affichés
  (T071B).** Après confirmation, l'écran affiche les compteurs maintenus/
  retirés/ajoutés renvoyés par la route (`audienceTreatment`, calculée côté
  serveur par `resolveFlashAudienceTreatment`, jamais recalculée côté client)
  et les trois textes fixes décrits par la tâche : "reçoivent l'information
  corrigée" (maintenus), "reçoivent une ligne sans détail signalant que cette
  information ne les concerne plus" (retirés), "reçoivent l'information comme
  neuve, jamais présentée comme une correction" (ajoutés). `gapKind`
  (décisif/forme) et les canaux réellement concernés (`eligibleChannels`,
  `correctionPossible`) sont affichés aussi. Voir "Ce qui reste supposé" pour
  la limite explicite de cet affichage (un compte-rendu après coup, pas un
  aperçu avant confirmation).
- **Audience et nom de l'auteur remontés, honnêtement partiels.** Nouveau
  module `api/_shared/flash-author.ts` : `resolveFlashAuthorNames` résout le
  nom via la seule fiche reliée à un compte auth qui existe dans ce schéma
  (`professeurs.auth_user_id`) — `administration`, `agent`, `proviseur` et
  `superadmin` (les autres rôles de `FLASH_ACTOR_ROLES`) n'ont aucune fiche
  équivalente dans ce dépôt, donc aucun nom pour eux : `null`, jamais une
  supposition. `formatFlashAuthorName` (partie pure) est testée isolément
  (`scripts/test-flash-author.mjs`, 4 tests). `queue.ts`, `publishable.ts` et
  `published.ts` renvoient `proposedByName` ; `published.ts` renvoie aussi
  `audience`. Les deux nouveaux champs ont leur propre contrat strict
  (`isValidFlashAudiencePayload`, `isValidFlashAuthorNamePayload` dans
  `shared/flash-payload-policy.ts` ; `toFlashAudiencePayload`,
  `toFlashAuthorNamePayload` dans `api/_shared/flash-response.ts`, même garde
  500 que le reste du fichier).
- **Avertissements devenus faux retirés, pas remplacés par un autre excès.**
  Le bandeau de l'écran ne dit plus que l'audience et le nom de l'auteur "ne
  sont pas encore renvoyés" (faux depuis ce soir, pour ce que ce schéma permet
  de résoudre) ni que "la correction après publication n'est pas branchée"
  (faux). Il dit maintenant précisément ce qui reste vrai : le nom n'est
  affiché que pour les comptes liés à une fiche professeur, et la
  modification du texte AVANT validation (distincte de la correction après
  publication) reste hors de cet écran — elle ne fait pas partie du
  périmètre du LOT 3. Le message affiché après une validation ne prétend
  plus que "la publication n'est pas encore branchée". Un test verrouillé
  (`scripts/test-flash-validation-page.mjs`) interdit désormais explicitement
  la réapparition de ces deux phrases fausses (`assert.doesNotMatch`).
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npm run build` (`vite build`) : succès, ~8-10 s selon le run, deux fois de
  suite (avant et après le correctif ci-dessous).
- `npm run test:flash-recette` : suite complète, `EXIT:0`, aucun `✖` ni
  `not ok` dans le journal complet. Compte 8 nouveaux tests de wiring
  (`test-flash-publishable-queue.mjs`, `test-flash-published-queue.mjs`), 4
  nouveaux tests unitaires (`test-flash-author.mjs`), 6 nouvelles assertions
  de contrat (`test-flash-payload-policy.mjs`), et la mise à jour de
  `test-flash-validation-page.mjs` (nouvelles routes appelées, nouveaux
  contrats vérifiés, ancienne assertion sur le bandeau remplacée par son
  contraire — la seule qui devait changer, exactement là où le plan demandait
  de changer le fond).
- `npm run test:preview-security-gate` : suite complète, `EXIT:0`, aucun `✖`.
- `npm run test:spec-integrity` : 5 specs, 634 tâches, aucune anomalie
  (inchangé : aucune tâche cochée ce soir, voir plus bas).
- `npm run test:migration-integrity` : 100 migrations, 100 versions uniques,
  77 références vérifiées (inchangé : ce lot n'ajoute aucune migration, les
  colonnes/états nécessaires — `published_by`, `expiree_sans_publication` —
  existent déjà depuis les LOT 1 et LOT 2 de ce plan).
- **Un bug réel trouvé et corrigé avant commit** : le panneau de résultat de
  correction était d'abord rendu à l'intérieur de la carte de l'information
  publiée (`published.map`). Comme la correction fait passer le statut à
  `modifiee` (état terminal), l'élément disparaît de la liste `published` dès
  le premier rafraîchissement qui suit — le panneau de résultat ne se serait
  donc jamais affiché en pratique. Déplacé en carte indépendante, affichée
  tant que `correctionResult` est renseigné, indépendamment de la liste.
  Trouvé par relecture du flux de données avant commit, pas par un test
  automatisé (aucun rendu réel n'a eu lieu ce soir, voir plus bas) : signalé
  explicitement ici pour qu'une future session sache que ce point mériterait
  un test de rendu réel (LOT 4, recette navigateur).

## Ce qui reste supposé, pas prouvé

- **Aucune recette PostgreSQL réelle, aucune recette navigateur réelle ce
  soir.** Docker Desktop non vérifié disponible dans ce shell ce soir (piège
  déjà documenté dans `CLAUDE.md` et constaté aux LOT 1/LOT 2 de ce même
  plan) ; ce lot ne l'a pas retenté, la consigne du plan renvoyant cette
  recette au LOT 4 dédié. Conséquence directe : aucun des deux nouveaux
  `SELECT` (publishable.ts, published.ts) n'a été exécuté contre une vraie
  base, la jointure `professeurs.auth_user_id` n'a jamais tourné, le
  formulaire de correction n'a jamais été rempli ni soumis dans un navigateur
  réel, et le bug de rendu corrigé ci-dessus n'a été vérifié que par lecture
  du flux de données, pas par un clic réel. Tout ce qui précède est une
  preuve de composition (types, wiring par lecture de source, `build`, gate
  de sécurité), pas une preuve d'exécution bout en bout.
- **Le nom de l'auteur reste `null` pour la majorité des rôles habilités à
  proposer une flash.** `FLASH_ACTOR_ROLES` inclut `superadmin`,
  `administration`, `agent`, `proviseur`, `professeur` — seul ce dernier a
  une fiche nommée dans ce schéma. Un compte `administration` ou `proviseur`
  reste affiché comme "compte xxxxxxxx…" partout, y compris dans les
  nouvelles listes. Le bandeau de l'écran le dit maintenant explicitement ;
  ce n'est pas un défaut caché, mais ce n'est pas non plus résolu.
- **Les deux listes d'échecs (`expired.ts`, T071D et
  `expired-after-validation.ts`, T071F) n'ont pas reçu `proposedByName` ni
  `audience`.** Choix délibéré pour contenir le périmètre de ce lot à ce que
  les nouveaux boutons exigent réellement (publier, corriger) plutôt que de
  toucher cinq routes ; ces deux listes continuent d'afficher l'identifiant
  brut de l'auteur, comme avant ce soir. La route
  `expired-after-validation.ts` (LOT 2 du plan de publication) reste par
  ailleurs toujours branchée à aucun écran — ce lot ne le corrige pas non
  plus, ce n'était pas dans sa liste.
- **Aucun aperçu avant confirmation de la correction.** Le formulaire de
  correction n'affiche les trois ensembles qu'APRÈS l'appel réel à
  `POST .../correction` (qui, par construction de cette route depuis le LOT 4
  du plan de persistance, exécute et confirme la correction dans la même
  transaction — l'acteur ayant déjà l'autorisation de validation). Un aperçu
  fidèle avant ce clic aurait exigé de recalculer `resolveFlashAudienceTreat
  ment` côté client, mais `previousNotifiedChannels` (la trace réelle des
  envois, `flash_notification_dispatches`) n'est renvoyée par aucune route :
  un calcul client aurait deviné plutôt que reproduit la même donnée que le
  serveur. Un vrai aperçu demanderait une route de simulation dédiée
  (« dry-run »), hors périmètre de ce lot — signalé pour une session future.
- **La correction ne propose pas de contacts SMS.** Le formulaire de
  correction couvre push et email (suffisant pour satisfaire
  `REQUIRED_CHANNELS_BY_IMPORTANCE`, qui n'exige jamais le SMS) mais n'offre
  pas le choix optionnel de contacts SMS que propose `FlashProposalPage.tsx`
  pour une nouvelle proposition urgente. Simplification assumée pour rester
  dans le périmètre du lot, à corriger si un scénario de recette l'exige.
- **La modification du texte avant validation reste hors de cet écran**,
  inchangé depuis les lots précédents — toujours pas dans le périmètre du
  LOT 3.

## Fichiers touchés

- Nouveaux : `api/_shared/flash-author.ts`,
  `api/flash/validation/publishable.ts`, `api/flash/validation/published.ts`,
  `scripts/test-flash-author.mjs`, `scripts/test-flash-publishable-queue.mjs`,
  `scripts/test-flash-published-queue.mjs`
- Modifiés : `api/_shared/flash-response.ts`, `api/flash/validation/queue.ts`,
  `shared/flash-payload-policy.ts`, `src/pages/admin/FlashProposalPage.tsx`
  (deux exports ajoutés, `FICTITIOUS_FLASH_GROUPS` et
  `flashChannelRequirement`, réutilisés tels quels — pas redéfinis),
  `src/pages/admin/FlashValidationPage.tsx`, `package.json`,
  `scripts/test-flash-payload-policy.mjs`,
  `scripts/test-flash-validation-page.mjs`
