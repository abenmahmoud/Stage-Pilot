# Mise en ligne du Dépôt Lycée — 8 septembre 2026

## Autorisation et périmètre

Adel a demandé explicitement de pousser, migrer, configurer et mettre en ligne
le 8 septembre 2026. Cette opération ne lit aucun export réel et ne déclenche ni
email, ni notification, ni appel IA. Les fichiers de plans et scripts de nuit
appartenant à l'autre session sont restés hors des commits.

## Git et Vercel

- Branche : `codex/lycee-connect-prototype`.
- Commit fonctionnel poussé : `78a9dba`.
- Projet : `safe-scol/lyceegest`.
- Déploiement vérifié : `dpl_6sh8iTsZvSpWHKj7ynn4m5Q12BsF`.
- URL technique : `https://lyceegest-g35f054fj-safe-scol.vercel.app`.
- Domaine servi : `https://lycee-blaise-cendrars-sevran.fr/`.

Le domaine principal reste volontairement attaché au pilote Vercel `preview`,
comme depuis la bascule du 4 septembre. Il utilise les variables propres à la
branche Git, pas l'environnement Vercel `production` relié à la base historique.

## Base Supabase du domaine

La cible confirmée par les variables du déploiement est la branche isolée
`guichet-lycee-preview`, référence `xijocumlwivhbmffrnlj`. Un dump de schéma a
été pris avant mutation, hors du dépôt Git.

L'historique distant ancien divergeait des noms de plusieurs migrations locales.
Un `db push --include-all` n'a donc pas été utilisé. Les 19 migrations additives
réellement absentes, de `20260904084803` à `20260908134500`, ont été exécutées
dans l'ordre puis marquées appliquées individuellement. Elles couvrent :

- les imports nominatifs privés ;
- les actualités flash et leur pont de communication ;
- le coffre de codes et sa remise contrôlée ;
- les propositions et échéances des sources de connaissance ;
- l'écriture et les formats tabulaires de l'emploi du temps ;
- les attributs nominatifs chiffrés ;
- la déduplication EDT et le rapport annuaire `text/plain`.

Les nouvelles tables étaient vides après migration. L'advisor de sécurité ne
signale aucune alerte et RLS avec FORCE RLS est actif sur toutes les tables
privées ajoutées.

## Secrets et acteur technique

Un utilisateur technique `depot-technique@lyceegest.invalid` a été créé sans
identité de connexion, sans mot de passe utilisable et sans confirmation email.
Son UUID est fourni à Vercel par `LYCEEGEST_DEPOT_ACTOR_ID` pour satisfaire les
clés étrangères et identifier les écritures automatiques.

Des valeurs neuves ont été générées sans affichage ni écriture dans Git :

- Vercel : empreinte SHA-256 du jeton Dépôt, clé privée RSA de transport, clés
  AES-256-GCM du coffre et des attributs, versions `v1` ;
- VPS : jeton clair, URL du Dépôt et clé publique RSA ;
- révélation : `CODE_VAULT_REVEAL_ENABLED=false`.

Sur le VPS, `/etc/lycee-support-preview/depot.env` et
`/etc/lycee-support-preview/depot-codes-public.pem` appartiennent à
`root:lycee-support` avec les droits `0640`. La clé publique a été relue par
OpenSSL. Aucun secret n'est reproduit dans ce document.

## Vérifications après mise en ligne

- accueil et espace agent : `200` ;
- `/api/content/public`, `/api/content/flash/public` et liste publique des
  demandes : `200`, avec `Cache-Control: no-store` pour les API ;
- routes agent, contenu administrateur et communications administrateur sans
  session : `401` ;
- `POST /api/depot/annuaire` sans jeton : `401` ;
- `GET /api/depot/annuaire` : `405` ;
- appel depuis le VPS avec le bon jeton et un corps JSON volontairement invalide :
  `415`, ce qui vérifie l'accord jeton/empreinte sans créer d'import ;
- recette publique existante : réussie, zéro écriture et zéro appel IA ;
- journal Vercel : aucune erreur applicative ; le seul message classé `error`
  est l'avertissement de dépréciation Node `url.parse()` émis pendant la sonde.

## Retour arrière

Le déploiement public précédent reste
`dpl_2w79JDfj6pKAnrEd8CGKGVDgBvTE`
(`https://lyceegest-1c5vw9kqq-safe-scol.vercel.app`) et peut recevoir à nouveau
l'alias si une régression apparaît. Les migrations sont additives ; elles ne
sont pas supprimées lors d'un retour arrière Web. Le dump de schéma antérieur
est conservé localement hors Git.

## État opérationnel

Le récepteur est en ligne et fermé sans jeton. La base ne contient encore aucun
annuaire actif, code, attribut nominatif ou emploi du temps importé. Le premier
export réel doit donc rester une opération surveillée : annuaire et rapport en
premier, validation humaine, puis attributs, codes et EDT selon le contrat
`docs/operations/DEPOT_LYCEE_API_CONTRACT_2026-09-08.md`.
