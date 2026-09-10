# Harmonisation du portail — 10 septembre 2026

Demande d’Adel : publier un site cohérent avec l’accueil et confortable sur téléphone avant l’envoi de l’email aux secondes et à leurs parents. La Région est déjà organisée pour les 14 et 15 septembre, dans la grande salle polyvalente. Ne pas redemander cette confirmation. L’audit EDT reste en pause.

## Réalisation

- Cadre public unique `PublicPortalShell` : portrait, navigation, menu mobile, installation PWA, flash publiés et pied de page. Utilisé par le portail, le guide Chromebook et les articles.
- Variables visuelles communes dans `index.css`, règles du portail dans `portal-charter.css`, charte durable dans `docs/design/CHARTE_GRAPHIQUE_LYCEE.md`.
- Guide Chromebook simplifié : titre court, dates et lieu séparés, préparation compacte sur téléphone, recherche et rubriques défilantes, accordéons et liens vers le chat conservés.
- Accueil, services, aide, suivi, vie du lycée, confidentialité et articles : même cadre et mêmes repères. Réduction des couleurs décoratives et amélioration des petits textes, contrastes, focus et cibles tactiles.
- Identité de connexion et du cadre de gestion rapprochée du portail : même portrait, nom du lycée, palette, typographie et champs. Aucun changement de rôle ou de contrôle d’accès.
- Aucun changement de corpus, de route serveur, d’annuaire, de coffre, d’OTP, de notification ou de traitement métier.

## Vérification locale

- `npm run build` : réussi ; avertissement existant sur le chunk XLSX de plus de 500 Ko.
- `npm run test:preview-security-gate` : réussi, exit 0 ; sécurité, contrats de réponse, rendu Markdown et 118 versions de migrations contrôlés.
- `npm run test:admin-shell-accessibility` : 4/4.
- Chromium avec Playwright installé, car **Browser plugin not available**.
- Dix pages examinées à 1440 × 1000, 390 × 844, 320 × 740 et 820 × 1180 : accueil, guide, services, aide, suivi, actualités, vie du lycée, confidentialité, article fictif et connexion.
- 44 vérifications de pages/parcours réussies : identité, absence de débordement horizontal, de page vide, d’erreur JavaScript et d’erreur de console inattendue ; menu et Échap, navigation mobile, déclenchement simulé de l’installation, filtres, recherche, résultat vide, lien FAQ → chat avec réponse de secours SAV, accueil → guide.
- Le test de connexion sélectionne le titre visible : le titre de la moitié desktop est volontairement masqué sur mobile. Aucun changement d’authentification nécessaire.
- Captures et scripts hors dépôt : `../Harmonisation_2026-09-10/verified/` et `verify.mjs`. Relecture visuelle ordinateur et téléphone effectuée.

Les API de cette recette locale sont simulées ; aucune demande, aucun OTP, email, SMS ou push n’a été envoyé. L’installation native sur un véritable téléphone et les écrans de gestion authentifiés n’ont pas été rejoués par cette recette. Le comportement de réception/réponse du guichet n’est pas requalifié par une harmonisation graphique.

## Publication

Publication confirmée le 10 septembre 2026. Commit fonctionnel `c13156186d743c4abfa21b76ce798ef20288052b`, déploiement READY `dpl_5Mr613m12WsRRrn7c65oiEsqmwHS` (`lyceegest-p9hp6131h-safe-scol.vercel.app`). Version de retour arrière : `25560eb`, déploiement `dpl_F1oZ5KGjD1HXcrsBZ8wUU2TGotfh` (`lyceegest-go1ewgrah-safe-scol.vercel.app`).

Recette réussie sur l’URL immuable, puis affectation explicite des deux alias (domaine principal et alias de branche), puis même recette réussie sur `https://lycee-blaise-cendrars-sevran.fr` :

- Accueil, guide, services, aide et suivi sur ordinateur et téléphone : dix états de page par cible, marque et variables de la charte confirmées, aucune erreur JavaScript ou console et aucun débordement horizontal.
- Trois réponses serveur publiques : distribution, QR sans smartphone, SAV. Chaque réponse cite ses sources, sans IA générative, sans création de dossier et sans formulaire imposé.
- Lien de la FAQ SAV vers le chat, réponse réelle et lien de retour au guide vérifiés sur mobile.
- Liste anonyme des demandes vide (`200`, exactement `{requests: []}`) ; liste professionnelle protégée (`401`).
- Captures finales relues. Preuves hors dépôt dans `../Harmonisation_2026-09-10/live-lycee-blaise-cendrars-sevran.fr/` et `live-lyceegest-p9hp6131h-safe-scol.vercel.app/`, script `verify-live.mjs`.

Aucun dossier créé et aucun OTP, email, SMS ou push envoyé. La vérification ne couvre pas une nouvelle remise de document personnel, l’installation native réelle ni le traitement humain des demandes en attente. Le commit documentaire de clôture conserve le même code fonctionnel.
