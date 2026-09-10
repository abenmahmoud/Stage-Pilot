# Accueil de bienvenue et radio discrète

Demande d’Adel, 11 septembre 2026 : une entrée moderne au lycée, un clic pour lancer la playlist ESSUF à 1 %, puis seulement le mot « radio » dans un coin, ouvrant les commandes au clic. La source musicale réelle n’a pas encore été fournie.

## Référence visuelle

Concept produit avec l’outil Image Gen intégré, à partir de la photo existante `public/lycee-blaise-hero.webp`. Original du concept : `../ACCUEIL_RADIO_2026-09-11/concept.png`. Les vues ordinateur, téléphone et lecteur forment une planche de référence ; ce n’est pas une image utilisée à la place de l’interface. La photo de production reste le fichier du lycée existant, sans nouvelle image d’établissement générée.

Identité conservée : DM Sans et Space Grotesk, blanc, bleu `#155eef`, texte `#132238`, texte secondaire `#586b82`. Aucun nouveau logo. Une colonne de texte ouverte et une photo, sans grille de cartes.

## Comparaison de la référence et du rendu

| Point | Mise en œuvre et décision |
| --- | --- |
| Textes | « Bienvenue au lycée Blaise Cendrars. », description, bouton « Entrer au lycée » et note d’attente repris. Aucun titre ou label décoratif ajouté. |
| Composition | Texte sur fond blanc à gauche, photo à droite ; sur téléphone, photo puis texte. Colonne de texte élargie pour conserver la lisibilité du nom sans forcer les proportions de la planche. |
| Typographie et palette | Polices et couleurs du portail, nom du lycée en bleu, titres à interlignage court, textes secondaires plus discrets. |
| Photo | Original conservé. Cadrage ordinateur aligné à droite pour éviter de couper le visage dans le montage existant. Le cadrage varie avec la taille réelle de l’écran. |
| Commandes | Bouton bleu, flèche Lucide, croix de fermeture. Fond blanc ajouté derrière la croix pour conserver son contraste sur la photo. Focus clavier visible. |
| Radio repliée | Mot « radio », 12 px, zone tactile de 44 × 44 px. Placement en haut à droite dans l’en-tête, plutôt qu’en bas comme le détail de la planche : le lecteur ne recouvre ainsi ni le compositeur du chat ni la navigation mobile. |
| Lecteur ouvert | Petit panneau blanc, lecture/pause, volume, fermeture, crédit ESSUF. Lien ajouté pour revoir l’accueil. Pas de bouton lecture actif sans source réelle. |

Les écarts décrits ci-dessus répondent à la navigation réelle, au contraste et à l’absence du flux. La planche inclut des titres de présentation (« Desktop », « Mobile », etc.) qui ne font pas partie du produit.

## Comportement

- Première entrée depuis l’accueil uniquement ; un indicateur de visite dans `sessionStorage`, sans identité ni données personnelles. Il ne restaure jamais une lecture audio.
- Liens directs vers guide, aide, suivi, connexion et liens contenant des paramètres de service : aucun écran intermédiaire ajouté.
- « Entrer au lycée » déclenche immédiatement le démarrage à 1 % quand la playlist est configurée. La navigation n’attend pas le chargement audio. Fermer, Échap et « Continuer sans musique » entrent sans son et arrêtent une lecture déjà en cours.
- « Revoir l’accueil de bienvenue », ou `/?bienvenue=1`, réouvre cette présentation à la demande. Le paramètre disparaît à la fermeture.
- Dialogue natif avec arrière-plan inerte et navigation clavier. Sur petit écran ou faible hauteur, le contenu peut défiler. Animation d’arrivée courte désactivée si la personne préfère limiter les mouvements.
- Une fois entré : réglages repliés, mot « radio » toujours accessible, lecture conservée entre pages publiques, arrêt sur les espaces privés. L’installation de l’application reste dans le menu sur téléphone.

## Vérification

Browser/IAB non disponible : Playwright Chromium. Planche et captures du navigateur examinées avec `view_image`. Tailles de recette : 1440 × 1000, 390 × 844 et 320 × 740. La planche est une présentation composite ; les dimensions de ses cadres ne représentent pas un viewport natif unique.

Captures et contrôles exécutés : `../ACCUEIL_RADIO_2026-09-11/qa/`. La lecture native est testée avec un WAV fictif fourni uniquement par le navigateur de recette. Cette preuve ne signifie pas que la playlist ESSUF est branchée, ni qu’un test physique sur iPhone a eu lieu. Voir aussi `docs/operations/ESSUF_SIGNATURE_RADIO_2026-09-11.md` pour les preuves de publication.
