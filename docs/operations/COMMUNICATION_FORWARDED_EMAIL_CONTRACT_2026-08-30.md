# Contrat de brouillon depuis email transféré - 30 août 2026

## Périmètre

Ce lot termine le chemin technique T025 sans configurer de boîte, filtre Gmail
ou connexion fournisseur. La route existe mais reste fermée par défaut ; les
tests traitent seulement des messages fictifs.

## Garde-fous

- la source doit être marquée autorisée par le serveur ;
- l'expéditeur et l'alias secret de collecte doivent correspondre à deux listes
  HMAC serveur distinctes ;
- un Bearer dédié et un secret HMAC fort sont obligatoires ;
- l'acteur configuré doit être `admin` actif du même établissement ;
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

## Route et transaction

`POST /api/webhooks/brevo/communications-forwarded` accepte exactement un
message lorsque `COMMUNICATION_FORWARD_ENABLED=true`. L'expéditeur et l'alias
ne sortent jamais du parseur. La transaction crée d'abord un reçu entrant
idempotent, puis un `communications` interne, sa première version et un
événement borné. L'entrant passe à `processed` et pointe vers le même brouillon.
Un rejeu retourne seulement `duplicate: true` et ne crée aucune autre ligne.

Le brouillon ne reçoit ni audience, ni livraison, ni travail de diffusion. Les
données personnelles éventuelles sont signalées dans l'audit et les questions
de revue ; elles interdisent l'aide IA avant masquage.

## Preuve preview

`supabase/tests/communication_forwarded_draft_security.test.sql` a été exécuté
sur `xijocumlwivhbmffrnlj` dans une transaction annulée. La recette prouve une
seule création après rejeu, les liaisons de même établissement, l'acteur actif,
l'absence d'audience, livraison ou travail, les privilèges clients nuls et sept
résidus à zéro.

T025 est terminé. Aucun email, domaine, filtre, secret, variable Vercel, donnée
réelle ou environnement de production n'a été utilisé ou activé. T026 garde la
configuration externe sous autorisation explicite.
