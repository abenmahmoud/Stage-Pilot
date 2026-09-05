# Plan de travail — persistance des informations flash, 5 septembre 2026

Huit lots plus la clôture. Une session Claude Code fraîche par lot.

Le socle existe déjà et **ne doit pas être réécrit** : six tables (migration
`20260905013000`), les modules purs `shared/flash-transitions.ts`,
`flash-version-diff.ts`, `flash-audience-correction.ts`, `flash-expiration.ts`,
`flash-validation-access.ts`, et deux écrans qui fonctionnent sur des jeux
d'essai locaux. Ce plan branche tout cela sur la vraie base.

## Règles communes à TOUS les lots

1. `CLAUDE.md` s'applique intégralement.
2. Branche `codex/lycee-connect-prototype`. **Jamais de `git push`.** Un commit
   local par lot.
3. **Ne pas toucher `src/pages/prototype/lycee-connect.css`** : modification
   non commitée d'Adel.
4. Aucun drapeau ouvert, aucun envoi réel, aucun appel fournisseur, aucun
   déploiement, aucune donnée réelle.
5. **Réutiliser les modules purs existants.** Toute règle métier — décisif
   contre forme, trois ensembles, éligibilité des canaux, transitions,
   expiration, autorisation — est déjà écrite et testée. Un lot qui la
   réimplémente au lieu de l'importer est un lot raté.
6. Migrations : jamais `--linked`, jamais `db push`, jamais d'URL distante.
   Pile Supabase locale jetable uniquement. Si Docker manque, écrire
   « migration non rejouée » sans détour.
7. Avant commit : `npm run build` et `npm run test:preview-security-gate`.
   Un échec antérieur au lot se documente, ne se masque pas.
8. Compte rendu obligatoire dans `docs/operations/night-logs/PERSIST-LOTn.md`,
   puis commit. Sans ce fichier le lanceur s'arrête.
9. Dans chaque compte rendu, séparer **ce qui est prouvé par une commande
   réellement exécutée** de **ce qui reste supposé**.

## Trois pièges déjà payés, à ne pas repayer

- **Drizzle ne qualifie pas toujours les colonnes** dans un template `sql`.
  Dans une sous-requête corrélée, aliaser la table interne et écrire la
  référence externe en dur. Sinon PostgreSQL résout sur la table interne.
- **Une sous-requête sans résultat renvoie NULL, pas `false`.** Les contrats
  navigateur exigent des booléens stricts : `coalesce(..., false)`.
- **Un test de schéma ne prouve pas une livraison.** Les deux bugs de file
  agent du 2 septembre sont passés par ce trou exact.

---

## LOT 1 — Accès serveur et contrats de charge

- `api/_shared/flash-access.ts` : lit l'appartenance de l'acteur à son
  établissement, en tire `role` et `serviceCodes`, appelle
  `decideFlashValidationAccess`. Même motif que l'accès de la file support.
- `shared/flash-payload-policy.ts` : contrats stricts de tout ce que le
  navigateur reçoit. Booléens stricts, aucune valeur nulle là où un booléen est
  attendu, champs inconnus refusés.
- Aucune route dans ce lot. Juste le socle et ses tests.

## LOT 2 — Proposer

- `POST /api/flash/proposals` : crée une proposition et sa première version.
  Expiration obligatoire, cloisonnement par établissement, auteur pris de la
  session et **jamais** du corps de la requête.
- `GET /api/flash/proposals/mine` : les propositions de l'auteur, avec leur état.
- Idempotence sur un double envoi.

## LOT 3 — Valider, refuser, modifier

- `GET /api/flash/validation/queue` : file des propositions à traiter, ouverte
  par le service, jamais par le rôle.
- `POST /api/flash/proposals/[id]/decision` : valide, refuse ou modifie. Écrit
  une nouvelle version, conserve l'ancienne et la nouvelle valeur, enregistre
  le valideur et `selfValidated`.
- Une transition illégale est refusée par `shared/flash-transitions.ts`, pas
  par une condition écrite sur place.
- Verrou transactionnel : deux validations simultanées ne créent pas deux
  versions concurrentes.

## LOT 4 — Corriger après publication

- Calcul **serveur** des trois ensembles depuis l'audience réelle des deux
  versions et la trace réelle de `flash_notification_dispatches`
  (`status = 'sent'`), jamais depuis l'importance déclarée.
- Enregistrement de la décision humaine de correction, avec l'écart analysé.
- **Aucun envoi.** La route prépare et enregistre ; rien ne part.
- Attention au cas corrigé le 5 septembre : une version qui a réellement
  notifié reste corrigible même ramenée à normale.

## LOT 5 — Expiration et avis à l'auteur

- Détection serveur des propositions expirées sans validation, via
  `shared/flash-expiration.ts`.
- Passage d'état, conservation de la proposition, et **préparation** de l'avis
  à l'auteur : message factuel, aucun valideur mis en cause, aucun motif
  ajouté. L'avis est enregistré comme à émettre, il n'est pas émis.
- Compteur de ces échecs, consultable.

## LOT 6 — Brancher les écrans

- Remplacer les jeux d'essai `useState` de `FlashProposalPage.tsx` et
  `FlashValidationPage.tsx` par les routes réelles.
- Faire remonter `serviceCodes` jusqu'à l'écran de validation pour que
  l'affichage corresponde à ce que le serveur autorise vraiment (T071E).
- Les drapeaux restent fermés.

## LOT 7 — Recette sur PostgreSQL réel jetable

Le lot le plus important. Sur pile locale, avec des personnes inventées :

- une proposition, une validation, une correction, bout en bout ;
- deux enfants d'un même parent dans deux groupes : aucune livraison perdue ;
- validation concurrente : une seule version gagne ;
- rejeu d'une même requête : aucun doublon ;
- RLS : un membre d'un autre établissement ne voit rien ;
- `anon` et `authenticated` n'ont aucun privilège direct ;
- une flash urgente notifiée puis ramenée à normale : la correction reste due.

Si Docker manque, **ne pas simuler** : écrire que la recette n'a pas été
exécutée et s'arrêter là.

## LOT 8 — Recette navigateur

- Chromium local, les deux écrans, à 320, 390 et 1 440 px.
- Mesurer `documentElement.scrollWidth − clientWidth` : zéro débordement.
- Zéro erreur console.
- Captures dans `.vercel/flash-recette/`.
- C'est le seul lot qui peut clore « responsive vérifié » : jusqu'ici cette
  affirmation reposait sur une lecture du code, pas sur un rendu.

## LOT 9 — Clôture

Compte rendu global : utilisable, simulé, à brancher ; commandes exécutées et
résultats ; échecs avec l'erreur telle quelle ; T071 à T071E cochées seulement
si elles le sont vraiment ; ce qu'Adel doit décider ou faire.
