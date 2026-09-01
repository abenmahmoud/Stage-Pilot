# Limitation multidimensionnelle du guichet

**Statut** : implémenté et vérifié sur la preview, à observer avant production  
**Tâche** : T021  
**Date** : 29 août 2026

## Objectif

Protéger le guichet et les appels IA sans imposer de compte public et sans
bloquer tous les usagers qui partagent la connexion du lycée. Une adresse réseau
n'est jamais la seule dimension de décision.

## Dimensions

- **Assistant anonyme** : identifiant aléatoire signé par le serveur, cookie
  HttpOnly de trente jours. Il ne prouve ni personne ni identité scolaire.
- **Appareil déclaré** : ancien signal opaque du navigateur, conservé notamment
  pour les liaisons des reçus d'outils. Il n'est plus le seul quota assistant.
- **Session reconnue** : compte vérifié auprès d'Auth ou session de suivi active
  avec autorisation de dossier dans l'établissement. Ces compteurs s'ajoutent
  à celui du cookie anonyme ; ils ne donnent aucun nouveau droit de dossier.
- **Contact** : email et téléphone normalisés puis hachés séparément.
- **Compte** : identifiant du compte agent haché pour les écritures et appels IA.
- **Comportement** : formulaires invalides et demandes identiques répétées,
  identifiés par une empreinte sans conserver le texte dans le compteur.
- **Réseau** : garde-fou très haut seulement, à partir de l'en-tête Vercel de
  confiance. L'en-tête générique `X-Forwarded-For` n'est accepté qu'en local.

Tous les identifiants sont transformés par HMAC-SHA-256 côté serveur. La table
ne contient ni adresse IP, ni contact, ni identifiant d'appareil ou de compte en
clair. Les rôles `anon` et `authenticated` n'y ont aucun droit.

## Seuils initiaux de preview

| Action | Dimension | Seuil V1 |
|---|---|---:|
| Conversation IA | appareil | 24 par 24 h |
| Conversation IA | réseau partagé | 20 000 par heure |
| Trafic assistant | établissement, tous réseaux | 20 000 par heure |
| Création de demandes | appareil | 8 par 30 min, 20 par 24 h |
| Création de demandes | chaque contact | 6 par 30 min, 20 par 24 h |
| Même contenu répété | appareil ou contact | 6 par 24 h |
| Formulaire invalide | appareil | 15 par 10 min |
| Création de demandes | réseau partagé | 10 000 par 10 min |
| Messages de suivi | session autorisée | 60 par 10 min |
| Réservation ou contrôle de fichiers | session autorisée | 30 par 10 min et par étape |
| Écritures de la console | compte agent | 300 par heure |

Les limites plus strictes déjà présentes pour la rédaction IA de contenus et la
traduction par compte restent actives. Les valeurs ci-dessus sont une
configuration de sécurité de preview, pas une promesse métier. Elles doivent
être ajustées à partir de tests fictifs et de métriques agrégées avant production.
Les 24 appels quotidiens sont comptés par cookie assistant, signal déclaré et
chaque compte/session reconnue. Le seuil global reprend le seuil réseau existant
sans le diminuer. Il porte sur cette route seulement, avant toute analyse,
y compris locale ; il n'est pas un plafond de facturation des fournisseurs.

## Comportement en cas de limite

- Réponse HTTP `429` avec une explication en français simple.
- La personne est orientée vers `Mes demandes` pour éviter une nouvelle saisie.
- Le formulaire classique reste disponible lorsque seule la conversation IA a
  atteint sa limite.
- Aucune demande existante n'est supprimée, fusionnée ou masquée.
- Le réseau ne remplace jamais les limites ciblées par appareil et contact.

## Atomicité et durée technique

Le compteur partagé utilise un `INSERT ... ON CONFLICT ... DO UPDATE` atomique
dans PostgreSQL. Il ne dépend pas de la mémoire d'une fonction Vercel. Les lignes
expirées depuis plus d'un jour sont supprimées progressivement, par lots de cent,
lors des appels suivants. Cette durée technique devra être incluse dans la
validation globale direction/DPO avant production.

## Limites connues

- Un identifiant d'appareil peut être réinitialisé ; il n'est donc jamais utilisé
  seul pour une décision sensible.
- Modifier le signal déclaré ne renouvelle plus le compteur du cookie signé.
  Effacer, invalider ou expirer tous les cookies crée néanmoins un nouvel anonyme.
  Le garde-fou global reste commun, mais un anonyme n'est pas une personne unique.
  La rotation d'une session de suivi ne prouve pas non plus une identité durable.
- Un budget monétaire global et son activation restent à fixer avec le
  propriétaire. Le garde-fou de trafic n'est pas présenté comme cette garantie.
- Un contact partagé par une famille est possible ; les seuils restent assez
  hauts pour plusieurs enfants et le réseau collectif possède un plafond séparé.
- Le garde-fou applicatif complète le pare-feu de l'hébergeur mais ne le remplace
  pas lors d'une attaque volumétrique.
