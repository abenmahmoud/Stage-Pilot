# Contrat de brouillon depuis email transféré - 30 août 2026

## Périmètre

Ce lot prépare T025 sans créer de boîte de collecte, de route HTTP, de filtre
Gmail ou de connexion fournisseur. Il traite seulement un texte déjà extrait
dans un contexte serveur fictif et autorisé.

## Garde-fous

- la source doit être marquée autorisée par le serveur ;
- l'identifiant externe est un HMAC hexadécimal de 64 caractères ;
- le nombre de pièces jointes est borné à vingt et aucun nom n'est exposé ;
- seuls le sujet et le texte extrait sont acceptés ;
- les en-têtes de transfert et l'ancien fil de réponse sont retirés ;
- les images Markdown distantes sont remplacées par un texte neutre ;
- les secrets et balisages actifs sont refusés ;
- les adresses et téléphones déclenchent une obligation de masquage avant IA ;
- le résultat reste interne, brouillon, non publiable et non diffusable ;
- le titre, le public, les dates et les pièces doivent être relus par un humain.

L'empreinte de source est dérivée du HMAC fournisseur par un domaine séparé.
Deux messages externes différents ne partagent donc pas la même clé
d'idempotence, même si leur texte est identique.

## Preuves

`scripts/test-communication-forwarded-email.mjs` couvre cinq scénarios :
transfert autorisé, refus des contextes invalides, empreinte stable, retrait de
l'ancien fil et des images distantes, puis signalement des données personnelles
et refus des secrets ou du balisage actif.

La route privée, la persistance, l'idempotence transactionnelle et la recette de
rejeu restent dans T025. Aucun email, domaine, filtre, secret, donnée réelle ou
environnement de production n'a été utilisé.
