# Résilience Brevo et webhooks - recette preview

## Périmètre

- Base : `guichet-lycee-preview` uniquement.
- Contacts, messages et identifiants de recette : entièrement fictifs.
- Aucun appel Brevo réel, email réel, production, DNS, VPS ou Webmail.

## Invariants automatisés

- La clé d'idempotence est envoyée à Brevo à chaque tentative.
- Un succès conserve le `messageId`; un doublon Brevo devient un succès
  idempotent ; une réponse 503 lève une erreur retryable sans supprimer le job.
- Le reçu entrant, le message, l'événement et la notification sont dans la même
  transaction.
- Seuls les reçus `received` ou `error` peuvent être repris. Un reçu `processed`
  n'est jamais réclamé une seconde fois.
- Avant cinq lectures, le job reste dans la file. À la cinquième, il est copié
  dans la file d'échec puis archivé pour reprise manuelle.

## Recette base de données

Une transaction fictive rejoue dix fois le même couple
`(institution_id, provider, external_id, payload_hash)`. Le premier passage crée
un reçu et un message ; les neuf suivants ne réclament aucun travail. Le contrôle
attend exactement un reçu et un message.

Une seconde sous-transaction réclame un reçu puis provoque une erreur avant la
création du message. Elle vérifie que ni reçu ni message ne subsistent. La
transaction principale termine par `ROLLBACK`; le contrôle final attend zéro
reçu, zéro message et zéro donnée de recette.

## Limite ouverte

Cette recette prouve la politique locale et l'atomicité de la base. Elle ne
remplace pas T026B : la panne et la reprise du service Brevo réel ne peuvent être
validées qu'après configuration autorisée du domaine entrant et d'adresses de
test contrôlées.
