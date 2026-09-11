# Accueil « Pour moi, aujourd’hui » — 11 septembre 2026

Lot 002/T074C demandé par Adel après la publication du calendrier. En cours de recette ; ne pas confondre développement et publication.

## Parcours et périmètre

Accueil → Ouvrir mon espace → identification existante dans le chat (nom, prénom, profil, puis choix de contact masqué et OTP) → Voir mon espace. Une session valide est réutilisée sans envoi de code. Gérer mon accès ouvre la même vérification, sans toucher au brouillon de conversation. Changer de personne conserve la révocation et l’effacement déjà prévus.

L’accueil personnel propose aujourd’hui/demain, deux prochains cours, toute la journée et impression/PDF via le composant déjà utilisé par le chat. Parents : seuls les liens `guardian_of` valides de l’annuaire actif donnent des choix. L’annuaire indexé ne stocke pas les noms en clair : les choix portent « Enfant N · classe », sans déchiffrement massif de l’export. Aucun emploi du temps n’est inventé en cas de source absente, périmée ou non associée.

Les informations publiques de l’hebdo et le calendrier restent sous le bloc personnel, pour tout le lycée. Pas de ciblage par classe déduit automatiquement du texte d’un article. Les notifications continuent d’être gérées dans le suivi existant ; aucune notification n’est envoyée à l’ouverture de l’accueil.

## Données personnelles

GET `/api/identity/device/today` exige le cookie d’identité actuel, vérifie l’annuaire actif puis contrôle à nouveau la session avant de rendre ses résultats. Il ne prend ni nom, ni email, ni identifiant de personne libre : les choix d’enfant utilisent une clé opaque liée à la session. Le lecteur EDT existant contrôle indépendamment le périmètre et la source. Un limiteur par session borne les rafraîchissements.

L’aperçu des demandes exige les droits du suivi sur cet appareil **et** un événement serveur `request.identity_bound`, enregistré atomiquement pour une nouvelle demande créée sous identité vérifiée. L’événement contient un HMAC établissement/import d’annuaire/personne ; aucune coordonnée n’est ajoutée au navigateur. Un nouvel import ne réattribue pas automatiquement les demandes de l’ancien import. Les anciennes demandes ne sont pas réattribuées par ressemblance de nom ou de contact et restent dans le suivi habituel. Aucun droit supplémentaire n’est accordé par cet aperçu. Un document est annoncé uniquement s’il a été libéré par un agent, lié à un message, contrôlé comme sain et non périmé. Son ouverture utilise les contrôles de téléchargement existants.

Aucun stockage local du nouveau bloc ; réponses sans cache et routes API exclues du service worker existant. Effacement au passage en arrière-plan, hors connexion, à l’expiration ou lors d’un changement d’identité annoncé entre onglets. Une réponse arrivant après cet effacement est ignorée.

## Direction visuelle

Maquette générée avant implémentation, dans la charte du lycée : bleu nuit, bleu d’action, fond pâle, deux colonnes sur ordinateur et sections empilées sur téléphone. Le bloc anonyme reste compact ; pas de nouveau menu ni de fenêtre automatique. Les exemples fictifs de la maquette ne sont pas des données du lycée.

Browser plugin non disponible dans cette session : recette navigateur avec Playwright Chromium. Comparer la maquette et les captures finales avant clôture.

## Vérification et livraison

- `npm run build` réussi avec les fonctionnalités publiques activées dans le processus de recette, sans modification des fichiers d’environnement. Avertissement de taille de bundles préexistant ; pas d’erreur de compilation.
- `npm run test:preview-security-gate` réussi. Deux doubles de tests ont été adaptés aux nouvelles dépendances optionnelles du guichet ; leurs assertions d’accès et de provenance restent inchangées.
- `npm run test:personal-home` : 13 tests, dont absence/expiration/révocation/changement de session, mauvais enfant, annuaire remplacé, source périmée pendant la lecture, erreurs partielles, contrat borné et paramètres HTTP refusés.
- Les trois requêtes réellement produites par Drizzle (personne, enfants liés, demandes) ont été compilées puis soumises à `EXPLAIN` sur la base utilisée par le portail, avec uniquement des identifiants fictifs. Syntaxe et résolution des tables confirmées, sans lecture de dossier ni mutation de données. Ce contrôle ne remplace pas une recette d’identité réelle.
- Playwright sur le build local sous les en-têtes CSP du site, en 1440, 390 et 320 px : entrée anonyme, noms/profil, deux contacts masqués, un seul OTP **simulé**, retour identifié, aujourd’hui/demain, impression/PDF, demande → document fictif, retour sans renvoi OTP, gestion d’accès, effacement, parent avec deux enfants, source manquante et groupes incomplets. À 390 px : expiration, changement annoncé depuis un autre onglet et passage hors connexion. Aucune erreur JavaScript ni débordement.
- Maquette et captures finales relues. Chevauchement initial du titre avec la photo corrigé ; titres renforcés et dates françaises sans majuscule superflue. Le menu mobile fixe existant reste présent. Les captures de section plus hautes que l’écran peuvent le montrer au milieu de l’image, à la position réelle du viewport.
- Preuves locales hors Git : `Accueil_personnel_2026-09-11/`, à la racine de l’espace de travail. Aucun email, SMS, push, compte réel ni demande réelle créé pour cette recette.

Version fonctionnelle `6480144` publiée : déploiement `dpl_BrDqJ13FLcvuf4MYf3KkZLQFzTsY` READY, URL immuable `https://lyceegest-e250mdcwu-safe-scol.vercel.app`, domaine principal confirmé. Recette publique réelle sur les deux adresses en 1440/390/320 px : entrée anonyme → identification → retour accueil, calendrier conservé, zéro erreur JavaScript et zéro écriture API. GET personnel sans identité renvoie uniquement `status: unavailable`, paramètres interdits refusés en 400, réponses sans cache. Aucun OTP réel n’a été envoyé.

Un dernier ajustement visuel masque, uniquement dans cette entrée dédiée, le lien de sortie redondant de la carte d’identité : « Continuer dans le chat » reste disponible en dessous. « Réessayer » oublie un ancien choix d’enfant pour récupérer les choix de la session actuelle. Build, gate et recette locale rejoués ; reprise après refus 403 de l’ancien choix vérifiée dans les trois formats. Publication de cet ajustement à confirmer.
