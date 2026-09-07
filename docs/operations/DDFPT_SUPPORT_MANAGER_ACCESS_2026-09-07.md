# Accès gestionnaire des demandes — DDFPT

**Décision propriétaire** : 7 septembre 2026
**Périmètre décidé** : toutes les demandes pendant le pilote

## Compte retenu

Le DDFPT utilise un compte nominatif distinct du superadministrateur :

- rôle Auth `agent` ;
- adhésion établissement `service_manager` active ;
- les sept services du guichet enregistrés dans l'adhésion ;
- MFA TOTP obligatoire à chaque nouvelle session ;
- aucune adresse réelle, aucun nom, aucun mot de passe et aucun secret dans Git.

Cette combinaison donne la vue complète du guichet, les dossiers non classés,
la prise en charge, la réponse, la correction du classement, le transfert et les
modèles de réponse. Elle ne donne pas le rôle Auth `superadmin` ou `proviseur`.
Les routes de connaissances et les écrans administratifs sensibles restent
réservés à la direction et au superadministrateur.

## Invitation

La recette `provision-preview-support-manager.mjs` :

1. refuse une base différente de la preview explicitement confirmée ;
2. refuse une adresse déjà utilisée au lieu de modifier un compte existant ;
3. envoie une invitation nominative vers la page de création du mot de passe ;
4. enregistre le rôle agent et l'adhésion de gestionnaire ;
5. supprime le compte créé si l'habilitation ne peut pas être enregistrée ;
6. n'affiche ni adresse, ni nom, ni identifiant interne dans son résultat.

Après l'invitation, la personne choisit son mot de passe, se reconnecte puis
scanne le QR code MFA avec une application d'authentification. L'espace agent
reste fermé tant que la session n'atteint pas `aal2`.

## Recette humaine avant utilisation

- vérifier que le bandeau indique « Gestionnaire de toutes les demandes » ;
- vérifier la présence de tous les services et de la file « À orienter » ;
- prendre et répondre à un dossier fictif ;
- transférer un dossier fictif entre deux services ;
- vérifier que `/admin/repertoire-identites`, `/admin/codes-acces` et
  `/admin/connaissances-agent` restent refusés ;
- désactiver l'adhésion et confirmer que l'accès est immédiatement retiré, puis
  la réactiver si le pilote continue.

L'accès global est temporaire. Avant généralisation, la direction décide s'il
reste global ou revient au seul service DDFPT.
