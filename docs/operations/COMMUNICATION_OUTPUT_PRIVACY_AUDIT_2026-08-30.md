# Audit des sorties Communications - 30 août 2026

## Surface contrôlée

Le test `scripts/test-communication-output-privacy.mjs` découvre récursivement
toutes les routes de `api/communications`. Il échoue si la surface actuelle :

- sort du périmètre privé `admin` ;
- ajoute une route publique, d'audience, de destinataire ou d'envoi ;
- importe les tables d'audience ou de livraison dans une route navigateur ;
- utilise une sélection SQL sans projection explicite ;
- retourne une coordonnée privée de document dans une liste ou confirmation ;
- introduit une adresse ou référence de contact dans l'interface.

## Correction issue du contrôle

Trois opérations internes chargeaient toute une ligne avant d'en retourner une
partie bornée. Aucun champ n'était exposé, mais la lecture dépassait le besoin.
Les routes de version, de demande de relecture et de confirmation documentaire
utilisent maintenant des projections explicites pour chaque lecture et chaque
`returning`.

Les empreintes de contenu nécessaires à l'idempotence restent lues uniquement
dans la transaction de modification et ne sont jamais présentes dans le GET ou
la réponse de doublon. Les chemins de stockage restent nécessaires à la
confirmation côté serveur mais sont exclus de `publicDocument`.

## Limite honnête

Cette preuve couvre la surface actuelle, qui ne sait pas encore préparer ou
envoyer des destinataires. T027 reste ouvert jusqu'à un essai complet avec des
contacts fictifs vérifiant chaque réponse API, email et journal technique.

Aucune donnée réelle, base distante, variable, intégration ou diffusion n'a été
utilisée pour cet audit.
