# Import local d’une matrice de scénarios

## Parcours

1. La direction ouvre le procès-verbal d’une version figée en validation.
2. Elle choisit localement le fichier Markdown de la compétence.
3. Le navigateur contrôle la structure et affiche les scénarios conformes ainsi
   que ceux déjà consignés.
4. Le bouton « Préparer » copie un scénario dans le formulaire avec le résultat
   « À revoir », sans observation ni confirmation.
5. Après exécution sur des données fictives, la direction renseigne le constat,
   choisit le résultat, confirme le test et l’enregistre avec sa session MFA.

## Garanties

- aucun upload et aucun appel API pendant l’import ;
- au plus 100 000 caractères et 100 scénarios ;
- minimum cinq cas positifs, trois ambigus et trois interdits ;
- identifiants uniques et préfixes cohérents avec chaque section ;
- mots de passe, OTP, codes ENT/PRONOTE et clés secrètes refusés ;
- aucun résultat réussi ou confirmation produits par l’import.

## Limite

Cette aide réduit la ressaisie. Elle ne remplace jamais l’exécution du scénario,
la preuve observée ni la décision humaine de publication.
