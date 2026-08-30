# Classement local des réponses - 30 août 2026

## Objectif

Préparer le traitement des réponses sans activer la boîte email ni le webhook.
Le classificateur `shared/communication-inbound-classifier.ts` propose
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

## Raccordement réalisé en preview

Le parseur entrant exécute le classificateur sur les 20 000 premiers caractères
du texte déjà validé, puis détruit ce texte. La route conserve uniquement la
catégorie et l'état `review`. Elle ajoute à l'audit lié des indicateurs bornés de
confiance, vigilance et revue humaine, sans expéditeur, adresse, sujet ni corps.

La route `GET /api/communications/admin/inbound` exige le module privé, un
compte habilité et AAL2. Elle renvoie au maximum cent lignes avec identifiant
interne, communication liée, état, catégorie, date et titre courant. L'écran
Communications les présente dans `Réponses reçues` sans bouton d'action.

La recette
`supabase/tests/communication_inbound_classification_security.test.sql` a été
exécutée uniquement sur la preview `xijocumlwivhbmffrnlj`. Elle valide les
quatre catégories, refuse `automatic_action`, confirme l'absence de privilèges
`anon`/`authenticated` et laisse quatre compteurs à zéro après rollback.

## Limite honnête

T024 est terminé pour la proposition, la persistance minimale et la boîte
privée. Le contenu complet et les pièces jointes restent volontairement absents
tant que le stockage privé antivirus de T022 n'est pas prêt. Le webhook, ses
secrets et toute action de retrait ou correction restent désactivés.

Les suites Communications, sécurité preview, Spec Kit et le build passent.
`npm audit --omit=dev --audit-level=high` ne trouve aucune vulnérabilité livrée.
L'audit complet conserve des alertes transitives dans les outils de
développement Vercel ; le correctif `--force` proposé étant cassant, il n'a pas
été appliqué dans ce lot.
