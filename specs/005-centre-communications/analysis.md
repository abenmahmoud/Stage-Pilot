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
interrupteurs fermés. La saisie directe peut maintenant être corrigée par
versions puis transmise en relecture humaine. L'aide IA rend une proposition
structurée sans persistance fournisseur ; elle n'invente pas les informations
manquantes et les laisse comme questions bloquantes. Les gardes SQL imposent la
cohérence entre la racine et sa version courante et figent le contenu en revue.
Les recettes fictives passent et la base ne contient aucun résidu de test. Le
dépôt signé est raccordé à l'interface derrière deux interrupteurs dédiés qui
restent fermés. Le contrat signé du registre Webmail accepte seulement des
groupes opaques et l'éditeur dispose d'aperçus séparés pour la page et l'email,
toujours sans destinataire ni action d'envoi. Le classement local des réponses
est également défini sans webhook : retrait, correction, question et réponse
libre restent des propositions à confirmer. Le prochain lot documentaire est
une preuve antivirus de bout en bout sur fichiers fictifs ; les groupes réels,
la publication et toute diffusion restent bloqués par T001 à T004.

La surface privée actuelle possède en plus un test de confidentialité dynamique.
Chaque route SQL projette ses colonnes explicitement et aucune route navigateur
n'importe encore audience ou livraison. Cette preuve ne remplace pas le test
d'absence d'adresse entre destinataires après implémentation de T017 à T020.

Le contrat préparatoire du webhook Brevo est maintenant séparé de l'ancien flux
entrant du guichet d'aide. Il vérifie un jeton Bearer fort, reste fermé sans
interrupteur exact, borne les lots et réduit chaque événement à des HMAC
et compteurs non identifiants. Il ne crée aucune route et ne stocke encore aucun
message : l'authentification HTTP réelle, la persistance privée et la preuve de
rejeu restent nécessaires pour fermer T022.
