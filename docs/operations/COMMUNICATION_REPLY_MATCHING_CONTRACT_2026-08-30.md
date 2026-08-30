# Rattachement des réponses Communications - 30 août 2026

## Règle de rapprochement

Une réponse est reliée uniquement si son en-tête `In-Reply-To` produit exactement
le même HMAC-SHA-256 que l'identifiant fournisseur conservé sur une livraison du
même établissement. La primitive commune est
`hashCommunicationProviderOutboundMessageId`.

Le contrat :

- n'utilise ni expéditeur, ni destinataire, ni objet pour deviner un dossier ;
- refuse tout candidat portant un champ de contact ;
- refuse un candidat d'un autre établissement ;
- retourne `unmatched` lorsque la référence manque ou n'existe pas ;
- retourne `ambiguous` si deux livraisons correspondent, même si la base doit
  normalement empêcher cet état ;
- ne retourne que les identifiants internes de la livraison et de la
  communication lorsque la correspondance est exacte et unique.

## Contrainte de base appliquée en preview

La migration
`20260830110000_secure_communication_reply_matching.sql` vérifie d'abord les
données existantes, impose un HMAC hexadécimal de 64 caractères et remplace
l'index fournisseur non cloisonné par un index unique partiel sur :

`(institution_id, provider_message_ref)`

Elle est reflétée dans le schéma Drizzle et appliquée uniquement sur le projet
Supabase de preview `xijocumlwivhbmffrnlj` sous la version exacte
`20260830110000`. Production reste exclue.

## Preuves locale et transactionnelle

`scripts/test-communication-inbound-matching.mjs` vérifie le HMAC commun,
l'unique correspondance, l'absence de repli par adresse, l'inconnu,
l'ambiguïté, le cloisonnement établissement, les projections bornées et la
contrainte SQL/Drizzle.

`supabase/tests/communication_inbound_matching_security.test.sql` ajoute deux
établissements fictifs dans une transaction annulée. Elle prouve :

- une même référence HMAC isolée dans chacun des deux établissements ;
- le refus d'un doublon fournisseur dans le même établissement ;
- le refus d'une communication appartenant à l'autre établissement ;
- un rejeu entrant absorbé et un inconnu conservé sans communication ;
- l'absence de privilèges directs pour `anon` et `authenticated` ;
- six compteurs à zéro après rollback.

## Limite honnête

T023 est terminé pour le rattachement et la persistance. Le webhook entrant
reste désactivé : aucune variable, donnée réelle, pièce jointe, adresse, route
publique ou intégration fournisseur n'est ouverte. L'advisor Supabase retourne
60 informations et aucun `WARN` ou `ERROR` de sécurité ; les tables restent
volontairement privées côté serveur.
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
