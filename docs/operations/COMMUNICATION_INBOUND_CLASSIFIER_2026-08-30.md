# Classement local des réponses - 30 août 2026

## Objectif

Préparer le futur traitement des réponses sans brancher de boîte email ni de
webhook. Le classificateur `shared/communication-inbound-classifier.ts` propose
une des quatre valeurs déjà prévues par la base :

- `withdrawal` : demande de retrait ;
- `contact_correction` : coordonnée à corriger ;
- `question` : réponse attendue ;
- `free_reply` : autre retour à lire.

Le résultat contient uniquement la catégorie, un niveau de confiance, des codes
de signal bornés et l'action proposée. Le texte, le sujet, l'adresse de
l'expéditeur et les coordonnées ne sont jamais renvoyés dans ce résultat.

## Règles

- Une négation explicite comme `ne me retirez pas` empêche le classement en
  retrait.
- Le retrait est prioritaire sur la correction, puis la question ; le reste
  demeure une réponse libre.
- Des signaux simples sont reconnus en français, anglais, espagnol et arabe,
  sans appel à un modèle externe.
- Un mot de passe, code ou secret détecté force `secure_manual_review`, quelle
  que soit la catégorie proposée.
- `requiresHumanReview` vaut toujours `true`. Le système ne retire, ne corrige
  et ne répond jamais automatiquement.

## Frontière de sécurité

Le sujet est limité à 500 caractères et le corps à 20 000. Les champs inconnus
sont refusés. Le classificateur n'accède ni à la base, ni au stockage, ni au
Webmail, ni à Brevo et n'écrit aucun journal.

Pour l'intégration future :

1. authentifier et dédupliquer le webhook entrant ;
2. conserver le message brut dans le stockage privé prévu ;
3. exécuter ce classificateur côté serveur ;
4. enregistrer seulement sa catégorie dans `communication_inbound` ;
5. présenter le message à un agent habilité ;
6. demander une confirmation distincte avant toute action sur un contact.

Le lot ne clôt pas T024 : la boîte de traitement et l'action humaine restent à
raccorder après T022 et T023.
