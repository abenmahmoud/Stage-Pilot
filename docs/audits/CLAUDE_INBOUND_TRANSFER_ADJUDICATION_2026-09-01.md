# Revue du transfert entrant privé

## Exécution

Une exécution Claude Fable 5 autorisée, en lecture seule, sans outil, MCP,
personnalisation ni sous-agent. Deux fichiers fournis : le transport et ses
quinze tests initiaux. Les quatre tests complémentaires et les corrections
ci-dessous ont ensuite été contre-vérifiés par Codex, sans seconde revue.

Plafond demandé : 1,50 USD. Coût d'usage rapporté : 0,701845 USD, dont 0,009395
USD attribué par le CLI à un appel auxiliaire Haiku. Le rapport principal est
bien Fable 5 ; aucun sous-agent n'a été créé. Une seule exécution, terminée avec
succès. Ce montant est une estimation de l'outil, pas une facture d'abonnement.
Aucun secret, contenu utilisateur, accès distant ou historique complet fourni.

## Décisions après contre-vérification

| Constat | Décision et preuve |
| --- | --- |
| Tampon de 10 Mio même pour un petit fichier déclaré | Confirmé et corrigé : allocation à la taille exacte ou au Content-Length validé, plafond conservé sans en-tête. La concurrence globale reste à borner lors du raccordement. |
| Redirection native classée comme panne de transport | Diagnostic confirmé, correction proposée rejetée : toute TypeError n'est pas une redirection. Le fetch natif refuse le suivi ; la recette HTTP confirme zéro requête vers la cible. Le code générique reste volontaire, sans inspection du texte distant. |
| releaseLock masque une lecture annulée | Non reproduit sur le runtime cible : une annulation résout la lecture en attente même si le nettoyage ne termine jamais. Test natif ajouté ; timeout et libération du verrou passent. |
| Timeout masque une erreur métier concurrente | Non reproduit. La priorité au délai expiré est conservée ; aucune exception métier précise n'est reclassée sans signal effectivement annulé. |
| Erreur non uniforme de la référence HMAC | Corrigé : UUID invalide renvoie désormais input_invalid du transport. La politique existante ne reflétait déjà aucun contenu utilisateur. Employer le même UUID dans ce contrôle de syntaxe ne contourne aucune contrainte de relation. |
| Tolérer la perte du type média dans le stockage | Rejeté : la relecture du dépôt que nous contrôlons doit retrouver ses métadonnées exactes. Leur altération reste un échec, même à empreinte égale. |
| Effacement mémoire incomplet | Limite documentée : les octets retournés appartiennent à l'appelant. Aucune garantie globale d'effacement des copies runtime/Blob n'est annoncée. |
| Taille estimée non confrontée | Intention documentée dans le code : seule la taille réellement lue devient la taille de réservation. |

## Limites restantes

Le transport n'est connecté ni au webhook ni au worker. Aucune recette réelle
Brevo/Storage, garantie d'immutabilité face à un administrateur serveur, analyse
de signature ou preuve antivirus n'est fournie par ce lot. Un orchestrateur doit
encore lier réservation, dépôt vérifié et confirmation atomique, limiter la
concurrence et traiter les reprises après panne. La conservation reste à valider.
