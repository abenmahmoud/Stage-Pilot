# Modèle de données - Centre de communications

## Statut

Contrat technique de preview. Les groupes réels, responsables, mentions et
durées restent à valider avant toute donnée ou diffusion réelle.

## Principes

- Toute ligne métier porte `institution_id` et les relations sensibles utilisent
  une clé composite avec cet établissement.
- Une source entrante devient `internal` et `draft` par défaut.
- Une audience contient uniquement une référence opaque de groupe. Aucune
  adresse email n'est stockée dans ce module.
- Une correction crée une version ; une version validée est immuable.
- Publication et diffusion restent deux décisions et deux interrupteurs séparés.
- Les files, livraisons, entrants et événements ne contiennent jamais le corps
  complet d'un message ni les coordonnées d'un destinataire.

## Entités prévues

### `communications`

Racine d'une information : source, empreinte, visibilité, état, version courante,
calendrier, éventuel contenu public lié et acteurs de validation.

### `communication_versions`

Instantané du titre, résumé, corps structuré, dates et points à confirmer. Une
version validée ou publiée n'est plus modifiable.

### `communication_audiences`

Références opaques de groupes, uniques par communication. Leur résolution reste
dans le Webmail côté serveur.

### `communication_deliveries`

Une ligne par version, référence opaque de contact et canal, avec clé
d'idempotence et état de délivrabilité. Aucune adresse en clair.

### `communication_jobs`

Travaux durables de publication, préparation, envoi, reprise ou annulation. Une
clé d'idempotence empêche le double traitement.

### `communication_inbound`

Reçus de fournisseurs par identifiant externe haché, éventuellement rattachés à
une communication. Le contenu extrait reste dans un stockage privé séparé.

### `communication_inbound_objects`

Registre opaque des corps et pièces jointes entrants. Une ligne contient
uniquement l'établissement, l'entrant parent, le type d'objet, une référence
HMAC, le type média, la taille, le chemin privé, l'empreinte et l'état du scan.
Elle ne contient jamais expéditeur, destinataire, objet, corps, nom de fichier
original ou jeton fournisseur. Le cycle autorisé est fermé : `reserved`,
`quarantine`, puis `clean`, `blocked`, `scan_error` ou `purged`. Un objet propre
exige une preuve machine `clamav_clean` et un passage préalable en quarantaine.

### `communication_inbound_object_events`

Audit append-only des réservations, mises en quarantaine, résultats de scan et
purges. Les événements sont liés à l'objet et à son établissement par une clé
composite. Le résumé est réservé à des codes et compteurs techniques bornés ;
aucun contenu utilisateur ni résultat antivirus brut ne doit y être écrit. La
base limite le résumé à 1 Ko, impose un schéma exact par type d'événement et
vérifie que l'événement correspond à l'état courant de l'objet. Les preuves de
scan ne peuvent pas être modifiées sans transition d'état autorisée.

### Stockage et file des contenus entrants

Les buckets `communication-inbound-quarantine` et
`communication-inbound-clean` sont privés et limités à 10 Mo par objet. La file
PGMQ `communication_inbound_scan` est privée et sans privilège client. Aucun de
ces composants n'est raccordé au webhook tant que le téléchargement fournisseur,
le worker ClamAV et la recette propre/EICAR ne sont pas validés. La durée de
conservation reste à décider avant toute activation réelle.

### `communication_events`

Audit fonctionnel minimal : type, ressource, acteur, résumé borné et date.

### `communication_settings`

Interrupteurs par établissement, tous à `false` par défaut : module,
publication et diffusion.

### `communication_templates` et `communication_template_events`

`communication_templates` contient uniquement les personnalisations des six
modèles du catalogue, par établissement. L'absence de ligne conserve le modèle
sûr livré par le code. La clé et le périmètre sont immuables et chaque mise à
jour incrémente exactement la version.

`communication_template_events` conserve un historique append-only sans
destinataire ni corps complet : modèle, version, état actif, auteur et date.

## Contrat de validation déjà implémenté

`shared/communication-policy.ts` refuse les champs inconnus, les sources hors
liste, les empreintes invalides, les adresses placées comme audience, une cible
sans groupe, une publication non publique et une expiration incohérente.

`api/_shared/communication-flags.ts` échoue fermé : la publication et l'envoi ne
peuvent être actifs si le module lui-même ne l'est pas.
