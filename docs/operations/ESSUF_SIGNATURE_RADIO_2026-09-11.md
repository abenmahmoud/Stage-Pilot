# Signature ESSUF et préparation de la radio — 11 septembre 2026

## Demande d’Adel

Ajouter « Powered by ESSUF Group », lié à `https://essuf.fr/`, pour valoriser la réalisation. Adel indique que la proviseure autorise une radio discrète. Volume initial demandé : 1 %, réglable par l’utilisateur ; playlist ESSUF à relier. Il prévoit de confier essuf.fr à un autre agent.

## Réalisation

- Crédit visible dans le pied de page public partagé, lien HTML réel vers essuf.fr, sans texte caché ni mots-clés artificiels. Les informations éditoriales restent celles du lycée. Aucun classement dans un moteur de recherche n’est garanti par ce lien.
- Lecteur global `EssufRadioProvider` conservé entre les routes publiques, commande compacte `EssufRadioControls`, réglages repliés par défaut. Lecture uniquement après un clic ; volume initial de 1 % via un gain Web Audio de 0,01. Pause, volume zéro, piste suivante et boucle de la playlist.
- Pas de démarrage au rechargement, pas de stockage d’un choix de lecture et aucun téléchargement audio avant le clic. Arrêt et retrait de la source en entrant dans une route privée. Erreurs de lecture visibles ; pas de tentatives infinies.
- Sur téléphone, un bouton musical ouvre les contrôles. L’installation PWA reste dans le menu lorsque la radio occupe l’en-tête.
- `src/lib/essuf-radio.ts` reste volontairement vide : aucune adresse de flux ni playlist ESSUF n’a été fournie ou retrouvée. Le lecteur est donc **masqué en production**, et aucune musique de remplacement n’a été sélectionnée.

## Branchement restant

Demander à Adel l’URL exacte de la radio ou de la playlist. Renseigner les pistes audio directes et leurs titres. Vérifier HTTPS, format lisible et CORS anonyme, puis ajouter seulement l’hôte nécessaire à `media-src` de `vercel.json` avant la recette distante. Aucun changement de CSP n’a été fait en attendant cette adresse. Une page Spotify/YouTube n’est pas un flux audio direct et nécessiterait une autre intégration.

La lecture après clic tient compte des [restrictions d’autoplay des navigateurs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay). Le gain Web Audio permet de ne pas dépendre uniquement de [`HTMLMediaElement.volume`, dont la prise en charge varie](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume). Le volume physique final reste aussi celui de l’appareil.

## Preuves

- Build TypeScript/Vite réussi ; avertissement existant sur le chunk XLSX.
- `npm run test:preview-security-gate` réussi, exit 0.
- Playwright Chromium, car Browser plugin not available. 1440 × 1000, 390 × 844 et 320 × 740, source fictive WAV générée uniquement en mémoire et livrée par le navigateur de test.
- Crédit et lien corrects ; absence de lecteur et de source quand la liste est vide ; aucune requête audio avant clic ; lecture native ; gain initial 0,01, changements et silence ; pause ; continuité accueil → guide ; piste suivante et boucle ; Échap et retour du focus ; arrêt sur la connexion ; erreur média affichée ; installation disponible dans le menu mobile.
- Aucun appel à une vraie radio ni envoi d’email, SMS ou push. La lecture effective sur Safari/iPhone et le vrai flux restent à vérifier une fois l’URL disponible.
- Preuves et captures hors dépôt : `../ESSUF_SIGNATURE_RADIO_2026-09-10/qa/`, script `verify.mjs`. Le dossier porte la date de début du travail avant minuit.
- Passation portfolio et contrat du flux pour l’autre agent : `../ESSUF_SIGNATURE_RADIO_2026-09-10/PASSATION_SITE_ESSUF.md`.

Publication du crédit et de la préparation technique confirmée le 11 septembre 2026 (Europe/Paris) : commit fonctionnel `2daf5f5a808a4efce9a2878cde7127f8e67d686a`, déploiement READY `dpl_Da2ATPF1wdpgsGc12EgZ7NRoqdVz`, URL immuable `lyceegest-n4pd1zxwf-safe-scol.vercel.app`. Recette immuable réussie, deux alias affectés explicitement, même recette réussie sur le domaine principal.

Crédit et lien vers essuf.fr vérifiés sur accueil, guide et aide, en 1440 et 390 px : six états de page par cible, aucun débordement ni erreur JavaScript. Lecteur masqué, aucune source sur l’élément audio et aucune requête audio. Captures finales relues ; preuves `../ESSUF_SIGNATURE_RADIO_2026-09-10/live-lycee-blaise-cendrars-sevran.fr/checks.json`. Version de retour arrière : `lyceegest-p9hp6131h-safe-scol.vercel.app` (harmonisation, code c131561).

**Radio non activée : URL réelle toujours attendue.** T075 reste ouverte pour ce branchement ; ne pas confondre le test sur WAV fictif et une diffusion ESSUF opérationnelle.
