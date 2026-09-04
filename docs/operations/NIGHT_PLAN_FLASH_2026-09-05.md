# Plan de nuit — informations flash, 5 septembre 2026

Six lots, une session Claude Code fraîche par lot. Adel dort. Rien ne doit
partir, rien ne doit être publié, rien ne doit être déployé.

## Règles communes à TOUS les lots

1. `CLAUDE.md` s'applique intégralement. Les interdits absolus ne se discutent pas.
2. Branche `codex/lycee-connect-prototype`. **Jamais de `git push`.** Commit local
   par lot, message en français, sujet court à l'impératif.
3. **Ne pas toucher `src/pages/prototype/lycee-connect.css`.** Il porte une
   modification non commitée d'Adel qui n'est pas de toi. Ne pas la committer,
   ne pas la restaurer, ne pas la contourner.
4. Aucun drapeau ouvert. `COMMUNICATION_SEND_ENABLED`,
   `COMMUNICATIONS_ENABLED` et les `VITE_*` restent tels quels.
5. Aucune donnée réelle. Aucun nom d'élève, de parent ou de personnel. Les
   fixtures sont des personnes inventées.
6. Aucun envoi, aucune notification, aucun appel à un fournisseur. Les tests qui
   toucheraient un transport réel ne sont pas écrits.
7. Migrations : jamais `--linked`, jamais `db push`, jamais d'URL distante. Si
   Docker n'est pas disponible, écrire **« migration non rejouée »** dans le
   compte rendu. Ne jamais présenter un test de schéma comme une preuve de
   fonctionnement.
8. Avant commit : `npm run build` et `npm run test:preview-security-gate`.
   Si l'un échoue pour une raison antérieure à ton lot, le dire précisément
   dans le compte rendu au lieu de le masquer ou de le contourner.
9. Ne pas lire `specs/project-memory.md` en entier. `grep` sur la section utile.
10. Terminer OBLIGATOIREMENT par le compte rendu du lot dans
    `docs/operations/night-logs/LOTn.md`, puis le commit local. Sans ce fichier,
    le lanceur considère le lot échoué et s'arrête.
11. Dans le compte rendu, séparer explicitement **ce qui est prouvé par une
    commande réellement exécutée** et **ce qui reste supposé**. Ne jamais écrire
    qu'une fonction marche si rien ne l'a exécutée.

## La règle métier à implémenter

Elle est écrite, décidée avec Adel le 5 septembre 2026, dans
`specs/002-agent-etablissement-adaptatif/politique-operationnelle-agent-2026-2027.md`
§13, et découpée en tâches T071, T071A, T071B, T071C, T071D. **Lis ces deux
sources avant d'écrire une ligne. Ne réinvente aucune règle.**

Résumé, pour repérage seulement :

- La flash est un canal supplémentaire, jamais le canal d'urgence. Rien ne part
  sans validation du référent numérique ou de la DDFPT, quelle que soit l'heure.
- Un personnel ou professeur vérifié propose ; expiration obligatoire.
- Niveaux : normale = site seul, importante = push + email facultatif,
  urgente = push + email, SMS aux seules personnes choisies.
- Après publication, aucune notification automatique. L'agent compare les deux
  versions et **propose** une correction quand date, heure, lieu, annulation,
  public concerné ou niveau d'urgence change. Correction de forme : rien.
  Dans tous les cas un humain confirme, et peut aller contre la proposition
  dans les deux sens.
- Changement de public : trois ensembles calculés depuis les deux versions.
  **Maintenus** → l'information corrigée. **Retirés** → une ligne sans détail
  disant qu'ils ne sont plus concernés. **Ajoutés** → l'information neuve, ce
  n'est pas une correction. Une correction n'emprunte que les canaux ayant
  réellement notifié : une flash normale ne corrige personne ; un passage de
  normale à importante ou urgente met tout le public dans les ajoutés.
- Une proposition qui expire sans validation n'est jamais fermée en silence :
  son auteur est prévenu qu'elle n'a pas été publiée et que personne n'a été
  informé, sans mettre en cause un valideur ni ajouter de motif. Ces échecs
  sont comptés et consultables.

---

## LOT 1 — Modèle de données

Migration SQL et schéma Drizzle pour : la flash, ses versions, ses audiences,
ses propositions et leurs états, les notifications émises et les décisions
humaines de correction.

