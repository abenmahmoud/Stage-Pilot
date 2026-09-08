# Passation Dépôt Lycée → LyceeGest — état Codex du 8 septembre 2026

Ce document donne à Claude la situation exacte après l'intégration locale du
Dépôt Lycée. Il ne contient aucune donnée réelle, aucun contact et aucun secret.

## État Git à reprendre

- dépôt attendu : `abenmahmoud/Stage-Pilot` ;
- branche : `codex/lycee-connect-prototype` ;
- aucun push ni déploiement n'a été effectué par Codex ;
- commits réalisés pour ce branchement :
  - `e57a758 feat(identity): valider les exports du Depot Lycee` ;
  - `5b3da59 feat(depot): recevoir les livrables chiffres` ;
  - `d4c5116 feat(identity): valider les attributs chiffres`.

Des fichiers de plans et scripts de nuit appartenant à une autre session restent
modifiés ou non suivis. Ils n'ont été ni modifiés ni inclus dans ces commits.

## Ce qui fonctionne désormais dans le code

### Annuaire

Le parseur accepte le contrat exact à 17 colonnes. Il rejoue les contrôles et
compare le résultat au `rapport_verification.txt`. Une divergence de compteur ou
de classe refuse le lot. Les contacts opérationnels restent dans le coffre
chiffré ; les tables de contrôle ne contiennent que leurs empreintes. Un dépôt
identique est idempotent.

### Réception automatique

`POST /api/depot/<type>` accepte `annuaire`, `attributs`, `codes` et `edt` avec
un jeton technique vérifié par son empreinte SHA-256. Les réponses restent
limitées à des identifiants, statuts et compteurs. Le contrat complet se trouve
dans `docs/operations/DEPOT_LYCEE_API_CONTRACT_2026-09-08.md`.

### Attributs

Chaque valeur est chiffrée séparément en AES-256-GCM. Le lot reste en `review`.
L'écran « Répertoire privé du lycée » montre uniquement le fichier, le nombre de
lignes et le statut. L'activation exige un gestionnaire autorisé, une session MFA
AAL2 et une justification. Elle échoue si l'annuaire actif a changé ou si le lot
est incomplet. Le remplacement d'une version active est atomique. Les événements
sont consignés dans `person_attribute_events`, protégé par RLS et des triggers
append-only.

### Codes

L'enveloppe `LGC1` est ouverte en mémoire avec RSA-OAEP-SHA256 puis
AES-256-GCM. Le CSV clair est strictement validé puis remis au point d'écriture
unique du coffre. Une attribution existante n'est pas remplacée. Le buffer clair
est effacé au mieux à la fin du traitement. Aucune valeur ne rejoint une réponse,
une erreur, un journal ou le modèle. La révélation reste désactivée.

### Emplois du temps

Le dépôt multipart couvre les PDF jusqu'à 4 Mo. Au-delà, le Dépôt réserve une
destination signée, envoie directement le PDF au stockage privé, puis confirme
l'import. Le circuit existant conserve antivirus, analyse, revue et activation
humaines.

## Vérifications déjà obtenues

- compilation TypeScript et build Vite : réussis ;
- 32 tests ciblés annuaire, entrée Dépôt, codes, attributs et payloads : réussis ;
- couverture des méthodes HTTP : 135 routes contrôlées ;
- limites explicites sur les corps HTTP : réussies ;
- intégrité des versions : 112 migrations uniques contrôlées ;
- barrière complète `npm run test:preview-security-gate` : réussie ;
- intégrité des cinq spécifications et de leurs 635 tâches : réussie ;
- audit des dépendances de production : 0 vulnérabilité connue ;
- aucune migration distante et aucune donnée réelle utilisés.

