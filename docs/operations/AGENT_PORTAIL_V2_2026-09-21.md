# Agent du portail v2 — 21 septembre 2026

## Besoin

Blaise disposait déjà de lecteurs protégés pour l’annuaire, les emplois du
temps et certains accès, ainsi que du registre de connaissances publiées. Il
ne possédait pas une carte commune et fermée des pages du portail. Une question
de navigation pouvait donc être reformulée par le modèle ou conduire trop vite
vers une demande humaine.

## Livraison

- `shared/assistant-site-guide.ts` définit les destinations publiques,
  leurs formulations et les intentions de navigation reconnues.
- Les demandes explicites de page ou de suivi reçoivent une réponse
  déterministe, sans coût IA, accompagnée d’une carte d’action.
- Le modèle reçoit la même carte dans ses instructions pour les demandes
  générales. Il lui est interdit de proposer les chemins internes `/admin`,
  `/gestion`, `/app` et `/intervention-spie`.
- Le contrat public accepte uniquement les destinations connues. Une adresse
  inventée, externe ou interne est rejetée avant affichage.
- L’accueil explique mieux les capacités de Blaise et propose trois départs :
  emploi du temps, accès ENT et suivi d’une demande.
- Le manuel du superadmin décrit la séparation entre carte du site,
  connaissances publiées et lecteurs personnels.

## Sécurité et limites

La carte du site ne donne aucun droit. Elle ne remplace ni une source validée
ni une preuve d’identité. Les réponses personnelles restent servies par leurs
lecteurs côté serveur ; le modèle ne lit ni l’annuaire, ni les codes, ni les
emplois du temps. En l’absence de source ou d’outil confirmé, Blaise conserve
le recours vers une demande humaine.

## Vérifications

- `npm run test:assistant-site-guide` : 5 contrôles réussis.
- `npm run test:support-assistant-client-payload` : 11 contrôles réussis.
- `scripts/test-family-school-chat.mjs` : 19 contrôles réussis.
- `npm run test:public-assistant-contrast` : 6 contrôles réussis.
- `npm run build` : compilation TypeScript et production Vite réussies.
- Parcours Playwright fictif : carte « À la une » rendue et cliquable en
  1440 x 1000 et 390 x 844, sans erreur de page ou de console.

## Affiche

Une affiche A3 portrait et son aperçu PNG sont conservés hors Git dans
`outputs/affiche-site-2026-09-21`. Le PDF est une page A3, le QR code pointe
vers `https://lycee-blaise-cendrars-sevran.fr/` et a été relu depuis le rendu
PNG avec un décodeur indépendant.
