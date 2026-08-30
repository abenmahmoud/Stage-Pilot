# Ancien import administratif borné - preview

## Comportement livré

- Le navigateur refuse les fichiers vides ou supérieurs à 10 Mo avant lecture.
- CSV et Excel sont limités à 5 000 lignes, ce qui couvre l'effectif annoncé de
  4 200 personnes sans autoriser un import sans borne.
- Les deux routes reconstruisent une liste blanche de champs, retirent les
  caractères de contrôle et bornent chaque valeur avant tout accès à la base.
- Les corps HTTP sont plafonnés à 5 Mo et les erreurs restent explicites en 400.

## Limite de périmètre

Ce parcours historique reste distinct du « Répertoire des identités », qui est
le canal prévu pour le rapprochement sécurisé, la quarantaine et l'activation
humaine des données d'identité.

## Vérifications permanentes

- Le test couvre 5 001 lignes, un champ démesuré, les caractères de contrôle,
  la liste blanche, la limite fichier et les limites HTTP.
- Le test fait partie de `test:preview-security-gate`.
- Aucun export réel ni écriture distante n'est utilisé.
