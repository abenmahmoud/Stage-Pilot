# Plan technique - Guichet numérique

## 1. Décision d'hébergement

### Architecture retenue

- **Vercel** : application React, PWA et fonctions API de LyceeGest.
- **Supabase `lyceegest` en `eu-west-3`** : Postgres, Auth, Storage privé,
  Realtime, file durable et planification.
- **Brevo** : emails transactionnels, événements de délivrabilité et réception
  structurée des réponses email.
- **VPS** : antivirus des fichiers, sauvegarde secondaire chiffrée et contrôle
  indépendant de disponibilité.
- **Hostinger/WordPress** : site éditorial actuel conservé pendant la migration,
  avec lien visible vers la PWA.

Cette répartition évite de reconstruire Supabase sur le VPS et évite aussi de
faire dépendre la conservation des demandes d'une fonction Vercel temporaire.
Le VPS a un rôle utile mais ne devient pas le point de panne principal.

### Environnement de validation actif au 25 août 2026

- branche Supabase sans données de production : `guichet-lycee-preview` ;
- preview Vercel protégée :
  `lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app` ;
- workers VPS isolés dans `/opt/lycee-support-preview` ;
- minuteurs séparés pour les emails sortants et l'antivirus ;
- production Supabase, DNS du lycée et site WordPress inchangés.

La branche Supabase est facturée environ 0,01344 USD par heure. Elle devra être
supprimée après validation ou remplacée par l'environnement définitif afin de ne
pas conserver un coût d'aperçu inutile.

### Domaines proposés

- `app.lycee-blaise-cendrars-sevran.fr` : LyceeGest/PWA sur Vercel.
- `mail.lycee-blaise-cendrars-sevran.fr` : messagerie actuelle, conservée.
- `reponse.lycee-blaise-cendrars-sevran.fr` : réception Brevo, avec MX dédiés.
- `lycee-blaise-cendrars-sevran.fr` : site public et pages éditoriales.

## 2. Principe de fiabilité

La base est la source de vérité. Les emails, SMS, appels IA, antivirus et
notifications sont des effets secondaires rejouables.

### Création d'une demande

1. Le client génère une `Idempotency-Key` et conserve le brouillon dans IndexedDB.
2. L'API valide les champs et les limites.
3. Une transaction Postgres écrit `support_requests`, le premier
   `support_message`, `support_events` et appelle `pgmq.send`.
4. La transaction est validée.
5. L'API répond avec le numéro public et crée la session d'appareil.
6. Un worker traite ensuite les notifications.

Le navigateur ne considère la demande envoyée qu'après la réponse de l'étape 5.
En cas de doute réseau, il renvoie la même clé et récupère le même dossier.

### Envois asynchrones

- Une file Supabase **Basic Queue** est l'outbox transactionnelle ; il n'existe
  pas de seconde table de jobs concurrente. Une file `unlogged` est interdite.
- Un worker lit un petit lot, verrouille chaque tâche, exécute et archive.
- Une clé d'idempotence existe par destinataire, canal et version du message.
- Relances : immédiate, 1 min, 5 min, 15 min, 1 h, puis file d'échec.
- La file d'échec est visible dans l'espace direction avec bouton de reprise.
- Les workers VPS traitent les emails et fichiers chaque minute. Un contrôle
  ultérieur vérifiera aussi les SLA et les notifications non livrées.

## 3. Jetons, mémoire et accès multi-appareil

### Identifiants distincts

- `public_code` : lisible, partageable avec l'accueil, jamais secret.
- `magic_token` : aléatoire 256 bits, usage unique, stocké seulement sous forme
  de hash, expiration 30 minutes.
- `device_session` : jeton rotatif côté serveur, présenté dans un cookie HttpOnly.
- `recovery_code` : code ponctuel protégé par limitation de tentatives.

### Même appareil

- IndexedDB garde le brouillon et la liste des numéros publics.
- Un cookie sécurisé permet de rouvrir les dossiers autorisés.
- Le service worker met en cache uniquement l'interface publique, jamais les
  réponses privées ni les pièces jointes.

### Nouvel appareil

- Lien magique email, code SMS lorsqu'il sera activé, ou vérification manuelle.
- Toute nouvelle session est visible et révocable par la direction.
- Changement d'email ou téléphone : nouvelle vérification obligatoire.

## 4. Flux email bidirectionnel

### Sortant

1. L'agent valide une réponse.
2. Le message est sauvegardé avec `delivery_status=pending`.
3. Un job Brevo est ajouté à la Basic Queue dans la même transaction.
4. Brevo reçoit le message avec une clé d'idempotence et un `Reply-To` unique.
5. Le `messageId` Brevo est enregistré.
6. Les webhooks mettent à jour livré, différé, rejeté ou spam.

L'expéditeur recommandé est
`Lycée Blaise Cendrars <assistance@lycee-blaise-cendrars-sevran.fr>`, authentifié
par SPF, DKIM et DMARC. Le Gmail de contact reste une boîte de secours et de
surveillance ; l'utiliser comme expéditeur Brevo empêcherait de maîtriser
l'authentification du domaine Gmail.

### Entrant

1. Le destinataire répond normalement à l'email.
2. Brevo reçoit l'email sur `reponse...` et appelle le webhook Vercel.
3. Le webhook vérifie son secret, son format et l'identifiant du destinataire.
4. `Message-Id` et identifiant Brevo empêchent les doublons.
5. Le texte nettoyé est enregistré comme message entrant.
6. Les pièces jointes vont en quarantaine.
7. Une notification Realtime et une tâche agent sont créées.

Le fil web reste la copie canonique, même si une personne n'utilise que l'email.

## 5. Fichiers et photos