La recette avec une vraie base locale n'a pas pu être exécutée. Le diagnostic du
8 septembre a isolé un défaut Docker Desktop 4.67 sur Windows build 26200 : les
sockets AF_UNIX `dockerInference` puis `docker-secrets-engine/engine.sock`
deviennent des points NTFS inaccessibles. Les anciens dossiers d'exécution ont
été conservés par renommage avec le suffixe `codex-stale-20260908-1045` ; aucune
image, aucun volume et aucune base n'ont été supprimés. Docker recrée aussitôt un
socket invalide, ce qui impose un redémarrage complet de Windows avant la recette.

La recette est maintenant prête sous la commande
`npm run recipe:local-depot-attributs-persistence`. Elle utilise le vrai handler
HTTP `/api/depot/attributs`, une pile Supabase exclusivement locale, un acteur et
une identité fictifs, puis vérifie l'authentification technique, le chiffrement,
l'idempotence, l'activation et le journal append-only. Son garde-fou local est
inclus dans `test:preview-security-gate`.

## Actions externes encore obligatoires

1. Relire la migration
   `supabase/migrations/20260908013000_create_person_attribute_imports.sql`.
2. Après redémarrage complet de Windows, démarrer Docker Desktop et la pile
   Supabase locale, appliquer les migrations à cette base jetable, puis lancer
   `npm run recipe:local-depot-attributs-persistence`.
3. Après réussite locale, appliquer la migration selon la procédure
   contrôlée de l'établissement. Ne jamais utiliser `--linked`, `db push` ou une
   URL distante depuis une session d'agent.
4. Créer ou sélectionner un compte technique Supabase lié au lycée et relever
   son UUID comme `LYCEEGEST_DEPOT_ACTOR_ID`.
5. Générer un jeton long côté VPS et ne mettre dans Vercel que son SHA-256 sous
   `LYCEEGEST_DEPOT_TOKEN_SHA256`.
6. Installer la clé privée RSA côté LyceeGest sous
   `LYCEEGEST_CODES_PRIVATE_KEY_PEM_BASE64`. Seule la clé publique correspondante
   va sur le VPS.
7. Poser les clés de chiffrement du coffre et des attributs conformément à
   `.env.local.example`. Ne jamais les écrire dans Git ou une conversation.
8. Configurer le VPS avec la base
   `https://lycee-blaise-cendrars-sevran.fr/api/depot` et le jeton clair.
9. Exécuter d'abord une recette entièrement fictive : annuaire + rapport,
   attributs + activation MFA, codes fictifs, puis EDT fictif.
10. Vérifier l'idempotence en renvoyant chaque même fichier une seconde fois.
11. Garder `CODE_VAULT_REVEAL_ENABLED=false` jusqu'à une recette séparée et
    autorisée du parcours de remise à une personne vérifiée.
12. Après validation seulement, Adel effectue le push puis la mise en ligne.

## Prompt direct à donner à Claude

> Reprends la branche `codex/lycee-connect-prototype` du dépôt exact
> `abenmahmoud/Stage-Pilot`. Lis
> `docs/operations/PASSATION_DEPOT_LYCEE_CODEX_2026-09-08.md` et
> `docs/operations/DEPOT_LYCEE_API_CONTRACT_2026-09-08.md`. Vérifie d'abord le
> `git status` et ne touche pas aux plans ni scripts de nuit appartenant à une
> autre session. Ne lis jamais le dossier privé contenant les données réelles.
> N'affiche, ne journalise et ne transmets aucun code ou donnée nominative à un
> modèle. Rejoue la barrière de sécurité et la recette locale avec des données
> fictives. Prépare ensuite les variables et la configuration du VPS sous forme
> de noms et d'étapes, sans afficher les valeurs. Ne pousse, ne déploie et
> n'applique aucune migration distante. Signale précisément ce qui nécessite
> encore l'action d'Adel.

## Limites honnêtes

Le code est prêt localement, mais le site public ne bénéficie d'aucune de ces
modifications avant migration, configuration des secrets, recette fictive,
push et déploiement. Le circuit ne prétend pas avoir ingéré ou vérifié les
exports réels. La restitution finale des codes reste volontairement fermée.
