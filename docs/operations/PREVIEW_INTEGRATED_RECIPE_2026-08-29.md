# Recette intégrée de preview - 29 août 2026

## Périmètre

- Dépôt : `abenmahmoud/Stage-Pilot`.
- Branche : `codex/lycee-connect-prototype`.
- Preview Vercel finale : `lyceegest-huhvzladl-safe-scol.vercel.app`.
- Alias : `lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app`.
- Base : branche Supabase `guichet-lycee-preview` (`xijocumlwivhbmffrnlj`).
- Aucune modification de la production, du domaine Hostinger, des DNS, du
  Webmail ou du VPS.

## Répertoire privé d'identités

- La table `identity_directory_rows` et la file `identity_directory_scan` sont
  créées uniquement sur la preview et restent vides.
- RLS est forcée ; `public`, `anon` et `authenticated` n'ont aucun droit direct.
- Le lint SQL Supabase ne remonte aucune erreur.
- Une transaction fictive a inséré cinq lignes produites par le parseur, vérifié
  le compte exact, puis annulé l'ensemble. La table est revenue à zéro.
- Le conseiller sécurité ne remonte aucun avertissement ou erreur lié au
  répertoire. Ses informations `RLS enabled no policy` sont intentionnelles pour
  ces tables accessibles uniquement au serveur avec droits clients révoqués.
- Trois index de couverture initiaux ont été ajoutés. Le conseiller performance
  signale encore comme informations les futures clés des identités et relations ;
  elles seront complétées avec le coffre opérationnel avant la charge réelle.
- Le worker ClamAV est installé sur le VPS de preview avec un secret HMAC dédié
  et un timer d'une minute. Un CSV de quatre lignes entièrement fictives a atteint
  l'état `review` sans conserver de nom ni contact brut ; EICAR a été rejeté et
  le nettoyage a laissé zéro import, ligne, audit ou travail de test.
- Deux versions supplémentaires, sur un établissement fictif isolé, ont parcouru
  approbation, activation, remplacement et retrait. Une seule version est restée
  active, une source remplacée n'a pas pu créer d'identité, le fichier et les
  lignes retirés ont disparu et le nettoyage final est revenu à zéro.
- La migration `20260829004115` ajoute le retrait traçable et la garde de source
  active uniquement sur la preview. Son retour arrière a été testé avant
  application. Le conseiller sécurité n'ajoute aucune alerte ; les informations
  RLS sans politique restent intentionnelles pour les tables serveur privées.

## Test de pointe

Le script protégé `scripts/load-test-support.mjs` a été lancé uniquement contre
la preview avec `LOAD_TEST_CONFIRM=preview-only`.

| Mesure | Résultat |
|---|---:|
| Créations fictives | 200 |
| Concurrence | 20 |
| Durée totale | 1 555 ms |
| Débit observé | 128,6 créations/s |
| Dossiers | 200 |
| Messages | 200 |
| Sessions liées | 200 |
| Travaux en file | 200 |

Le nettoyage final a confirmé zéro dossier de charge, zéro session de charge et
zéro file temporaire restante. Ce test valide les transactions de base et la
file, pas encore la latence HTTP p95 ni la reprise du worker après panne.

## Sécurité et non-régression

- 135 contrôles ciblés passent sur l'assistant, les injections, le masquage des
  données, le routage, les conversations, la concurrence, les sessions, les
  accès agents, les notifications, la reprise, le registre de connaissances et
  le répertoire privé.
- Le build TypeScript/Vite de production réussit.
- `npm audit --omit=dev` ne trouve aucune vulnérabilité dans l'application ni
  dans les dépendances des workers.
- Les API de rapport d'identités, de santé des demandes et de gestion des
  contenus répondent toutes `401` sans session.

## Responsive, accessibilité et PWA

- Aucun débordement horizontal ni contrôle hors écran à 320, 390, 768 et
  1 440 px sur le portail publié.
- Les médias vérifiés répondent en HTTP 200.
- Le manifeste répond en HTTP 200, déclare le mode `standalone` et deux icônes.
- Le service worker est actif sur la preview.
- Lighthouse mobile : accessibilité 100, navigation agentique 100, bonnes
  pratiques 92 et SEO 66.
- Les trois échecs Lighthouse restants sont propres à la preview protégée : le
  script de retour Vercel est bloqué par la CSP du site et Vercel ajoute
  `x-robots-tag: noindex`. Le défaut réel de nom accessible des deux liens
  externes a été corrigé et ne réapparaît plus.

## Limites avant données réelles

1. Rejouer dans le navigateur le cycle du répertoire avec une session direction
   MFA ; les API, la base et le stockage sont déjà validés avec données fictives.
2. Créer les comptes agents nominatifs restants et tester récupération plus MFA.
3. Faire valider finalités, colonnes, rétention et droits par Direction/DPO.
4. Tester la panne puis la reprise des workers et la livraison idempotente.
5. Mesurer le parcours HTTP complet et son p95, pas uniquement les transactions.
6. Tester la restauration chiffrée d'un dossier et d'un fichier dans un
   environnement isolé.

## Gouvernance documentaire ajoutée

- Le dépôt des documents de connaissance est distinct du répertoire des
  personnes ; le type `directory` n'est plus accepté dans ce flux.
- Le superadministrateur doit renseigner le service responsable, le périmètre,
  la date d'effet, la date de révision et ce que l'agent doit comprendre.
- La migration `20260828232200` est appliquée uniquement sur la preview. La table
  était vide, conserve RLS forcée et ne donne aucun droit direct à `public`,
  `anon` ou `authenticated`.
- Huit tests de dépôt documentaire et le build passent. L'analyse antivirus et
  l'extraction de ces documents restent à construire avant qu'un fichier puisse
  devenir une source publiée.

La preview est solide pour une démonstration et des données fictives. Elle ne
constitue pas encore une autorisation d'importer la base réelle des personnes.
