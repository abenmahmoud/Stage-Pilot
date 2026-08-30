# Analyse de cohérence - Centre de communication

## Résultat

La proposition est cohérente avec les fonctionnalités `001`, `002`, `003` et
`004`. Aucun fichier, contact ou secret réel n'est requis pour commencer le
prototype en preview.

## Réutilisation

- `003` fournit déjà les contenus, versions, modèles, fichiers, aperçu, aide IA
  et publication dans `À la une`.
- `001` fournit déjà les principes de file durable, idempotence, événements
  Brevo et traitement des réponses email.
- Le Webmail conserve ses contacts et son historique dans son application
  séparée ; `005` doit utiliser un contrat serveur limité.
- `004` reste consacré à la reprise de l'ancien site et n'est pas utilisé pour
  numéroter ou stocker les nouvelles communications.

## Risques fermés par la spécification

- Les adresses ne sont jamais placées dans `À` ou `Cc` d'un envoi collectif.
- Les réponses ne repartent jamais vers toute la liste.
- Une pièce reçue ne devient jamais publique automatiquement.
- Une communication interne ne passe pas dans l'API publique.
- Un échec de Brevo n'annule ni la publication ni la file d'envoi.
- Une correction ne détruit pas la version officielle précédente.

## Points à valider avant données réelles

1. Mentions d'information et durée de conservation des livraisons et réponses.
2. Liste exacte des groupes autorisés et responsable de chaque groupe.
3. État réel de l'expéditeur Brevo, du domaine entrant et des webhooks.
4. Contrat technique et droits minimaux de l'API du Webmail.
5. Test de restauration d'une communication et d'une pièce jointe.

## Ordre recommandé

Construire d'abord le parcours manuel dans la preview avec contacts fictifs,
puis ajouter l'envoi individuel. L'import automatique depuis Gmail vient après
la validation de ce circuit : il accélère l'entrée, mais ne doit jamais devenir
un chemin de publication sans contrôle humain.

## État technique au 30 août 2026

Les validateurs, interrupteurs, tables privées, versions, audiences opaques,
livraisons, file idempotente, entrants et audit sont installés sur la preview et
désactivés. L'API de brouillon, les modèles gouvernés, le dépôt documentaire
privé et la file d'analyse PDF/DOCX sont également présents derrière les deux
interrupteurs fermés. Les recettes fictives passent et la base ne contient
aucun résidu de test. Le prochain lot technique est le raccordement du dépôt à
l'interface fermée et une preuve antivirus de bout en bout ; les groupes réels,
la publication et toute diffusion restent bloqués par T001 à T004.
