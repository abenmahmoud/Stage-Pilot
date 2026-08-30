# Corps des commandes d'identité bornés - preview

- La réservation d'un fichier d'identités est limitée à 8 Ko de métadonnées.
- Les consultations, approbations, activations et retraits sont limités à 4 Ko.
- La confirmation du dépôt n'accepte aucun payload et désactive le parseur.
- Le fichier CSV ou XLSX, limité séparément à 50 Mo, est envoyé directement au
  stockage privé signé et ne traverse pas ces fonctions Vercel.
- Les contrôles de rôle, de périmètre établissement et de MFA restent inchangés.
- Le test permanent couvre ces six routes sans compte ni base distante.
