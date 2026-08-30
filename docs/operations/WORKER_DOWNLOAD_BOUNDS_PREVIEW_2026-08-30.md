# Téléchargements des workers bornés - preview

## Comportement livré

- Les workers des demandes, communications, annuaire d'identité, connaissances
  et emplois du temps vérifient la taille du Blob avant `arrayBuffer()`.
- La taille doit être un entier positif, rester sous le plafond du parcours et
  correspondre exactement à la taille enregistrée en base.
- Les pièces jointes entrantes Brevo sont lues en flux, refusées au-delà de
  10 Mo et annulées dès le dépassement même sans `Content-Length`.
- Les plafonds existants restent 10 Mo pour demandes et communications, 50 Mo
  pour annuaire, connaissances et emplois du temps.

## Vérifications permanentes

- Le test prouve qu'un faux Blob trop grand ou incohérent est refusé sans appeler
  `arrayBuffer()` et qu'un Blob cohérent reste lisible.
- Il couvre une taille HTTP annoncée excessive et un flux chunké effectivement
  annulé après dépassement.
- Les cinq workers sont inspectés pour empêcher le retour d'une lecture directe.
- Aucun worker, stockage, fichier réel, antivirus ou base distante n'est exécuté.
