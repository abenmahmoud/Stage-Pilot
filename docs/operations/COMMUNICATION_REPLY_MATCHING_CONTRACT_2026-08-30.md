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

## Contrainte de base préparée

La migration
`20260830110000_secure_communication_reply_matching.sql` vérifie d'abord les
données existantes, impose un HMAC hexadécimal de 64 caractères et remplace
l'index fournisseur non cloisonné par un index unique partiel sur :

`(institution_id, provider_message_ref)`

Elle est reflétée dans le schéma Drizzle. Elle n'a pas été appliquée à la base
preview dans ce lot car le connecteur Supabase actif ne donne pas accès au projet
preview attendu. Aucun accès de production ne doit être utilisé pour contourner
ce blocage.

## Preuves locales

`scripts/test-communication-inbound-matching.mjs` vérifie le HMAC commun,
l'unique correspondance, l'absence de repli par adresse, l'inconnu,
l'ambiguïté, le cloisonnement établissement, les projections bornées et la
contrainte SQL/Drizzle.

## Limite honnête

T023 n'est pas terminé. Il manque l'application de la migration en preview, la
requête SQL atomique depuis le futur webhook, la persistance de la décision et
un test concurrent avec événements fictifs. Aucune donnée réelle, variable,
route, base distante ou intégration fournisseur n'a été modifiée.
