# Plan - Centre de communication du lycée

## Architecture proportionnée

Le module complète l'espace de contenus existant sans créer un nouveau site :

- **LyceeGest** conserve le brouillon, les versions, l'approbation, la page
  officielle et les états de diffusion.
- **Webmail du Lycée** reste la référence des contacts validés et le service de
  diffusion. Une API serveur limitée permettra de cibler des groupes sans
  transmettre la liste au navigateur.
- **Brevo** effectue les envois individuels et remonte les événements de
  délivrabilité. Son service d'analyse entrante pourra recevoir les réponses et
  les emails transférés sur un sous-domaine distinct.
- **Le site public** lit uniquement la version publiée via l'API existante.

Le contrat du registre est signé et cloisonné par établissement. Une requête
de cinq minutes obtient un instantané valable au maximum une heure contenant
seulement des références de groupe, des libellés, des états et des comptages
agrégés. LyceeGest ne reçoit ni membres, ni emails, ni téléphones. La résolution
nominative reste dans le Webmail et un instantané n'autorise jamais un envoi.
Au moment du travail validé, seul le serveur reçoit des références de contact
opaques, actives et validées ; la liste nominative reste absente de LyceeGest et
de son navigateur.

## Modèle de données additif

- `communications` : contenu lié, source, visibilité, état, calendrier et
  validateur.
- `communication_audiences` : groupes ciblés, sans liste d'adresses en clair.
- `communication_deliveries` : référence du contact, canal, état, tentative et
  identifiant fournisseur.
- `communication_inbound` : identifiant du message, source, état d'analyse et
  brouillon créé.
- `communication_jobs` : travail durable de publication, envoi, reprise ou
  génération de récapitulatif.
- `communication_events` : audit fonctionnel sans corps complet ni adresse en
  clair.

Les contenus publics continuent d'utiliser `site_content_items`, ses versions et
ses fichiers. Une communication interne ne reçoit jamais de version publique.

La publication publique a été éprouvée séparément sur la branche Supabase de
preview. La page, son instantané, le rattachement de la communication et les
deux traces d'audit partagent la même transaction. Une panne tardive annule
l'ensemble. Ce chemin ne crée jamais d'audience, de livraison ou de travail
d'envoi ; les interrupteurs Vercel restent fermés tant qu'un pilote public n'est
pas explicitement autorisé.

Le flux public distingue désormais les publications courantes des publications
simplement expirées. Un retrait manuel garde la priorité et reste exclu des deux
ensembles ainsi que de l'accès par slug. Le curseur opaque contient son mode
pour empêcher une reprise dans le mauvais flux. La durée de conservation des
expirés reste une décision éditoriale avant fermeture de T015.

## Automatisation

1. La source est enregistrée avant analyse.
2. Le texte est extrait localement, contrôlé puis pseudonymisé.
3. L'aide IA produit une proposition structurée et des points à vérifier.
4. La validation crée une version officielle et un travail durable.
5. Le worker résout les contacts côté serveur puis envoie individuellement.
6. Les webhooks mettent à jour les livraisons de manière idempotente.
7. Les réponses rejoignent la boîte de traitement de la communication.

Pour un email transféré, l'entrée automatique reste plus stricte : Bearer
fournisseur, expéditeur HMAC et alias HMAC doivent tous être autorisés côté
serveur. Un acteur technique doit aussi être administrateur actif du même
établissement. La transaction ne crée qu'un brouillon interne à relire ; le
rejeu est absorbé avant toute seconde version.

La boîte de traitement ne reçoit d'abord que la catégorie, l'état, la date et
la communication rattachée. Le texte brut reste absent tant que le stockage
privé et son contrôle antivirus ne sont pas validés. Toutes les catégories sont
des propositions : un agent habilité doit toujours lire puis décider.

Le téléchargement des pièces utilise exclusivement l'endpoint HTTPS Brevo
documenté. `ContentLength` dans le webhook est une estimation, pas la taille
immuable du registre : celle-ci provient du flux réellement reçu et borné avant
réservation. Les jetons restent en mémoire dans ce transport serveur. Le dépôt
privé est sans écrasement et doit être relu avec taille, média et SHA-256 exacts
avant confirmation. Une réponse perdue se reprend donc sans remplacer le
premier fichier. Ce transfert n'est pas une preuve antivirus et ne peut rendre
un objet propre. Aucun raccordement réel avant la recette ClamAV et la décision
de conservation.

