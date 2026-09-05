# Plan de travail — coffre de codes et parcours de connexion, 5 septembre 2026

Six lots plus la clôture. Priorité n° 1 de la passation, et la seule qui répond
à la question que les familles poseront vraiment à la rentrée : « je n'arrive
pas à me connecter ».

## Périmètre, et ce qui reste fermé

Tout se construit **en données fictives**. L'import réel de codes reste fermé
jusqu'à la recette du coffre et l'autorisation d'Adel. Aucun fichier de codes
réels ne passe par le chat, un prompt, Git, les journaux ou un export de
diagnostic. La remise d'un code d'enfant à un parent reste **désactivée**
jusqu'à la décision de l'administration (T064A) : seul le formulaire existe.

## Règles communes à TOUS les lots

1. `CLAUDE.md` s'applique intégralement. Les interdits absolus ne se discutent pas.
2. Branche `codex/lycee-connect-prototype`. **Jamais de `git push`.** Un commit
   local par lot.
3. Aucun drapeau ouvert, aucun envoi, aucun déploiement, aucune donnée réelle.
4. **Le modèle ne reçoit jamais une valeur de code.** Il reçoit au plus : le
   type de service, la disponibilité, le besoin de validation, l'autorisation
   de remise, l'erreur, le reçu. Jamais la valeur, jamais un fragment.
5. Réutiliser l'existant : `identity_directory_private_rows` pour le motif de
   stockage chiffré, `api/identity/device/request.ts` et `verify.ts` pour la
   preuve par courriel, `shared/flash-validation-access.ts` pour le motif
   d'autorisation par service. Ne pas réimplémenter une règle déjà écrite.
6. Migrations : pile Supabase locale jetable uniquement.
7. Avant commit : `npm run build` et `npm run test:preview-security-gate`.
8. Compte rendu obligatoire dans `docs/operations/night-logs/COFFRE-LOTn.md`,
   séparant ce qui est prouvé par une commande exécutée de ce qui reste supposé.

## Pièges déjà payés

- Colonnes non qualifiées dans une sous-requête corrélée Drizzle.
- Une sous-requête sans résultat renvoie NULL, pas `false` : `coalesce(..., false)`.
- Un test de schéma ne prouve pas une livraison.
- Un lot qui réimplémente une règle existante au lieu de l'importer est raté.

---

## LOT 1 — Contrat du coffre, pur et testé

`shared/code-vault-policy.ts`, sans base ni réseau :

- services couverts : `ent`, `cantine`, `koxo` ; la messagerie académique n'a
  pas de code à remettre, seul l'email est vérifiable ;
- cycle de vie `disponible -> reserve -> remis -> utilise`, transitions légales
  et refus des illégales ;
- une consultation **ne prouve pas** l'usage : seul un contrôle d'activation
  réel ou une validation autorisée marque `utilise` ;
- identité d'une attribution : personne, service, année scolaire, version.
  Une seule attribution active par quadruplet ;
- ce que le modèle a le droit de recevoir, sous forme d'un type explicite qui
  **ne peut pas contenir la valeur** — la garantie doit tenir par le type, pas
  par la discipline de l'appelant ;
- matrice d'autorisation du §7 : élève son propre code, professeur le sien,
  professeur principal un code élève à la fois dans ses classes validées,
  intendance la cantine de son établissement, administration/DDFPT/référent
  tout leur établissement. Parent vers enfant : **refusé**, motif explicite.

## LOT 2 — Schéma chiffré

Migration et schéma Drizzle : coffre **séparé** du registre de connaissances,
`institution_id` partout, RLS forcée, aucun privilège direct pour `anon` ni
`authenticated`. Valeur chiffrée au repos sur le motif de
`identity_directory_private_rows`. Contrainte d'unicité sur le quadruplet.
Journal d'accès sans aucune valeur. Vérifier qu'aucune colonne ne peut recevoir
une valeur en clair par erreur.

## LOT 3 — Attribution et remise

- Transaction : deux demandes concurrentes retournent **la même** attribution,
  jamais deux.
- Trois affichages au maximum par personne, par code et par jour ; au-delà, le
  formulaire prend le relais.
- Le code est visible 30 minutes, puis invalide. Une nouvelle vérification
  d'identité est nécessaire après expiration.
- Un code signalé défectueux attend une intervention humaine : aucun
  remplacement ni réactivation automatique.
- Le code cantine reste fixe pour l'année, sauf remplacement humain tracé.

## LOT 4 — Composant sécurisé d'affichage

Séparé du chat, jamais dans le fil de conversation. Compte à rebours visible,
bouton de copie, **non téléchargeable**, disparaît à l'expiration. À 320 px
comme à 1 440 px. Aucun code dans le titre de la page, l'URL, le presse-papier
persistant ou une capture automatique.

## LOT 5 — Les quatre parcours, en données fictives

- **ENT inactif** : preuve envoyée uniquement vers l'email ou le téléphone déjà
  enregistré, puis identifiant et code d'activation dans le composant sécurisé,
  puis invitation à réinitialiser le mot de passe.
- **ENT actif** : guider la réinitialisation ; échec ou coordonnée incorrecte
  ouvre une demande au référent numérique. L'agent ne modifie jamais une
  coordonnée.
- **Cantine** : preuve puis numéro annuel de badge ; erreur vers l'intendance.
- **Koxo** : preuve puis code fixe ; erreur vers le référent numérique.
- **Messagerie académique** : seul l'email est vérifiable ; les autres cas
  passent par le formulaire enrichi. L'identifiant académique unique reste
  interne, chiffré, jamais affiché.

## LOT 6 — Recette adverse sur PostgreSQL réel

Avec des personnes inventées :

- deux demandes simultanées : une seule attribution ;
- quatrième affichage dans la journée : refusé, formulaire proposé ;
- code expiré à 30 minutes : invisible, nouvelle preuve exigée ;
- code défectueux : aucune réattribution automatique ;
- parent demandant le code de son enfant : refusé avec motif ;
- professeur principal hors de ses classes validées : refusé ;
- membre d'un autre établissement : ne voit rien ;
- **aucune valeur de code dans aucun journal, trace, réponse d'erreur ou
  contexte de modèle** — le vérifier par balayage, pas par confiance.

Puis recette navigateur du composant sécurisé à 320, 390 et 1 440 px.

## LOT 7 — Clôture

Ce qui est utilisable, simulé, à brancher. Ce qu'Adel doit décider : la
décision de l'administration sur la remise parent-enfant (T064A), le
fournisseur OTP téléphone (T063A), et le circuit d'import réel des codes.
Ne cocher T064 et T069 que si elles le sont vraiment.
