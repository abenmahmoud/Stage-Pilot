# Passation Claude - identité email sur appareil

## Point de départ

- Dépôt : `abenmahmoud/Stage-Pilot`.
- Branche : `codex/lycee-connect-prototype`.
- Commit fonctionnel à reprendre : `a45833c`.
- Spécifications de référence : `specs/project-memory.md`,
  `specs/002-agent-etablissement-adaptatif/tasks.md` et
  `specs/002-agent-etablissement-adaptatif/methode-enseignement-agent.md`.
- Tâche concernée : `002/T010B4B`, volontairement encore ouverte.

Le lot prépare une vérification sans mot de passe par adresse email déjà connue,
un code de dix minutes et une session révocable sur l'appareil. Il est fermé par
défaut et n'est ni déployé, ni activé, ni relié à des données réelles.

## État vérifié

- Quatre routes publiques bornées existent sous `api/identity/device/` : demande,
  état, vérification et session/oubli.
- L'adresse est chiffrée vers le worker privé et n'est pas stockée en clair dans
  les nouvelles tables. Une réponse identique couvre absent, partagé et reconnu.
- Le code compte six chiffres, expire en dix minutes et accepte cinq essais.
- Les cookies sont opaques, `HttpOnly`, `SameSite=Lax` et `Secure` en production.
- Une session persistante expire après sept jours d'inactivité et trente jours
  au maximum. Une session d'appareil partagé expire avec la session navigateur.
- L'emploi du temps propre est lisible à I3. Un responsable doit avoir une
  relation `guardian_of` active et datée vers l'enfant demandé.
- Les deux drapeaux restent faux : `IDENTITY_DEVICE_ACCESS_ENABLED` et
  `VITE_IDENTITY_DEVICE_ACCESS_ENABLED`.

Les preuves locales passent : TypeScript, build, 108 routes HTTP, limites,
worker 28/28, recherche 23/23, lecture d'emploi du temps 22 scénarios, responsive,
intégrité Spec Kit et 94 versions de migration uniques. Aucun email n'a été
envoyé et aucune mutation distante n'a été exécutée.

## Travail prioritaire restant

1. Rendre Docker Desktop réellement joignable, démarrer uniquement la pile
   Supabase locale jetable et rejouer les 94 migrations avec la fixture
   synthétique. Le lot actuel n'a obtenu aucun serveur Docker exploitable.
2. Vérifier la migration `20260902210908_create_identity_device_access.sql` sur
   PostgreSQL réel : contraintes, RLS forcée, droits, triggers, concurrence de
   vérification et révocation immédiate.
3. Remplacer la livraison directe du code depuis le poll `status` par une tâche
   durable ou démontrer une reprise idempotente équivalente. Aujourd'hui l'appel
   est un `POST` idempotent, mais un échec fournisseur place le challenge en
   `failed` sans nouvelle tentative automatique.
4. Exécuter un scénario complet uniquement fictif : adresse unique, absente,
   partagée, worker en panne, email en panne, cinq codes faux, expiration,
   révocation et accès parent-enfant. Utiliser une fixture email locale, jamais
   Brevo réel.
5. Ajouter la preuve navigateur à 320, 390 et 1 440 px lorsque le scénario
   fictif fonctionne. Maintenir le formulaire classique en repli.
6. Garder `T010B4B` ouverte jusqu'à ces preuves. Ne préparer une activation de
   preview qu'après une autorisation distincte et une contre-revue du diff final.

## Commandes de reprise

```powershell
git checkout codex/lycee-connect-prototype
git pull --ff-only
git status --short --branch
docker info --format '{{.ServerVersion}}'
npx --yes supabase@2.116.0 start
npm run recipe:local-production-shape-migration
npm run test:identity-device-access
npm run test:identity-directory-worker
npm run test:identity-directory-lookup
npm run test:schedule-identity-reader
npm run test:support-rate-limits
npm run test:api-request-body-boundary-coverage
npm run test:api-method-boundary-coverage
npm run test:private-route-auth-coverage
npm run test:no-body-command-security
npm run test:migration-integrity
npm run test:spec-integrity
npm run build
git diff --check
```

La recette `recipe:local-production-shape-migration` réinitialise uniquement la
pile Supabase locale jetable et retire les variables distantes de son processus.
Ne jamais l'adapter avec `--linked`, `db push` ou une URL distante.

## Frontières absolues

- Ne pas lire, copier, résumer, committer ou transmettre le dossier privé ENT.
- Ne pas importer les personnes réelles, activer les drapeaux, envoyer un email,
  modifier Vercel, Supabase distant, VPS, DNS, Hostinger, Webmail, ENT ou PRONOTE.
- Ne jamais ajouter une recherche libre par nom, exposer une correspondance ou
  placer le répertoire dans le contexte du modèle.
- Ne pas transformer la preuve de contrôle d'un email en autorisation générale.
- Codes d'accès, documents personnels et modifications officielles restent sous
  validation humaine.
- Ne pas lancer un modèle externe ou consommer un quota sans autorisation
  explicite pour cette exécution, son périmètre et sa limite.

## Critère de sortie du prochain lot

Un prochain commit peut fermer la partie locale seulement si les 94 migrations
sont rejouées sur PostgreSQL jetable, le scénario fictif complet passe sans
résidu, l'échec email est repris durablement, les tests ci-dessus restent verts
et aucune donnée ou infrastructure réelle n'a été touchée.
