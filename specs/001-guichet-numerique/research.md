# Recherche et décisions

## Décisions prises

### D001 - Vercel reste l'hébergement principal

LyceeGest est déjà un projet Vite/Vercel avec des fonctions API. Le déplacer
entièrement sur le VPS ralentirait la livraison et créerait une nouvelle chaîne
de déploiement. Vercel reste le frontal et l'API ; le VPS prend les tâches pour
lesquelles un processus permanent est réellement utile.

### D002 - Supabase reste la source de vérité

Le projet `lyceegest` est actif en région Paris et contient déjà les élèves,
professeurs, classes, stages et fiches Grand Oral. Le support est ajouté par de
nouvelles tables et ne modifie pas le sens des tables existantes.

### D003 - File durable Supabase

Une Basic Queue stocke les messages dans une table journalisée. Elle convient au
volume prévu et évite un fournisseur supplémentaire. Le client n'accède jamais
directement à la queue.

Documentation : https://supabase.com/docs/guides/queues/quickstart

### D004 - Brevo assure le va-et-vient email

Brevo sait envoyer, remonter les événements de délivrabilité et parser les
réponses entrantes via webhook. Un sous-domaine de réception différent du domaine
d'envoi est requis.

Documentation : https://developers.brevo.com/docs/inbound-parse-webhooks

### D005 - L'IA n'est pas un point de panne

Les règles déterministes font le classement minimal. L'IA améliore résumé,
catégorie et brouillon de réponse. Elle peut être désactivée sans bloquer la
création, le suivi ou la réponse.

### D006 - Aucune donnée personnelle inutile vers l'IA

Le texte est pseudonymisé et les pièces jointes restent hors appel par défaut.
La CNIL recommande un encadrement renforcé pour les mineurs et, en principe, une
AIPD pour un traitement IA concernant des élèves.

Documentation : https://www.cnil.fr/fr/education-mise-en-place-systeme-ia

## Difficultés identifiées et réponse prévue

### Réponse email attribuée au mauvais dossier

- adresse Reply-To signée et propre au dossier ;
- vérification `In-Reply-To`, destinataire et Message-ID ;
- mise en exception si les signaux se contredisent ;
- aucun rapprochement automatique par simple objet d'email.

### Demande créée mais email non envoyé

- sauvegarde transactionnelle avant envoi ;
- job durable ;
- retries ;
- file d'échec visible ;
- canal de secours ou rappel.

### Double demande due au réseau ou au double clic

- clé d'idempotence créée par le navigateur ;
- contrainte unique en base ;
- même réponse renvoyée au client.

### Plusieurs personnes partagent un email ou téléphone

- contact séparé du bénéficiaire ;
- relation parent/enfant explicite ;
- possibilité de plusieurs enfants ;
- aucune fusion sur la seule coordonnée.

### Téléphone perdu ou nouvel ordinateur

- liste locale non considérée comme preuve ;
- lien magique ou code ponctuel ;
- sessions révocables ;
- récupération manuelle auditée en dernier recours.

### Fichiers malveillants

- types autorisés limités ;
- détection du type réel ;
- quarantaine privée ;
- antivirus VPS ;
- téléchargement interdit avant résultat sain.

### 200 demandes en même temps

- API courte ;
- transaction locale à la base ;
- traitements externes asynchrones ;
- index et pagination ;
- test de charge avant production.

### Une IA donne une mauvaise réponse

- réponse proposée, jamais envoyée seule ;
- seuil de confiance ;
- règles de blocage ;
- modèle et consigne versionnés ;
- validation agent et audit.

### Une personne envoie un mot de passe

- avertissement avant la zone de texte ;
- détection et masquage automatique probable ;
- alerte agent ;
- suppression contrôlée du secret dans les vues et appels IA ;
- message pédagogique demandant de changer le mot de passe divulgué.

### Conservation excessive

- date de purge par dossier et média ;
- purge automatique avec rapport ;
- blocage de purge seulement avec motif et date de révision ;
- paramètres validés avec le DPO.

## Points à confirmer avant production, sans bloquer le développement

- noms des agents et périmètres d'accès ;
- horaires et SLA officiels ;
- adresse d'expédition finale ;
- budget SMS ;
- lieu et politique de sauvegarde du VPS ;
- durées finales de conservation ;
- validation DPO/AIPD pour l'IA ;
- texte institutionnel des mentions d'information.
