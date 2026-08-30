# Cloisonnement des demandes - recette preview

## Périmètre

- Base : branche Supabase `guichet-lycee-preview` uniquement.
- Migration : `20260830020355_scope_support_requests_by_institution.sql`.
- Données réelles, production, DNS, VPS, Webmail, ENT et PRONOTE : non modifiés.

## Contrat

- Toute demande porte un établissement obligatoire, référencé et immuable.
- Une route publique utilise seulement l'établissement configuré côté serveur.
- Un agent utilise l'établissement de son adhésion active, en plus de son service.
- Les agrégats et pièces passent par la demande cloisonnée.
- Une tâche email porte l'établissement ; le worker vérifie la correspondance.
- Les tables techniques historiques sans établissement restent utilisables
  uniquement lorsqu'un seul établissement est actif ou en pilote.

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

## Limites ouvertes

- Ajouter l'établissement directement aux journaux de jobs, reçus webhook et
  autres tables techniques avant d'autoriser plusieurs établissements actifs.
- Ajouter les politiques RLS fondées sur les adhésions lorsque les API ne seront
  plus les seules à accéder aux demandes.
- Réaliser la recette avec comptes agents nominatifs et MFA avant un pilote réel.