Exigences :

- `institution_id` sur chaque table, RLS forcée, aucun privilège direct pour
  `anon` ni `authenticated` — suivre exactement le motif des tables `support_*`
  et `communication_*` existantes.
- Une version conserve texte, audience, importance, canaux, expiration, auteur,
  valideur, dates, et l'ancienne comme la nouvelle valeur.
- Un état de proposition couvrant au minimum : proposée, validée, publiée,
  modifiée, expirée sans validation, refusée.
- Contrainte empêchant une flash publiée sans expiration.
- Trace de ce qui a **réellement notifié**, par canal : c'est cette trace, et
  non l'importance déclarée, qui décide plus tard si une correction est possible.

Preuves attendues : `npm run test:migration-integrity`, `npm run build`. Rejeu
réel de la migration seulement si une pile Supabase locale jetable est
disponible ; sinon écrire « migration non rejouée » sans détour.

## LOT 2 — Logique pure, testée

Modules `shared/flash-*.ts`, sans base ni réseau, sur le modèle de
`shared/nominative-*.ts` (même style, mêmes garanties, mêmes refus explicites) :

- transitions d'état légales, et refus des transitions illégales ;
- analyse de l'écart entre deux versions : **décisif** (date, heure, lieu,
  annulation, public, importance) contre **forme** (orthographe, ponctuation,
  reformulation sans changement de sens) ;
- calcul des trois ensembles maintenus / retirés / ajoutés depuis deux audiences ;
- éligibilité d'une correction selon les canaux ayant réellement notifié ;
- détection d'une proposition expirée sans validation.

Tests dans `scripts/test-flash-*.mjs`, enregistrés dans `package.json`, avec un
agrégat `test:flash`. Couvrir au minimum : correction de forme seule, changement
d'heure seul, audience réduite, audience élargie, audience remplacée
entièrement, flash normale modifiée, passage normale → urgente, expiration sans
validation, double modification successive.

## LOT 3 — Écran de proposition

Page d'administration, données fictives, aucune écriture serveur.

- Champs : texte, public, importance proposée, canaux, expiration obligatoire.
- L'agent **suggère** l'importance ; la personne décide.
- L'écran dit clairement qu'une proposition en attente **n'a prévenu personne**,
  et renvoie vers la messagerie ENT quand la personne doit joindre son public
  tout de suite. C'est la protection contre un professeur qui repart en croyant
  sa classe alertée.
- Responsive vérifié à 320 px comme au format ordinateur.

## LOT 4 — Écran de validation et de modification

- Liste des propositions en attente, avec leur âge.
- Comparaison des deux versions, mise en évidence de ce qui a changé.
- Proposition de correction affichée seulement quand l'écart est décisif, avec
  la possibilité de la refuser, et d'en demander une sur une correction de forme.
- Les **trois ensembles** avec leurs effectifs et leurs trois textes distincts,
  confirmation ensemble par ensemble.
- Aucun envoi : le bouton prépare et affiche, il n'émet rien.
- Responsive 320 px.

## LOT 5 — Recette

Fixtures adverses et preuves exécutées :

- correction de forme sur une flash urgente → aucune proposition de correction ;
- changement d'heure sur une flash importante → proposition de correction ;
- audience réduite → un retiré reçoit bien la ligne « ne vous concerne plus » ;
- audience élargie → l'ajouté reçoit une information neuve, pas une correction ;
- flash normale modifiée → aucune correction possible, seul le site change ;
- normale → urgente → tout le public passe en ajoutés ;
- proposition expirée sans validation → auteur prévenu, échec compté ;
- transition illégale → refusée.

Vérifier aussi que la simulation ne déclenche aucun appel externe, et que rien
dans le code du lot ne peut envoyer un message.

## LOT 6 — Clôture

Compte rendu global dans `docs/operations/night-logs/LOT6.md` :

- ce qui est utilisable, ce qui est simulé, ce qui reste à brancher ;
- la liste exacte des commandes exécutées et leur résultat ;
- ce qui a échoué, avec l'erreur telle quelle ;
- les tâches T071 à T071D à cocher ou non, honnêtement ;
- ce qu'Adel doit décider ou faire au réveil, en une liste courte.

Ne rien déclarer prouvé qui ne l'est pas. Un compte rendu honnête et court vaut
mieux qu'un bilan flatteur.
