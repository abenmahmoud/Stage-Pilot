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

Le test local vérifie la structure et les garde-fous de la recette. La recette
SQL distante n'est pas exécutée dans ce lot : la migration de poignée de main
doit d'abord être appliquée uniquement à la branche Supabase de preview, puis
l'identité de cette branche doit être revérifiée. La production est exclue.

Cette preuve ne remplace pas l'adaptateur Webmail séparé, l'antivirus entrant ni
la validation du pilote avant tout envoi réel.
