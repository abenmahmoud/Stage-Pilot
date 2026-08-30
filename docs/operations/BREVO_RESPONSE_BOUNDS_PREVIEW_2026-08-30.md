# Accusés Brevo bornés - preview

## Comportement livré

- L'API transactionnelle et le worker email lisent les accusés JSON Brevo avec
  un plafond de 256 Ko.
- Une réponse `duplicate_parameter` en HTTP 400 reste reconnue comme un doublon
  idempotent et ne provoque pas un second envoi.
- Une taille annoncée excessive est refusée avant lecture ; un flux chunké est
  annulé dès son dépassement réel.
- Une réponse illisible ou primitive est traitée comme une erreur fournisseur
  sans exposer son contenu.

## Vérifications permanentes

- Le test couvre les deux consommateurs, le doublon HTTP 400, la taille annoncée
  excessive et l'annulation d'un flux surdimensionné.
- Le test interdit le retour de `response.json()` dans ces deux parcours et fait
  partie de `test:preview-security-gate`.
- Aucun email, appel Brevo, contact réel, clé API ou production n'est utilisé.
