# Preuve preview - scénarios humains de la charte

## Périmètre

- Dépôt : `abenmahmoud/Stage-Pilot`
- Branche : `codex/lycee-connect-prototype`
- Environnement : local et Vercel preview uniquement
- Base : aucune migration et aucune donnée distante créée
- Production, DNS, Hostinger, VPS, Webmail, ENT et PRONOTE : non modifiés

## Recette automatisée

- 9 scénarios T022A réussis : urgence, statut d'alerte, absence de faux positif,
  tiers, santé minimisée, contact sans identité, appareil partagé et retour au
  support ordinaire.
- 16 contrôles de politique de conversation réussis.
- 12 contrôles de l'agent réussis.
- 12 contrôles de politique d'identité réussis.
- 5 contrôles de sessions, liens et MFA réussis.
- Total : 54 contrôles ciblés, plus la recette de mémoire locale.
- Build TypeScript et Vite réussi.

## Recette visuelle

- Action `Appareil partagé ?` visible et lisible à 1 440 px et 390 px.
- Aucun débordement horizontal sur les deux formats.
- Sur téléphone, l'action de fermeture occupe la largeur disponible sans couper
  le texte ni le bouton.
- Aucun appel n'a été envoyé à une base distante pendant ce contrôle visuel.

## Écart découvert et fermé

La première recette a montré que l'apostrophe de « l'élève » n'était pas incluse
dans la variante de détection d'un tiers. Cette forme est maintenant couverte et
le test échoue si un appel au modèle est seulement tenté pour ce scénario.

## Avant pilote

1. Faire valider les formulations d'urgence et les canaux par la direction, la
   vie scolaire, l'infirmerie et le DPO.
2. Tester la révocation avec deux navigateurs et deux sessions fictives sur la
   preview intégrée.
3. Publier les horaires et contacts officiels datés avant toute mention locale
   autre que les numéros nationaux d'urgence.
