# Les informations qui me concernent — 12 septembre 2026

Lot 002/T074D. Autorisé par Adel après la proposition d'un espace d'informations ciblées.

Priorité : choisir élèves, parents ou personnels et des classes de l'annuaire actif, puis lire les seules versions publiées dans l'espace personnel avec leurs dates et documents. Aucun ciblage déduit par l'IA, aucun envoi automatique lors d'une publication. La diffusion push/email nominative et le rappel conversationnel des articles réservés restent des lots distincts.

Le calendrier public, ses exports et les archives doivent exclure les publications réservées. Les mêmes dates validées accompagnent l'article personnel. Les noms, coordonnées et listes d'élèves ne sont pas nécessaires à cette fonction. Le ciblage est conservé dans les versions existantes, y compris lors d'une duplication ou restauration. Les parents accèdent uniquement aux classes des enfants reliés par l'annuaire actif. Les personnels ne reçoivent pas de droits de professeur déduits de leur seul profil.

Recette prévue : publication et changement de ciblage, élève/parent/personnel/visiteur, classe incorrecte, révocation et expiration, accès direct à un article, documents, publication future ou archivée, ordinateur et mobile. Browser plugin non disponible : Playwright local avec données fictives, puis vérification publique en lecture seule. Résultats à compléter avant clôture.

## Vérifications locales terminées

- `npm run build` : réussi ; avertissement de taille des bundles préexistant.
- `npm run test:preview-security-gate` : réussi jusqu’au contrôle des 118 migrations. Le jeu de test de projection éditoriale a été adapté au champ optionnel `targeting`, sans suppression d’assertion de confidentialité.
- `npm run test:personal-news` : 11 tests réussis ; `npm run test:personal-home` : 13 tests réussis. Limites exactes élève/parent/personnel/classe, brouillon contre version publiée, absence de session, révocation, changement d’import, accès direct, document bloqué, échéance et contrat minimal.
- Playwright, build local et API fictives : 1440/390/320 px, cartes, article, pièce fictive, export de calendrier, autre enfant, information retirée, absence d’identité et expiration. Aucun débordement ni erreur JavaScript. Les dates sans heure ne deviennent pas minuit. L’ouverture des documents conserve l’effacement au passage en arrière-plan.
- Éditeur 1440/390 px : choix élèves et parents pour 2DE1 fictive, dates, sauvegarde/relecture et publication simulée. Publier des modifications non enregistrées affiche une consigne ; la confirmation reste visible après rechargement. Un ancien onglet envoie sa version attendue ; la publication est refusée si la version a changé. Le profil personnels ne peut pas élargir silencieusement un choix de classes.
- Revue React : composants séparés, contrôles natifs et libellés, nettoyage des requêtes/timers, rendu Markdown filtré existant, aucun stockage personnel local.
- Les trois requêtes produites par Drizzle ont été soumises à EXPLAIN, sans ANALYZE et avec identifiants fictifs, sur la base du portail : syntaxe et tables vérifiées. Compteurs : un établissement actif, correspondant au portail. Aucune lecture nominative pour la recette.

Preuves hors Git : `Infos_personnelles_2026-09-12/` à la racine de l’espace de travail. Les captures sont des exemples fictifs. La recette mobile de l’éditeur a été rejouée seule après une attente de contrôle manquée dans la séquence multifenêtre ; elle passe. Les fixtures d’édition n’utilisent pas la base réelle.

## Périmètre précis

L’accueil présente trois cartes, extensibles jusqu’à huit informations en cours, avec priorité aux informations ciblées. Le choix d’enfant filtre l’aperçu ; ouvrir l’article vérifie de nouveau les liens autorisés. Le ciblage enseignant spécifique n’est pas déduit du rôle personnel : l’ancien public `professeurs` reste exclu tant qu’une preuve dédiée n’est pas ajoutée. Les mêmes dates sont consultables et exportables depuis l’article personnel ; elles ne sont pas ajoutées au calendrier public. Un calendrier téléchargé ne se synchronise pas automatiquement.

Les articles sont relus après un délai de 60 secondes maximum. Les réponses privées sont sans cache ; les liens de fichiers propres sont délivrés uniquement après contrôle d’accès, pour au plus 60 secondes et dans la limite de l’expiration. Les copies déjà téléchargées restent sous le contrôle du destinataire. Aucun changement aux règles OTP, rôles ou durées de session.

Aucune publication réelle ni notification de démonstration. La préparation IA existante reste disponible ; le ciblage est choisi et validé par une personne habilitée. Les envois ciblés et l’utilisation conversationnelle du contenu réservé sont à traiter séparément.