L'ingestion d'une pièce vérifie d'abord l'existence de l'entrant dans son
établissement, mesure le téléchargement, puis valide une réservation dans une
transaction distincte. Le dépôt et sa confirmation s'exécutent sous verrou de
l'objet : une panne conserve ainsi la référence réservée pour la reprise.
Le rejeu d'un objet déjà confirmé ne redépose rien et ne relance pas son scan ;
son empreinte doit correspondre. Un objet purgé n'est jamais recréé. Une borne
d'admission par instance refuse immédiatement l'excès sans retenir une file de
jetons en mémoire ; elle ne remplace pas la limitation distribuée de la route.

## Adaptateur antivirus entrant

L'adaptateur transmet uniquement une copie bornée du contenu à `clamdscan`
par entrée standard, après contrôle taille/SHA-256. Aucun nom utilisateur,
jeton fournisseur ou secret applicatif n'est transmis au processus. Une
configuration temporaire privée fixe la connexion à un socket local ou à
`127.0.0.1` et une limite de flux supérieure aux 10 Mo acceptés, pour éviter
la troncature silencieuse du client. Le contenu n'est pas écrit sur disque.
Le processus est sans shell, limité en durée, sorties et concurrence ; toute
sortie ambiguë ou panne empêche le verdict propre. Les fichiers Office passent
aussi la politique d'archives existante avant retour du résultat.

Ce module ne modifie ni base, ni stockage, ni file. Son résultat doit encore
être recoupé sous verrou par le futur worker. Le déploiement exige une recette
avec le vrai ClamAV et ses signatures à jour, les limites du démon contrôlées,
et des preuves fichier propre/EICAR/limites. Un exécutable fictif teste le
pilotage du processus, pas l'efficacité de l'antivirus.

## Traitement durable des objets entrants

Le worker reçoit une tâche louée PGMQ, recoupe son compteur de lecture et son
périmètre puis verrouille l'objet associé. Lecture, analyse et dépôt propre
vérifié précèdent la transition persistée. L'événement et l'acquittement de la
tâche sont dans la même transaction. Un commit perdu se reprend sans refaire
un objet terminal ; une copie propre orpheline reste privée et peut être relue
à la reprise. Aucune suppression de quarantaine dans ce lot.

Une erreur laisse une preuve fermée, remet la tâche à plus tard et conserve le
contenu ; au cinquième essai elle est archivée pour intervention. Le worker
reste limité à la preview, sans boucle permanente ni activation automatique.
Les emails RFC822 restent en attente de revue tant que leurs pièces internes
ne passent pas une extraction bornée et le contrôle Office par objet.

Le producteur ne met en file qu'après le dépôt vérifié et dans la transaction
de confirmation `quarantine` ; aucun scan n'est programmé lors de la simple
réservation. Un job `reserved` injecté hors contrat reste archivé sans
transfert ni modification d'objet. Les limites opérateur du worker utilisent
des chaînes décimales canoniques, bornées à 20 tâches et 4 traitements.

## Interface simplifiée

L'écran principal propose trois commandes visibles :

1. `Nouvelle communication`
2. `À valider`
3. `Envois et réponses`

Le parcours de création reste en trois étapes : `Déposer`, `Vérifier`,
`Publier et informer`. Les réglages avancés restent repliés.

## Autorisations retenues pour le pilote

| Action | Administration | Proviseur | Superadmin |
| --- | --- | --- | --- |
| Déposer et corriger un brouillon | Oui | Oui | Oui |
| Demander une validation | Oui | Oui | Oui |
| Rendre public | Non | Oui | Oui |
| Choisir une audience réelle | Non | Oui | Oui |
| Programmer ou lancer un envoi | Non | Oui | Oui |
| Reprendre un envoi en erreur | Non | Oui | Oui |

Ces droits reprennent ceux du module de contenus existant. Aucun code direction
partagé ne remplace les comptes nominatifs et le MFA prévus pour la production.

## Déploiement

1. Migrations additives sur la branche Supabase de preview uniquement.
2. Simulation avec contacts fictifs et domaine d'envoi de test.
3. Vérification téléphone, ordinateur, accessibilité et charge.
4. Pilote avec un petit groupe autorisé.
5. Activation de la collecte email et des listes réelles sur ordre explicite.
6. Aucun changement DNS, Hostinger, VPS ou envoi de masse dans ce lot.

## Retour arrière

- L'interrupteur `COMMUNICATIONS_ENABLED` masque le module sans retirer les
  contenus existants.
- L'interrupteur `COMMUNICATION_SEND_ENABLED` interdit tout envoi réel.
- Une publication peut être archivée sans supprimer sa version.
- Une campagne en attente peut être annulée ; un email déjà remis ne peut pas
  être rappelé et sa correction passe par une nouvelle version officielle.
