# Mission Claude - préparation du pilote du vendredi

Tu interviens comme auditeur externe indépendant.

## Projet

- Nom : LyceeGest, portail numérique du Lycée Blaise Cendrars.
- État : candidat de preview, jamais considéré comme prêt pour la production
  sans preuves de migration, restauration et recette.
- SHA à auditer : `4a49d21c132cdb3fd8818201d74740ab975af506`.
- Source de vérité : spécifications `001` à `005`, tâches Spec Kit et procédures
  d'exploitation du dépôt.

## Mission unique

Identifier uniquement les blocages techniques P0 ou P1 qui empêcheraient
l'ouverture vendredi d'un pilote borné comprenant : site public, assistant
limité aux sources validées, création et suivi d'une demande, pièces jointes,
routage vers quatre services et traitement manuel par des comptes nominatifs.

Ne cherche pas à généraliser le produit, à activer PRONOTE, ENT, SMS, WhatsApp,
envois collectifs ou imports réels. Le résultat doit permettre à Codex de
prioriser les actions des prochaines quarante-huit heures.

## Périmètre autorisé

Lire uniquement :

- `docs/operations/LYCEEGEST_PRODUCTION_PROMOTION_READINESS_2026-09-02.md` ;
- `docs/operations/SITE_PRODUCTION_CUTOVER_RUNBOOK.md` ;
- `docs/operations/PILOT_RECIPE_2026-08-27.md` ;
- `specs/001-guichet-numerique/tasks.md`, sections T038 à T040A ;
- `specs/002-agent-etablissement-adaptatif/tasks.md`, uniquement les tâches de
  sécurité, identité, pilote, supervision et données locales ;
- `package.json`, `vercel.json`, `supabase/config.toml` ;
- `supabase/migrations/*.sql` pour l'ordre, la compatibilité et les opérations
  dangereuses ;
- les scripts `scripts/test-*security*.mjs`,
  `scripts/test-migration-version-integrity.mjs` et les scripts de recette
  production/preview explicitement référencés par `package.json`.

Hors périmètre : `.env*`, répertoires utilisateurs, pièces jointes, données
réelles, listes nominatives, secrets, autres dépôts, production Vercel,
production Supabase, réseau et historique Git complet.

## Contraintes

- Lecture seule. Ne modifie aucun fichier et ne déploie rien.
- N'utilise ni Bash, ni PowerShell, ni WebFetch, ni MCP, ni sous-agent.
- Ne recherche et n'affiche aucun secret ou donnée personnelle.
- Vérifie les affirmations dans les fichiers autorisés ; écris `non vérifié`
  lorsque la preuve manque.
- Ne demande pas une refonte et ne répète pas toute la documentation.
- Arrête-toi après les blocages P0/P1 et cinq actions ordonnées maximum.

## Points à contrôler

1. Cohérence réelle entre l'ancien schéma public, les 93 migrations et le code
   candidat ; migrations non additives, dépendances d'ordre ou retour arrière
   impossible.
2. Preuve de sauvegarde restaurable et répétition isolée avant promotion.
3. Risque de perte, fuite inter-établissement ou contournement d'identité dans
   création, suivi, pièce jointe et traitement d'une demande.
4. Comptes agents nominatifs, MFA, rôle par service et possibilité de couper
   l'IA ou les fonctions externes sans perdre le guichet.
5. Tests, observabilité et procédure de retour au code précédent pendant le
   pilote.

## Format de réponse

1. Verdict en cinq lignes maximum : `GO conditionnel` ou `NO-GO`.
2. Constats P0 puis P1, chacun avec fichier et ligne, preuve, conséquence et
   correction minimale.
3. Éléments importants `non vérifiés`.
4. Cinq actions maximum, dans l'ordre, séparant ce qui est automatisable de ce
   qui exige une décision humaine.

Maximum 120 lignes. Une seule réponse, aucune relance automatique.
