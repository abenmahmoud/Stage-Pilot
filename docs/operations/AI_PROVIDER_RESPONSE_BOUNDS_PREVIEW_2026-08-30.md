# Réponses du fournisseur IA bornées - preview

## Comportement livré

- L'assistant du lycée, la traduction, l'aide aux contenus publics et l'aide aux
  communications utilisent un lecteur JSON commun limité à 2 Mo.
- Une taille annoncée excessive est refusée avant lecture.
- Un flux sans taille annoncée est annulé dès que son volume réel dépasse le
  plafond, puis chaque parcours applique son repli ou son erreur métier existante.
- Les schémas de sortie, délais, limites de jetons et validations métier restent
  inchangés ; ce lot ne déclenche aucun appel fournisseur.

## Vérifications permanentes

- Le test vérifie les quatre consommateurs et interdit tout retour à
  `response.json()` dans ces parcours.
- Il couvre une petite réponse valide, une taille annoncée excessive et un flux
  chunké de plus de 2 Mo dont l'annulation est observée.
- Le test est exécuté dans `test:preview-security-gate`.
- Aucun prompt réel, clé API, jeton fournisseur, production ou donnée scolaire
  n'a été utilisé.
