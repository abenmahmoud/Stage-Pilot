# Journal d'accès aux pièces jointes du guichet

## Contrat

L'ouverture d'une pièce jointe suit cet ordre :

1. vérifier la session demandeur liée au dossier, ou le compte agent et son
   périmètre établissement/service ;
2. appliquer la limite de débit pseudonyme ;
3. vérifier que la pièce est propre et, pour une réponse agent, déjà publiée ;
4. créer une URL privée valable 60 secondes ;
5. écrire `attachment.download_link_issued` ;
6. retourner l'URL au navigateur.

Si l'audit échoue, l'URL n'est pas retournée. L'événement contient seulement
`attachmentId`, `direction` et `expiresIn`. Il ne contient jamais le nom du
fichier, son bucket, son chemin, le lien signé ou son contenu.

## Limites

- Demandeur : 120 liens par session sur dix minutes.
- Agent : 600 liens par compte sur une heure.
- Les clés de compteurs sont des HMAC ; aucun jeton de session ni identifiant de
  compte en clair n'est enregistré dans `support_rate_limits`.

## Preview

La migration `20260830190000_add_attachment_download_rate_limits.sql` est
appliquée seulement à `guichet-lycee-preview`. La contrainte accepte les deux
nouvelles portées, conserve la forme HMAC, force la RLS et refuse tout droit
direct à `anon` et `authenticated`.

Les avis Supabase restent ceux du modèle fermé par défaut et des tables
historiques : RLS sans politique directe, index encore inutilisés en preview et
anciennes politiques permissives multiples. Ce lot n'ajoute aucun de ces écarts.

Références des avis :

- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
