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

### `communication_events`

Audit fonctionnel minimal : type, ressource, acteur, résumé borné et date.

### `communication_settings`

Interrupteurs par établissement, tous à `false` par défaut : module,
publication et diffusion.

## Contrat de validation déjà implémenté

`shared/communication-policy.ts` refuse les champs inconnus, les sources hors
liste, les empreintes invalides, les adresses placées comme audience, une cible
sans groupe, une publication non publique et une expiration incohérente.

`api/_shared/communication-flags.ts` échoue fermé : la publication et l'envoi ne
peuvent être actifs si le module lui-même ne l'est pas.
