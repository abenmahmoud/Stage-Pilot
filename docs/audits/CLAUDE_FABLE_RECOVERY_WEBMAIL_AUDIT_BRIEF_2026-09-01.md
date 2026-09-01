# Brief d'audit Claude Fable 5 - restauration et transport Webmail

Tu interviens comme auditeur externe indépendant.

## Projet

- Nom : LyceeGest, portail numérique du Lycée Blaise Cendrars.
- Objectif : fournir un guichet d'aide, un agent d'établissement et un centre de
  communications sûrs. Le produit reste en preview ; les données sont fictives.
- Sources de vérité : `specs/001-guichet-numerique/tasks.md`,
  `specs/005-centre-communications/tasks.md` et les contrats ci-dessous.

## Mission unique

Chercher les défauts de sécurité, d'intégrité ou de reprise réellement
exploitables dans le transport HTTP LyceeGest vers Webmail et dans la
restauration locale du paquet chiffré. Vérifier aussi que les tests et les
documents ne prétendent pas plus que ce que le code prouve.

## Périmètre autorisé

Lire uniquement ces onze fichiers :

1. `shared/communication-webmail-client.ts`
2. `scripts/test-communication-webmail-client.mjs`
3. `workers/recovery-sample-bundle.mjs`
4. `scripts/test-recovery-sample-bundle.mjs`
5. `src/pages/admin/CommunicationsPage.tsx`
6. `scripts/test-communication-ui.mjs`
7. `docs/operations/COMMUNICATION_WEBMAIL_HTTP_TRANSPORT_PREVIEW_2026-09-01.md`
8. `docs/operations/COMMUNICATIONS_BROWSER_RECIPE_2026-09-01.md`
9. `docs/operations/RECOVERY_ISOLATED_RESTORE_PREVIEW_2026-09-01.md`
10. `specs/001-guichet-numerique/tasks.md`
11. `specs/005-centre-communications/tasks.md`

Contexte minimal : Node.js, TypeScript, Vercel et Windows. Aucun environnement,
secret, historique Git, dépendance générée, donnée réelle ou autre projet n'est
autorisé.

## Contraintes

- Lecture seule. Ne modifier aucun fichier et ne déployer rien.
- Ne lancer aucune commande, aucun sous-agent et aucun autre modèle.
- Ne rechercher ni afficher secret, variable d'environnement ou donnée personnelle.
- Vérifier les affirmations dans le code ; écrire `non vérifié` si la preuve manque.
- S'arrêter après cette mission, sans audit général ni proposition de refonte.

## Points à contrôler

1. SSRF, redirections, authentification serveur et limites de réponse HTTP.
2. Liaison commande/reçu, idempotence et absence de contenu fournisseur conservé.
3. Authentification du paquet, dérivation de clé, nonces et limites avant déchiffrement.
4. Traversée de chemin, flux NTFS, écrasement, course et nettoyage de restauration.
5. Exactitude des tests négatifs et assertions insuffisantes.
6. Écarts entre code, documentation et statut des tâches Spec Kit.

## Format attendu

1. Verdict en cinq lignes maximum.
2. Constats P0 à P3 avec fichier et ligne.
3. Pour chaque constat : preuve, conséquence et correction minimale.
4. Points non vérifiés.
5. Cinq actions maximum.

Maximum 120 lignes. Une seule exécution, aucune relance automatique.
