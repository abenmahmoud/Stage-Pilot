# Recette de file Webmail fictive

## Objet

La recette `supabase/tests/communication_webmail_handshake_security.test.sql`
prépare 200 livraisons et 200 travaux strictement fictifs. Elle simule 160
acceptations, 20 reprises temporaires, 10 échecs définitifs et 10 travaux encore
en attente.

## Garanties

- références de contacts opaques, sans nom ni adresse ;
- empreintes de commande, reçu et fournisseur uniques par livraison ;
- rejet d'une commande dupliquée ;
- rejet du rejeu d'un événement déjà audité ;
- immutabilité d'une commande après son affectation ;
- transaction entièrement annulée par `ROLLBACK` avec cinq contrôles de résidu.

## Exécution

Les migrations exactes `20260830110000_secure_communication_reply_matching` et
`20260830120000_add_communication_webmail_handshake` sont appliquées uniquement
sur la branche Supabase de preview `xijocumlwivhbmffrnlj`.

La recette distante passe avec 160 succès, 20 reprises, 10 échecs définitifs
et 10 attentes. Elle suit désormais le cycle éditorial brouillon, relecture,
approbation et emploie le type d'acteur autorisé `provider`. Son `ROLLBACK`
laisse utilisateur, établissement, livraison, travail et événement à zéro.

L'advisor de sécurité retourne 60 informations et aucun `WARN` ou `ERROR`. Les
informations RLS sur les tables de communication sont intentionnelles : elles
restent réservées au serveur et ne disposent pas de politiques clientes.
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Cette preuve ne remplace pas l'adaptateur Webmail séparé, l'antivirus entrant ni
la validation du pilote avant tout envoi réel.
