# Corps des requêtes IA bornés - preview

- L'assistant public accepte au plus 32 Ko par requête HTTP.
- La rédaction du site et la préparation des communications acceptent au plus
  64 Ko, avant authentification applicative, validation et appel fournisseur.
- Les plafonds métier restent plus stricts : 21 messages et 12 000 caractères
  pour l'assistant, 8 000 caractères pour le contenu public et les limites du
  brouillon de communication pour le centre de communications.
- Le test permanent vérifie aussi que validation et limite de débit précèdent
  l'appel fournisseur ; aucun appel OpenAI n'est exécuté.
