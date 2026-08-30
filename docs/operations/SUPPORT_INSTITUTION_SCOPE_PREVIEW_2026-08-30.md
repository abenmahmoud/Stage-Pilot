# Cloisonnement des demandes - recette preview

## Périmètre

- Base : branche Supabase `guichet-lycee-preview` uniquement.
- Migrations : `20260830020355_scope_support_requests_by_institution.sql`,
  `20260830041544_scope_support_technical_tables_by_institution.sql` et
  `20260830041931_index_support_technical_scope_foreign_keys.sql`.
- Données réelles, production, DNS, VPS, Webmail, ENT et PRONOTE : non modifiés.

## Contrat

- Toute demande porte un établissement obligatoire, référencé et immuable.
- Une route publique utilise seulement l'établissement configuré côté serveur.
- Un agent utilise l'établissement de son adhésion active, en plus de son service.
- Les agrégats et pièces passent par la demande cloisonnée.
- Une tâche email porte l'établissement ; le worker vérifie la correspondance.
- Exécutions, échecs, livraisons et reçus webhook portent aussi l'établissement.
- Le worker antivirus contrôle le dossier, le message et la pièce dans ce
  périmètre avant tout téléchargement ; sa file de preview ne contenait aucune
  ancienne tâche sans établissement.
- La file email PGMQ reste partagée : son worker échoue fermé si plusieurs
  établissements deviennent actifs ou pilotes.

## Idempotence

- Demande : unicité `(institution_id, idempotency_key_hash)`.
- Message : unicité `(request_id, client_idempotency_key_hash)`.
- Une même empreinte peut exister dans deux établissements ou deux dossiers,
  mais sa répétition dans le même périmètre est refusée.

## Preuves de recette

La preview possédait un seul établissement actif, onze demandes et vingt
messages avant migration. Les onze demandes ont été rattachées à cet
établissement sans lecture de leur contenu.

Une transaction entièrement fictive a ensuite :

1. créé un second établissement en brouillon ;
2. créé deux demandes avec la même empreinte dans deux établissements ;
3. refusé la même empreinte deux fois dans un établissement ;
4. refusé le déplacement d'une demande vers l'autre établissement ;
5. accepté la même empreinte de message dans deux dossiers ;
6. refusé sa répétition dans le même dossier ;
7. exécuté `ROLLBACK`.

Le contrôle final retourne onze demandes, zéro demande sans établissement et
zéro donnée synthétique. RLS est activée et forcée ; `anon` et `authenticated`
n'ont aucun droit de lecture. Les avis Supabase propres à ce lot sont seulement
informatifs : table privée sans politique client et index neuf encore inutilisé.

Une seconde transaction fictive a ensuite :

1. accepté le même reçu webhook dans deux établissements ;
2. refusé sa répétition dans le même établissement ;
3. refusé de lier un job au dossier d'un autre établissement ;
4. refusé de changer l'établissement d'une exécution ;
5. refusé de lier une livraison au message d'un autre établissement ;
6. exécuté `ROLLBACK` avec zéro résidu.

Les 28 exécutions historiques sont rattachées à leur dossier. Les quatre tables
techniques ne contiennent aucune ligne sans établissement. RLS est activée et
forcée ; `anon` et `authenticated` ne possèdent aucun droit direct. Les clés
étrangères composites possèdent leurs index couvrants.

## Limites ouvertes

- Séparer la file email PGMQ par établissement, ou utiliser un mécanisme de réclamation
  qui ne peut jamais réserver la tâche d'un autre établissement, avant d'en
  activer plusieurs sur la même base.
- Ajouter les politiques RLS fondées sur les adhésions lorsque les API ne seront
  plus les seules à accéder aux demandes.
- Réaliser la recette avec comptes agents nominatifs et MFA avant un pilote réel.
