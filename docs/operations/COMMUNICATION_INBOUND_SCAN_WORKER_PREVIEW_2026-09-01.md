# Worker d'analyse des communications entrantes

## Statut

Code préparé, non activé. `005/T022K` reste ouverte pour la revue externe du
nouveau worker et son exécution intégrée avec le vrai ClamAV et PostgreSQL.
Production, VPS, Webmail, DNS, secrets et interrupteurs inchangés. Le programme
n'est ni une route HTTP, ni un Cron, ni un service installé.

## Circuit et reprise

1. Louer une tâche PGMQ pour 300 secondes, sans contenu ni coordonnées.
2. Dans une transaction, contrôler identifiant, compteur et expiration du bail,
   verrouiller la tâche puis l'objet du même établissement et entrant.
3. Lire la quarantaine privée (10 Mio maximum), vérifier taille et SHA-256,
   analyser par l'adaptateur ClamAV, vérifier son reçu et son horodatage.
4. Pour un verdict propre uniquement, déposer sans écrasement dans le bucket
   privé propre puis relire et vérifier type, taille et empreinte.
5. Enregistrer état, preuve, événement et acquittement ensemble. Une erreur
   PostgreSQL annule le tout ; une copie propre déjà déposée reste privée et
   sera revérifiée lors de la reprise. La quarantaine n'est jamais supprimée.

Un objet déjà `clean`, `blocked` ou `purged` n'est pas réanalysé ou recréé.
Une tâche périmée ne fait aucun transfert. Un message malformé ou hors périmètre
est archivé sans toucher l'objet. Les opérations utilisent des paramètres SQL,
un délai de verrou de 5 secondes et de requête de 10 secondes. Le délai sans
requête dans la transaction est de 300 secondes.

Les erreurs temporaires `scanner_unavailable`, `scan_timeout` et
`storage_read_failed` provoquent une attente de 30, 120, 300 puis 900 secondes.
Le cinquième échec archive la tâche ; une location au-delà de cinq lectures
n'analyse plus rien. Le compteur appartient au message PGMQ : une future
reprise administrative créant un autre message devra imposer son propre
contrôle et journal. Il n'existe pas de reprise infinie automatique.

Les erreurs de contenu ou d'archive sont définitives pour cette tâche. Un
RFC822 reste en quarantaine avec `unsupported_media` tant que l'extraction de
ses pièces internes n'est pas validée. Les ZIP ordinaires annoncés comme PDF,
texte ou images sont refusés avant scan. Ce contrôle ne certifie pas tous les
formats ni les fichiers polyglottes ; les parseurs et alertes du vrai antivirus
doivent être qualifiés séparément.

## Conditions avant tout lancement

La commande déclarée est `npm run worker:communication-inbound-scan` ; seule,
elle refuse de démarrer. Un opérateur devra faire autoriser explicitement la
cible et fournir, via le gestionnaire de secrets, les paramètres suivants :

- `--preview-only`, `COMMUNICATION_INBOUND_SCAN_ENABLED=true` et
  `COMMUNICATION_INBOUND_CLAMAV_VERIFIED=true` ; ce dernier est une attestation
  manuelle après recette, pas une vérification automatique du moteur.
- `DATABASE_URL` du projet `xijocumlwivhbmffrnlj`, base `postgres`, connexion
  directe ou pooler Supabase avec utilisateur lié à ce projet. Aucun paramètre
  de requête ni fragment d'URL admis ; ports 5432/6543 seulement, TLS vérifié.
- `VITE_SUPABASE_URL` exactement lié à cette preview et
  `SUPABASE_SERVICE_ROLE_KEY` uniquement dans le processus serveur.
- `CLAMDSCAN_PATH` absolu et `CLAMD_SOCKET_PATH` local, ou `CLAMD_PORT` sur
  127.0.0.1. Le scanner n'hérite pas des secrets de ces services.
- Facultatif : lot de 1 à 20 (`COMMUNICATION_INBOUND_SCAN_BATCH_SIZE`, défaut
  10), simultanéité de 1 à 4 (`COMMUNICATION_INBOUND_SCAN_CONCURRENCY`, défaut 2).

Ces bornes sont locales au processus. Elles ne constituent pas un limiteur
distribué. Le programme attend toutes les opérations engagées, affiche
uniquement des compteurs, puis ferme ses connexions. Aucun planificateur ou
mécanisme de supervision n'est activé par cette commande.

## Preuves acquises

- `npm run test:communication-inbound-scan-worker` : vingt tests locaux,
  interruptions, rejeux, baux périmés, substitutions, épuisement, portée SQL,
  stockage simulé, refus de configuration et admission bornée.
- `npm run test:communication-inbound-scanner` : dix-huit tests avec processus
  Node fictifs, pas un vrai moteur ClamAV.
- `supabase/tests/communication_inbound_scan_worker.test.sql` : exécuté via le
  connecteur sur la branche `guichet-lycee-preview`, confirmée distincte du
  projet principal. Le `read` utilise un filtre contenant exactement la fixture,
  jamais une lecture générale de la file. Les six résidus après rollback sont
  nuls : établissement, entrant, objets, événements, file active et archive.
- Les signatures réelles PGMQ confirment `read(..., conditional jsonb)` avec
  défaut vide, `set_vt` retournant une ligne et `delete`/`archive` booléens.
- Communications, sécurité preview et build passent ; aucune vulnérabilité
  connue dans l'audit npm des dépendances d'exécution.

La recette SQL exerce les requêtes et les contraintes serveur. Elle ne lance
pas le programme JavaScript complet ni un transport de fichiers réel. Les
tests de panne locale ne simulent pas un redémarrage physique de la base.

## Reste avant activation

Revue Claude du lot, connexion directe de test utilisable, qualification du
ClamAV réel (signatures, EICAR, propre, chiffré, limites, erreur et reprise),
preuve intégrée du transfert, dimensionnement global et supervision, traitement
opérateur des archives, conservation et purge approuvées. Le statut `clean`
ne crée aucun lien public ni droit utilisateur ; l'accès doit encore passer
par les contrôles du demandeur et de l'établissement.

La mission Claude de ce lot a été proposée pour 3 USD, sans réponse au moment
de ce jalon. Aucun coût externe supplémentaire engagé. Le résultat de la
mission précédente concernait l'adaptateur, pas le worker présent.

Référence de file vérifiée le 1er septembre 2026 :
[API PGMQ de Supabase](https://supabase.com/docs/guides/queues/pgmq).
