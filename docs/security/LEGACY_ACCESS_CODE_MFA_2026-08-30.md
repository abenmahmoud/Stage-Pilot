# Protection MFA des anciens codes d'accès

Les deux listes administratives qui affichent ou exportent les codes élèves et
professeurs exigent désormais systématiquement `aal2`, en plus du rôle. La même
exigence protège les imports historiques qui génèrent encore ces valeurs.

Cette mesure réduit le risque d'extraction après compromission d'une session
simple. Elle ne transforme pas ces codes en mécanisme cible : la création
massive de comptes par code reste retirée et la migration vers des accès
nominatifs/OTP demeure une décision métier à planifier.

Aucun compte, code ou enregistrement distant n'a été lu ou modifié pour ce lot.
Le contrôle `test:legacy-access-code-mfa` fait partie de la barrière de sécurité.
