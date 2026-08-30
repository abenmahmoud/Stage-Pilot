# Alertes PWA de session active - preview

## Comportement livré

- La permission n'est demandée qu'après un clic sur `Activer les alertes`.
- L'activation vaut pour la session ouverte et peut être coupée depuis le même
  bouton.
- L'état initial et les anciennes réponses ne déclenchent aucune alerte.
- Une nouvelle réponse agent ou un changement de statut peut alerter uniquement
  lorsque l'application est en arrière-plan.
- Les retours plus anciens, doublons, numéros ou états invalides sont ignorés.
- Le contenu de l'alerte est générique ; le clic ouvre le suivi sans dossier dans
  l'URL.
- Aucun abonnement push, serveur tiers ou donnée réelle n'a été ajouté.

## Vérifications

- `npm run test:support-active-notification` : 6 tests réussis.
- `npm run test:json-api-response` : 3 tests réussis.
- Build TypeScript/Vite réussi.
- Playwright local à 1440 x 900 et 320 x 800 : aucun débordement horizontal,
  aucune erreur console et aucun overlay Vite.
- À 320 px, les boutons occupent 266 px entre `27` et `293`, donc restent dans
  le viewport.
- L'erreur technique brute d'une réponse API non JSON est remplacée par un
  message français simple.

## Limite assumée

Chromium headless a conservé `Notification.permission = denied`, y compris avec
la permission Playwright demandée. La recette native sur téléphone reste donc
obligatoire avant de fermer T033. Ce lot ne touche ni production, DNS, VPS,
Webmail, ENT, PRONOTE, email ou donnée réelle.
