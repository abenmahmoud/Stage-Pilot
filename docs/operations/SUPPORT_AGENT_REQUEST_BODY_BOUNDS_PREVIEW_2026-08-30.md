# Corps des mutations agent bornés - preview

- Les décisions de validation sont limitées à 4 Ko.
- Les modèles de réponse et mises à jour de dossier sont limités à 8 Ko.
- La reprise d'un travail échoué ne lit aucun corps : le parseur Vercel y est
  désactivé et l'identifiant vient uniquement du chemin authentifié.
- Les contrôles de compte, rôle, périmètre, MFA et débit restent inchangés.
- Le test permanent couvre ces quatre routes sans compte ni base distante.
