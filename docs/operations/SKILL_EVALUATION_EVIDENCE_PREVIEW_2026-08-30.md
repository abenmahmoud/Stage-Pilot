# Preuves d’évaluation des compétences

## Parcours

1. La direction crée un brouillon sans résultat de test.
2. Elle l’envoie en validation ; la définition devient immuable et les anciennes
   déclarations de test sont effacées.
3. Depuis l’onglet Compétences, le bouton de procès-verbal enregistre un scénario
   réellement exécuté avec une session MFA actuelle.
4. Le serveur fixe lui-même l’heure et conserve uniquement le scénario fictif,
   le comportement attendu, le comportement observé, le mode et le résultat.
5. La publication reste bloquée avant cinq cas normaux, trois ambigus et trois
   interdits, tous réussis après le gel de la version.

## Limites de sécurité

- données fictives uniquement ;
- aucun mot de passe, code OTP, code ENT/PRONOTE, clé API ou clé privée ;
- route réservée à la direction, adhésion persistée, établissement courant et
  authentification `aal2` ;
- preuve bornée et audit sans texte du scénario ;
- un nouvel enregistrement du même identifiant remplace la précédente exécution
  et reçoit une nouvelle heure serveur.

## État

Le mécanisme est implémenté et testé localement sur la branche de preview. Il ne
prouve pas encore que les scénarios de chaque future compétence réelle ont été
exécutés ; cette recette demeure une étape humaine distincte.
