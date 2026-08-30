# Reçu signé de diffusion Webmail - 30 août 2026

## Objectif

T018B définit le retour minimal du Webmail vers LyceeGest après un envoi Brevo.
Le reçu confirme une livraison acceptée ou un doublon idempotent sans exposer
l'adresse, le contact ou le `message-id` fournisseur brut.

## Contrat

- le reçu est signé par une clé dédiée et expire après cinq minutes ;
- il est lié à l'établissement, à la livraison, à l'empreinte exacte de la
  commande et à la clé d'idempotence ;
- le `message-id` Brevo est transformé par HMAC avec une autre clé ;
- `accepted` indique le premier appel accepté par Brevo ;
- `duplicate` renvoie la même empreinte après un rejeu réseau sans nouvel envoi.

LyceeGest ne persistera le statut `sent` que si les quatre liens de commande
correspondent exactement et si la signature est valide. Une réponse invalide
laisse le travail en échec contrôlé, sans tentative aveugle.

## Séparation des clés

Les clés de commande, de reçu et d'empreinte fournisseur sont distinctes. Elles
ne sont jamais placées dans le dépôt, les journaux, les réponses publiques ou
les données métier.

## Limites

La route Webmail et la transaction LyceeGest restent à implémenter et à tester
avec des contacts et identifiants fournisseur fictifs. Aucun envoi réel ni
secret distant n'a été utilisé.
