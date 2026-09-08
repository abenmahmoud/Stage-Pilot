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
identique est idempotent dès la quarantaine et pendant le traitement. Le rapport
`text/plain` est explicitement accepté dans le stockage privé.

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
humaines. Pour le multipart, le SHA-256 et un index unique partiel empêchent le
renvoi ou deux réceptions concurrentes de créer plusieurs versions.

## Vérifications déjà obtenues

- compilation TypeScript et build Vite : réussis ;
- 32 tests ciblés annuaire, entrée Dépôt, codes, attributs et payloads : réussis ;
- couverture des méthodes HTTP : 135 routes contrôlées ;
- limites explicites sur les corps HTTP : réussies ;
- intégrité des versions : 114 migrations uniques contrôlées et rejouées ;
- barrière complète `npm run test:preview-security-gate` : réussie ;
- intégrité des cinq spécifications et de leurs 637 tâches : réussie ;
- audit des dépendances de production : 0 vulnérabilité connue ;
- recette locale réelle du point d'entrée Dépôt : 21 contrôles sur annuaire,
  codes et EDT, puis 17 contrôles sur les attributs ;
- coffre de codes : 336 contrôles locaux cumulés sur l'écriture, l'attribution,
  les scénarios adverses et les cinq routes HTTP ;
- emploi du temps : 24 contrôles de dépôt, activation, remplacement et lecture ;
- aucune migration distante et aucune donnée réelle utilisées.

Après redémarrage Windows, le socket AF_UNIX `dockerInference` resté invalide a
été retiré uniquement via WSL. Docker Desktop a redémarré avec le moteur 29.3.1,
sans réinitialisation ni suppression d'image ou de volume. La pile Supabase a
ensuite été reconstruite et les 114 migrations ont été rejouées sur une base
locale vide.

Deux recettes utilisent les vrais handlers HTTP sur la boucle locale :
`npm run recipe:local-depot-fictitious-deliveries` pour annuaire, codes et EDT,
puis `npm run recipe:local-depot-attributs-persistence` pour les attributs et
leur activation. Elles n'héritent d'aucune URL distante ni fichier `.env` et
n'utilisent que des identités, fichiers, clés et codes fictifs. Leurs garde-fous
sont inclus dans `test:preview-security-gate`.

## Actions externes encore obligatoires

1. Relire les trois migrations
   `20260908013000_create_person_attribute_imports.sql`,
   `20260908133000_make_depot_schedule_idempotent.sql` et
   `20260908134500_allow_depot_verification_report.sql`.
2. Après réussite locale, appliquer ces migrations selon la procédure
   contrôlée de l'établissement. Ne jamais utiliser `--linked`, `db push` ou une
   URL distante depuis une session d'agent.
3. Créer ou sélectionner un compte technique Supabase lié au lycée et relever
   son UUID comme `LYCEEGEST_DEPOT_ACTOR_ID`.
4. Générer un jeton long côté VPS et ne mettre dans Vercel que son SHA-256 sous
   `LYCEEGEST_DEPOT_TOKEN_SHA256`.
5. Installer la clé privée RSA côté LyceeGest sous
   `LYCEEGEST_CODES_PRIVATE_KEY_PEM_BASE64`. Seule la clé publique correspondante
   va sur le VPS.
6. Poser les clés de chiffrement du coffre et des attributs conformément à
   `.env.local.example`. Ne jamais les écrire dans Git ou une conversation.
7. Configurer le VPS avec la base
   `https://lycee-blaise-cendrars-sevran.fr/api/depot` et le jeton clair.
8. Répéter dans l'environnement ciblé la recette entièrement fictive : annuaire + rapport,
   attributs + activation MFA, codes fictifs, puis EDT fictif.
9. Vérifier l'idempotence en renvoyant chaque même fichier une seconde fois.
10. Garder `CODE_VAULT_REVEAL_ENABLED=false` jusqu'à une recette séparée et
   autorisée du parcours de remise à une personne vérifiée.
11. Après validation seulement, Adel effectue le push puis la mise en ligne.

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

Le code et les migrations sont prêts et recettés localement, mais le site public ne bénéficie d'aucune de ces
modifications avant migration, configuration des secrets, recette fictive,
push et déploiement. Le circuit ne prétend pas avoir ingéré ou vérifié les
exports réels. La restitution finale des codes reste volontairement fermée.
