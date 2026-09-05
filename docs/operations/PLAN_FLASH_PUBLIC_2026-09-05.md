# Plan de travail — rendre les informations flash visibles, 5 septembre 2026

Six lots plus la clôture. Une session Claude Code fraîche par lot.

## Ce que ce plan comble

Le circuit interne est complet : proposer, valider, publier, corriger, expirer,
prévenir l'auteur. Vérifié en base réelle et depuis l'écran. Mais **une flash
publiée n'apparaît nulle part** : aucune route publique ne lit ces tables, rien
dans les pages du site, et aucune notification n'est jamais écrite. L'information
s'arrête à la porte de l'administration.

## Règles communes à TOUS les lots

1. `CLAUDE.md` s'applique intégralement.
2. Branche `codex/lycee-connect-prototype`. **Jamais de `git push`.** Un commit
   local par lot.
3. **Aucun envoi réel, aucun drapeau ouvert, aucun déploiement, aucune donnée
   réelle.** Les lots 3 et 4 écrivent des envois *simulés* ; rien ne part.
4. **Réutiliser l'existant.** Les modules purs flash, la file durable de la
   spec 005, le Webmail comme seul composant autorisé à résoudre une adresse et
   à appeler Brevo. Ne pas créer un second circuit d'envoi : le mode nominatif
   a déjà montré ce que coûte une deuxième implémentation d'une même règle.
5. Migrations : pile Supabase locale jetable uniquement.
6. Avant commit : `npm run build` et `npm run test:preview-security-gate`.
7. Compte rendu obligatoire dans `docs/operations/night-logs/PUBLIC-LOTn.md`.
   Séparer ce qui est prouvé par une commande exécutée de ce qui reste supposé.

## Trois pièges déjà payés

- Colonnes non qualifiées dans une sous-requête corrélée Drizzle.
- Une sous-requête sans résultat renvoie NULL, pas `false` : `coalesce(..., false)`.
- Un test de schéma ne prouve pas une livraison.

---

## LOT 1 — Règle de visibilité, pure et testée

`shared/flash-visibility.ts`, sans base ni réseau :

- une information n'est visible que dans l'état `publiee`, jamais avant ;
- jamais après son expiration, à la seconde près, horloge serveur Europe/Paris ;
- **un visiteur anonyme ne voit que les informations dont l'audience est
  publique.** Une flash adressée à `classe:2nde4` ne s'affiche pas sur le site
  ouvert : elle apparaît dans l'espace des personnes identifiées appartenant à
  ce groupe. C'est l'application directe du §2 — l'agent public utilise l'état
  `publiée` **et l'audience autorisée** ;
- une correction remplace la version affichée ; l'ancienne ne réapparaît jamais.

Tests : publiée et non expirée, publiée et expirée à la seconde, validée non
publiée, audience ciblée vue par un anonyme, la même vue par un membre du
groupe, version corrigée puis version d'origine.

## LOT 2 — Route publique et affichage

- `GET /api/content/flash/public` : uniquement les informations visibles selon
  le LOT 1, triées par importance puis par date, bornées en nombre.
- Contrat de charge strict, booléens stricts, aucun champ interne exposé :
  ni auteur, ni valideur, ni audience brute, ni identifiant de proposition.
- Affichage sur le site public, sobre, et à 320 px comme à 1 440 px.
- Rien ne s'affiche s'il n'y a rien : pas de bloc vide, pas de faux contenu.

## LOT 3 — Écrire les envois, sans envoyer

- À la publication, écrire les lignes de `flash_notification_dispatches`
  correspondant au niveau d'importance : normale n'écrit rien, importante écrit
  push et email si choisis, urgente écrit push et email, et SMS pour les seules
  personnes choisies.
- **État `simulated`, jamais `sent`, tant que les drapeaux sont fermés.**
- Cette trace est ce que lit la règle de correction. Une ligne écrite avec le
  mauvais état casse silencieusement tout le calcul des trois ensembles :
  c'est le point le plus délicat du plan, à tester en priorité.
- Idempotence : republier ou rejouer ne double aucune ligne.

## LOT 4 — Raccorder à la file durable existante

- Utiliser la file de la spec 005 et son runner, pas un nouveau mécanisme.
- Le Webmail reste seul à résoudre une adresse et à appeler le fournisseur.
- Les travaux sont mis en file **en mode simulation** : nombre d'essais borné,
  reprise, états distincts simulé / en attente / transmis / livré / échec /
  résultat à vérifier.
- Une réponse fournisseur sans identifiant reste « résultat à vérifier » et
  n'autorise aucun renvoi.

## LOT 5 — Fermer T071E

- La porte de l'écran de validation repose encore sur le rôle applicatif.
  La faire reposer sur le service réellement accordé, en faisant remonter
  `serviceCodes` jusqu'au client, le serveur restant l'autorité.
- Un compte d'administration sans le service ne doit plus voir l'écran.

## LOT 6 — Recette

Sur PostgreSQL réel jetable, avec des personnes inventées :

- publier une flash publique : elle apparaît sur la route publique ;
- publier une flash ciblée : absente pour un anonyme, présente pour un membre ;
- attendre l'expiration : elle disparaît, sans intervention ;
- corriger une publiée : la route publique sert la version corrigée ;
- publier une importante : les lignes d'envoi sont écrites en `simulated`,
  aucune requête ne part vers un fournisseur ;
- rejouer la publication : aucune ligne d'envoi en double ;
- un compte sans le service : écran refusé.

Puis recette navigateur du site public à 320, 390 et 1 440 px, captures dans
`.vercel/flash-recette/`.

## LOT 7 — Clôture

Compte rendu global. Cocher T071E seulement si elle l'est vraiment. Dire
clairement ce qui reste avant qu'une information flash puisse être envoyée pour
de vrai : quels drapeaux, quelle validation d'Adel, quelles preuves manquantes.
