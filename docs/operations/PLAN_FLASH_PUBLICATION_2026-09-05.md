# Plan de travail — publier une information flash, 5 septembre 2026

Quatre lots plus la clôture. Une session Claude Code fraîche par lot.

## Le trou que ce plan comble

Le plan de persistance disait proposer, valider, corriger. Il ne disait jamais
**publier**. Résultat constaté et documenté par son LOT 9 : aucune route ne fait
passer une information de `validee` à `publiee`. Une flash validée n'apparaît
donc nulle part, et la route de correction — pourtant écrite et recettée en base
réelle — est inatteignable par un usage normal. Le LOT 7 a dû forcer la
transition en SQL pour la tester.

## La décision d'Adel, à respecter à la lettre

**Valider n'est pas publier.** Ce sont deux gestes humains distincts. La
validation arrête le contenu et le périmètre ; la publication décide du moment
où l'information devient visible. Une information validée attend sans rien
afficher ni notifier. Écrit dans la politique §13 et dans T071F.

## Règles communes à TOUS les lots

1. `CLAUDE.md` s'applique intégralement.
2. Branche `codex/lycee-connect-prototype`. **Jamais de `git push`.** Un commit
   local par lot.
3. Aucun drapeau ouvert, aucun envoi réel, aucun déploiement, aucune donnée
   réelle. La publication rend visible ; elle **ne déclenche aucun envoi** tant
   que les drapeaux d'envoi sont fermés.
4. **Réutiliser les modules purs existants.** Transitions, écart décisif, trois
   ensembles, éligibilité des canaux, autorisation par service : tout est déjà
   écrit et testé. Un lot qui réimplémente au lieu d'importer est un lot raté.
5. Migrations : pile Supabase locale jetable uniquement. Docker manquant se dit,
   ne se contourne pas.
6. Avant commit : `npm run build` et `npm run test:preview-security-gate`.
7. Compte rendu obligatoire dans `docs/operations/night-logs/PUB-LOTn.md`, puis
   commit. Séparer ce qui est prouvé par une commande exécutée de ce qui reste
   supposé.

## Trois pièges déjà payés

- Colonnes non qualifiées dans une sous-requête corrélée Drizzle : aliaser la
  table interne, écrire la référence externe en dur.
- Une sous-requête sans résultat renvoie NULL, pas `false` : `coalesce(..., false)`.
- Un test de schéma ne prouve pas une livraison.

---

## LOT 1 — La route de publication

- `POST /api/flash/proposals/[id]/publication` : transition `validee` ->
  `publiee`, ouverte par le même service que la validation
  (`decideFlashValidationAccess`), jamais par le rôle applicatif.
- La transition passe par `shared/flash-transitions.ts`, pas par une condition
  écrite sur place.
- Refus si l'expiration est déjà atteinte : on ne publie pas une information
  périmée.
- Idempotence : deux clics ne publient qu'une fois, et la seconde réponse dit
  que c'était déjà publié plutôt que d'échouer.
- Verrou transactionnel contre deux publications simultanées.
- Enregistrer qui publie et quand, distinctement de qui a validé.

## LOT 2 — Expiration d'une information validée jamais publiée

- Étendre la détection existante : aujourd'hui elle ne couvre que les
  propositions jamais validées.
- Même avis factuel à l'auteur : elle n'a pas été publiée, personne n'a été
  informé. Aucun valideur mis en cause, aucun motif ajouté.
- Compter ces échecs séparément des propositions jamais validées : les deux
  causes n'appellent pas la même correction d'organisation.

## LOT 3 — Brancher la publication et la correction dans l'écran

- Bouton de publication sur une information validée, avec son état et l'échéance
  affichée.
- **Brancher enfin `POST /api/flash/proposals/[id]/correction`** : l'écran doit
  afficher les trois ensembles, leurs effectifs et leurs trois textes, puis
  confirmer ensemble par ensemble. La route existe depuis le LOT 4 du plan
  précédent et n'est appelée par aucun écran.
- Faire remonter l'audience et le nom de l'auteur, que les routes ne renvoient
  pas encore : l'écran le signale lui-même aujourd'hui.
- Retirer de l'écran les avertissements devenus faux au fur et à mesure. Un
  écran qui annonce une limite levée est aussi trompeur qu'un écran qui cache
  une limite réelle.

## LOT 4 — Recette

Sur PostgreSQL réel jetable, avec des personnes inventées :

- valider puis publier : l'information devient visible, rien n'est envoyé ;
- publier deux fois : une seule publication, réponse idempotente ;
- publier une information expirée : refusé ;
- publier sans le service : refusé ;
- corriger après publication depuis l'écran, sans SQL forcé cette fois ;
- une information validée jamais publiée qui expire : auteur prévenu, échec
  compté dans sa propre catégorie ;
- deux publications simultanées : une seule gagne.

Puis recette navigateur à 320, 390 et 1 440 px sur l'écran de validation
complété, captures dans `.vercel/flash-recette/`.

## LOT 5 — Clôture

Compte rendu global. Cocher T071, T071A, T071B, T071C, T071E et T071F seulement
si elles le sont vraiment — la règle du plan précédent tient : une tâche qui
décrit un comportement de production ne se coche pas quand ce comportement est
inatteignable par un compte réel.