### Téléversement

- L'API crée une autorisation signée liée au dossier et au type attendu.
- Le navigateur envoie directement vers le bucket privé `support-quarantine`.
- Le chemin ne contient ni nom, ni classe, ni email.
- Le hash SHA-256, la taille réelle et le type détecté sont enregistrés.

### Contrôle

- Le worker VPS télécharge le fichier de quarantaine avec une URL courte.
- ClamAV analyse le contenu.
- Un fichier sain est déplacé vers `support-clean`.
- Un fichier suspect reste isolé et crée une alerte direction.
- Les aperçus sont générés sans exécuter le contenu original.

### Sauvegarde

- La base Supabase est sauvegardée selon le plan actif.
- Les objets Storage nécessitent une sauvegarde séparée.
- Le VPS réalise chaque nuit une copie chiffrée incrémentale des objets sains et
  du manifeste des fichiers.
- Une restauration test est exécutée mensuellement sur un échantillon.

## 6. Espace agent

### Écran principal

- quatre compteurs : nouveau, urgent, en retard, attente demandeur ;
- file virtuelle paginée, pas 200 cartes chargées en même temps ;
- filtres enregistrables ;
- sélection clavier ;
- panneau dossier sans changement de page ;
- réponse, note interne, pièces jointes, historique et données de contact.

### Automatisation déterministe, même sans IA

- règles par catégorie et mots-clés ;
- attribution par compétence et charge active ;
- calcul SLA ;
- relance automatique du demandeur ;
- clôture proposée après réponse et délai ;
- modèles de réponse validés ;
- détection de doublons par contact, catégorie et période.

### Couche IA optionnelle

- adaptateur serveur activable par variable d'environnement ;
- pseudonymisation avant appel ;
- résultat structuré et validé ;
- coût et durée enregistrés ;
- aucune clé dans le navigateur ;
- interruption automatique après erreurs répétées ;
- retour immédiat aux règles déterministes si le fournisseur est indisponible.

Le fournisseur et la clé seront décidés séparément. La V1 n'en dépend pas.

## 7. Capacité et performance

### Cible initiale

- 1 500 personnes ;
- 200 demandes créées sur quelques minutes ;
- 10 agents connectés ;
- 10 000 dossiers par année scolaire ;
- 30 Mo maximum de pièces jointes par dossier.

### Moyens

- index sur statut/priorité/date/agent/catégorie ;
- pagination par curseur ;
- transactions courtes ;
- envoi externe hors transaction ;
- pool de connexions Supabase ;
- lecture de queue par lots ;
- réponses HTTP rapides, traitement lourd asynchrone ;
- test de charge automatisé à 200 créations et 1 000 lectures.

## 8. Sécurité avant ouverture publique

L'audit du 25 août 2026 a trouvé quatre sujets préexistants :

1. `public.get_role()` est une fonction `SECURITY DEFINER` exécutable par `anon`
   et `authenticated` ; retirer ces droits ou la remplacer.
2. `public.set_updated_at()` n'impose pas son `search_path` ; le fixer.
3. La protection contre les mots de passe compromis est désactivée ; l'activer.
4. Plusieurs politiques RLS recalculent `auth.*` par ligne et certaines sont
   redondantes ; les corriger et mesurer avant suppression.

Autres corrections obligatoires :

- ne plus renvoyer le détail brut des erreurs serveur dans les réponses API ;
- ajouter des en-têtes de sécurité et une politique CSP ;
- vérifier les secrets de webhooks ;
- limiter les requêtes par session, contact et IP hachée ;
- activer MFA pour les rôles sensibles ;
- conserver la destination demandée lors de la connexion, ouvrir directement le
  mode personnel pour l'espace agent et contrôler les rôles à la fois dans le
  routeur et dans les API ;
- fournir une récupération de mot de passe Supabase par email avec message
  anti-énumération, URL de retour autorisée et nouveau mot de passe fort ;
- journaliser les exports, téléchargements et changements de contact ;
- tester toutes les politiques RLS avec les rôles réels.

Références Supabase :

- https://supabase.com/docs/guides/database/database-linter
- https://supabase.com/docs/guides/auth/password-security

## 9. Protection des mineurs et IA

- Afficher une information simple et adaptée aux élèves.
- Collecter seulement ce qui est nécessaire au traitement.
- Ne pas envoyer les identités et coordonnées à l'IA.
- Associer le DPO et produire une AIPD avant activation IA sur données d'élèves.
- Permettre l'accès, la rectification et la suppression lorsque applicable.
- Éviter toute décision entièrement automatisée.

Référence : https://www.cnil.fr/fr/education-mise-en-place-systeme-ia

## 10. Observabilité

- tableau de santé : API, DB, queue, Brevo entrant/sortant, antivirus, sauvegarde ;
- alertes sur file d'échec, webhook invalide, hausse des rejets et SLA dépassé ;
- identifiant de corrélation commun entre demande, job, email et webhook ;
- logs sans contenu personnel ;
- rapport quotidien direction : reçues, résolues, en retard, échecs de contact ;
- exercice mensuel de restauration et test trimestriel du canal de secours.

## 11. Déploiement sans interruption

1. Développer sur branche Git et environnement de prévisualisation.
2. Appliquer la migration sur une branche Supabase ou base de test.
3. Tester avec données fictives.
4. Déployer une preview Vercel protégée.
5. Faire valider les parcours par la direction.
6. Créer les DNS `app` et `reponse`.
7. Activer d'abord le formulaire et le traitement manuel.
8. Activer Brevo entrant puis les notifications.
9. Activer l'IA derrière un feature flag après validation DPO.
10. Ajouter le lien au site WordPress sans supprimer ses pages.
