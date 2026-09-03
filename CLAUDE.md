# Portail numérique — Lycée Blaise Cendrars (LyceeGest)

Dépôt `abenmahmoud/Stage-Pilot`. Branche unique de travail :
`codex/lycee-connect-prototype`. Ne jamais pousser ailleurs.

## Interdits absolus
- Aucun import de personne réelle, aucun email envoyé, aucun drapeau activé.
- Aucune mutation Vercel, Supabase distant, VPS, DNS, Hostinger, Webmail, ENT, PRONOTE.
- Ne jamais lire, copier, résumer ni committer `~/Documents/LyceeGest-DONNEES-PRIVEES`.
- Jamais de recherche libre par nom dans le répertoire d'identités.
- Codes d'accès, documents personnels et actions officielles : validation humaine.
- Ne jamais lancer un modèle externe payant sans accord explicite (périmètre + plafond).

## Règles de travail
- Un lot = une tâche Spec Kit. Ne pas fermer une tâche sans preuve réellement exécutée.
- Une preuve locale n'est pas une recette distante. Le dire explicitement.
- Migrations : jamais `--linked`, jamais `db push`, jamais d'URL distante.
  Les recettes tournent sur pile Supabase locale jetable uniquement.
- Avant commit : `npm run build` + `npm run test:preview-security-gate`.
- Les compteurs Spec Kit ne sont pas un taux de disponibilité du service.

## Où chercher (ne pas charger en entier)
- Tâches : `specs/*/tasks.md`
- Historique long (355 Ko, ne jamais lire en entier) : `specs/project-memory.md`
  → utiliser `grep` sur la section demandée.
- Passation courante : le plus récent `docs/operations/CLAUDE_HANDOFF_*.md`
- Chartes et méthode : `specs/002-agent-etablissement-adaptatif/`

## Commandes utiles
- `/recette` : suite de contrôles locale complète
- `npm run test:preview-security-gate`
- `npm run test:spec-integrity`
- `npm run test:migration-integrity`
- `npm run build`

## Envois nominatifs (cantine) — 3 septembre 2026
Parcours `/admin/envois-nominatifs`, en simulation locale sur jeu d'essai fictif.
Modules : `shared/nominative-{value-policy,merge,batch,import,send-mode}.ts`.
Recette : `npm run test:nominatif`. Spec : 005, taches T034 a T043.
Reste a brancher : T041 (route d'import privee, stockage chiffre, ordre Webmail)
et T042 (recette PostgreSQL reel). Drapeaux tous fermes.

## État au 3 septembre 2026
Tâche ouverte : `002/T010B4B` (identité email sur appareil). Drapeaux
`IDENTITY_DEVICE_ACCESS_ENABLED` et `VITE_IDENTITY_DEVICE_ACCESS_ENABLED` à `false`.
Bloquant : les 94 migrations n'ont pas encore été rejouées sur un PostgreSQL réel
(Docker Desktop indisponible lors du dernier lot).

## Pieges connus (verifies le 3 septembre 2026)

- **L'alias public de preview est assigne a la main.** Il ne suit PAS
  automatiquement les nouveaux deploiements de la branche : apres chaque push,
  le site public sert encore l'ancien build tant qu'on n'a pas execute
  `npx vercel alias set <url-du-nouveau-deploiement> lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app --scope safe-scol`.
  Avant de conclure qu'un correctif ne marche pas, verifier quel deploiement
  sert reellement l'alias (journaux Vercel, champ `dep=`).
- **Drizzle ne qualifie pas toujours les colonnes dans un template `sql`.**
  Dans une sous-requete correlee, `${table.colonne}` peut sortir en `"colonne"`
  non qualifiee et PostgreSQL la resout alors sur la table interne. Toujours
  aliaser la table interne et ecrire la reference externe en dur.
- **Une sous-requete sans resultat renvoie NULL, pas `false`.** Les contrats
  navigateur exigent des booleens stricts : envelopper dans `coalesce(..., false)`.

- **Deux enfants, une seule adresse de parent.** La cle d'idempotence de groupe
  (`communication-delivery-v1`) porte sur (etablissement, communication,
  version, contactRef). Deux beneficiaires qui partagent un contact produisent
  la MEME cle et la seconde livraison disparait a l'insertion. Pour tout envoi
  nominatif, utiliser `prepareNominativeDeliveryRows` : sa cle ajoute le
  beneficiaire et la version de valeur. Un test le demontre.
- **Le shell distant ne peut pas supprimer de fichier.** `rm` et `mv` echouent
  avec « Operation not permitted », y compris apres autorisation. Consequence
  concrete : un `.git/index.lock` ou `.git/HEAD.lock` residuel bloque tous les
  commits et seul Adel peut le supprimer. Contournement partiel pour l'index :
  `GIT_INDEX_FILE=/tmp/<fichier>` deplace le verrou hors du depot.
- **`npm run build` ne tourne pas dans ce shell.** `node_modules` contient les
  binaires natifs Windows de rollup. `node node_modules/typescript/bin/tsc
  --noEmit` couvre la moitie typage ; `vite build` doit tourner sous Windows.
