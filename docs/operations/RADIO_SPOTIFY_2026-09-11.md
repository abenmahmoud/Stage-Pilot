# Branchement de la playlist ESSUF — 11 septembre 2026

## Source fournie par Adel

Passation `essuf-radio-player-handoff-2026-09-11.zip` et texte joint, transmis par l’agent ESSUF. Lecture ciblée du document et des composants publics dans l’archive, sans extraction des routes d’administration ni copie d’un secret.

- Playlist : https://open.spotify.com/playlist/2QHUYT3UGNRrO3F8xHHrZ6
- Lecteur : https://open.spotify.com/embed/playlist/2QHUYT3UGNRrO3F8xHHrZ6?utm_source=generator&theme=0
- Titre : Radio ESSUF — ASSMA & Pop française.

Le code du lycée utilise cet identifiant précis. Aucune nouvelle playlist créée, aucune sélection musicale modifiée, aucune synchronisation administrative déclenchée. Les contenus restent administrés dans ESSUF MUSIC ; le lecteur public utilise toujours la même playlist.

## Compatibilité avec la demande initiale

La source transmise est un lecteur Spotify, pas un flux audio direct. La [référence officielle de l’API iframe](https://developer.spotify.com/documentation/embeds/references/iframe-api) ne fournit pas de commande de volume. Le site ne peut donc pas appliquer son gain Web Audio à ce lecteur d’une autre origine. Un volume de 1 % ne peut pas être garanti avec cette intégration. Ce constat a été expliqué à Adel pendant le branchement.

Le lecteur natif à 1 % reste disponible dans le code pour un futur flux ESSUF compatible. La tâche T075 demeure ouverte pour cette ambiance exacte. Aucun téléchargement des pistes Spotify, proxy audio, extraction ou commande privée non documentée n’est employé.

## Parcours livré

- L’entrée au lycée reste silencieuse avec Spotify. Le texte « 1 % » et le curseur natif ne sont pas présentés comme applicables au lecteur Spotify.
- Le petit mot « radio » ouvre un panneau. « Découvrir la radio » depuis l’accueil permet aussi d’y arriver.
- Avant « Charger le lecteur Spotify », aucun iframe ni appel à Spotify. Le panneau explique le contact avec ce service externe et les cookies possibles, avec lien vers sa [confidentialité](https://www.spotify.com/fr/legal/privacy-policy/).
- Après ce clic, affichage de l’iframe officiel, sans lancement programmatique de lecture. Le visiteur utilise ses commandes. Spotify peut présenter des extraits ou demander une connexion pour l’écoute ; aucune promesse d’écoute intégrale anonyme.
- Le même iframe reste monté entre les pages publiques. Sur téléphone, la navigation inférieure reste accessible pendant l’ouverture du panneau.
- Fermer le panneau, appuyer sur Échap depuis le site ou entrer dans une route privée détruit l’iframe et interrompt son audio. La réouverture demande à nouveau le chargement. Le lecteur Spotify n’est jamais caché tout en poursuivant sa lecture.
- Aucun état trompeur « en lecture » déduit du simple chargement de l’iframe, aucune mesure d’ouverture assimilée à un stream. Aucun clic de lecture Spotify automatisé dans les recettes.
- Lien direct vers la playlist toujours disponible, y compris si le lecteur externe tarde à répondre. `referrerPolicy="no-referrer"` protège le chemin et les paramètres de la page du lycée.

## Fichiers et périmètre

`src/lib/essuf-radio.ts`, `EssufRadioProvider`, `EssufRadioControls`, `EssufSpotifyPanel`, `PublicPortalWelcome` et `essuf-radio.css`. Le panneau est monté dans le provider au-dessus des routes publiques pour éviter les coupures au changement de page.

CSP : ajout limité à `frame-src 'self' https://open.spotify.com`. Aucun élargissement de `script-src`, `connect-src` ou `media-src`. Les réglages d’identité, documents, agent, EDT, notifications et espaces privés ne font pas partie de ce lot.

## Vérification

Preuves hors Git : `../BRANCHEMENT_SPOTIFY_2026-09-11/`. Script Playwright Chromium (Browser plugin not available), build local avec la CSP de production appliquée aux réponses HTML. Tests sur 1440 × 1000, 390 × 844 et 320 × 740. Recettes sur le vrai lecteur Spotify public, sans lecture ni compte connecté. Validation des pages, du chargement différé, de l’ID exact, de l’absence de Referer, de la conservation du même nœud iframe et du retrait à la fermeture. Captures comparées à la charte existante ; aucun nouveau concept graphique nécessaire pour ce branchement.

La présence et le rendu du lecteur ne prouvent ni une écoute complète ni un volume imposé à 1 %. La lecture physique sur les téléphones des visiteurs et les conditions propres à leur compte Spotify restent hors de la recette automatisée.

Recette locale du 11 septembre réussie : build TypeScript/Vite, preview-security-gate et spec-integrity ; vrai iframe Spotify en 1440, 390 et 320 px. Zéro erreur JavaScript, console ou diagnostic externe relevé dans la recette finale. Toutes les conditions de checks.json sont vraies ; aucune lecture automatique déclenchée. Le rendu inclut le libellé « Preview » fourni par Spotify : ne pas promettre une radio intégrale anonyme. Captures du lecteur et du panneau de consentement relues avec view_image. Avertissement XLSX préexistant au build. Publication et contrôles distants à consigner dans ../BRANCHEMENT_SPOTIFY_2026-09-11/PUBLICATION.md.
