# Brief Claude - retrait des comptes dérivés de codes

## Statut

Audit externe non exécuté. Zéro jeton externe consommé.

## Mission préparée

Vérifier que l'ancienne génération de comptes professeurs ne peut plus écrire
dans `auth.users`, que son bouton a disparu, que la route exige rôle et `aal2`
avant sa réponse `410`, et que les commandes sans payload désactivent bien le
parseur HTTP.

## Contraintes d'exécution

L'appel attend un modèle Claude exact et un plafond de jetons propres à cette
mission. Ces paramètres ne sont pas fixés ; Codex poursuit donc les contrôles
locaux sans consommer de quota externe.
