# Transport HTTP LyceeGest vers Webmail

## Portée

Ce lot ajoute le transport serveur qui reliera plus tard une livraison LyceeGest
au Webmail du lycée. Il ne configure aucune URL, aucun secret et aucun worker.
Il n'appelle ni le Webmail, ni Brevo, ni un autre service distant.

## Frontière de sécurité

- l'URL doit utiliser HTTPS et désigner un hôte public ;
- adresse IP, hôte local, nom DNS terminé par un point, identifiants, paramètres
  et fragment sont refusés ;
- les redirections HTTP sont interdites ;
- le Bearer reste dans l'en-tête serveur et mesure de 32 à 1 024 caractères ;
- le corps contient exactement un jeton de commande opaque déjà signé ;
- une réponse réussie doit être un JSON de 24 Kio maximum ;
- le client refuse les champs inattendus puis vérifie le reçu signé contre la
  commande, l'établissement et les secrets attendus ;
- le texte d'une panne fournisseur n'entre jamais dans le résultat métier ;
- le flux d'une réponse refusée est annulé avant le retour de l'erreur.

## Preuves locales

`npm run test:communication-webmail-client` couvre onze scénarios : réussite,
requête exacte, configuration dangereuse, réponses invalides, statut HTTP,
annulation des flux refusés, commande ou reçu altéré, délai, lot de 200
livraisons et bornes du worker.

Le faux Webmail est injecté en mémoire avec des identifiants `example.invalid`.
Aucune donnée ni requête réelle n'est produite.

## Limite restante

T027 et T032 restent ouvertes. Leur fermeture exige une recette réseau sur une
preview déployée, avec un faux Webmail autorisé, des secrets éphémères et une
preuve d'absence de résidu. Ce lot n'autorise aucune activation implicite.
