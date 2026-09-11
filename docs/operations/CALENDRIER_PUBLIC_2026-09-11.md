# Calendrier du lycée relié aux actualités — 11 septembre 2026

Demande d’Adel : ajouter un calendrier visible, élégant et intuitif, cohérent avec l’accueil, les photos et l’hebdo. Lot 002/T074B. L’allusion à une fonction d’ASSMA reste à préciser ; aucun changement du projet ASSMA ni de la radio.

## Parcours livré

- `/?view=calendar` : mois commençant le lundi, dates repérées, sélection d’un jour, navigation mensuelle, retour au mois entier. Sur téléphone, liste par défaut et bouton Mois.
- Accueil : deux prochains rendez-vous du mois courant ou du suivant, lien vers le calendrier. Entrée Calendrier dans le menu public et lien depuis À la une.
- Chaque rendez-vous utilise les photos existantes, renvoie à son article et propose un fichier ICS. Les pages d’articles ont le lien retour vers leurs dates. Une publication expirée reste consultable par son lien d’archive ; un retrait manuel reste privé.
- Les heures inconnues restent vides. Le fichier ICS utilise une date entière avec fin exclusive, ou l’heure Europe/Paris si elle est connue. Pas de durée inventée. C’est une copie à importer dans l’agenda, pas un abonnement ni une synchronisation automatique.

## Une seule publication pour le texte et les dates

`calendarEvents` est enregistré dans le snapshot JSON de `site_content_versions`, sans migration ni nouveau droit. Le calendrier lit uniquement la version désignée par `publishedVersion`, destinée à tous. Il exclut les contenus non publiés, retirés, privés et les publications futures. Les dates d’un brouillon de correction ne remplacent pas celles de la version publiée.

L’éditeur Contenus du site permet d’ajouter, modifier et retirer jusqu’à douze rendez-vous par article, avec dates inclusives, heures facultatives et lieu. Enregistrement, restauration et duplication conservent ces métadonnées. Un ancien client qui n’envoie pas le champ les préserve.

L’atelier Hebdo demande à l’IA les rendez-vous explicitement présents dans la source, affiche les champs pour relecture puis les transmet au brouillon. Le protocole Gmail `../Hebdos_lycee/PROTOCOLE.md` décrit le même format ; son import conserve déjà les champs du parseur applicatif. La validation et les notifications gardent leur circuit existant. Aucun envoi déclenché par ce lot.

## Dates reprises dans les contenus existants

Projection contrôlée sur la branche Supabase du portail : huit nouvelles versions et huit audits sans acteur humain simulé, textes et décisions de publication conservés. Cinq articles déjà publiés donnent six rendez-vous : EDT le 14, ordinateurs les 14–15 en salle polyvalente, tests de mathématiques les 14–18 et de français les 21–25, sport le 16 de 8 h 30 à 12 h 30 selon les créneaux de classe, spécialités le 30. Les trois autres articles restent en brouillon avec leurs cinq dates à valider. La copie déjà publiée de l’article des spécialités n’a pas reçu un événement supplémentaire.

Contrôle après écriture : les huit textes sont identiques à leur version précédente ; cinq `publishedVersion` avancent, trois restent nuls. Rejeu de la même projection : zéro modification, version et audit supplémentaires. SQL, sources et reçus hors Git dans `../Calendrier_lycee_2026-09-11/`.

## Vérifications

Build TypeScript/Vite et tests du calendrier/hebdo exécutés. Six groupes de tests couvrent dates invalides, année bissextile, minuit Paris, limites de mois, validation des champs, publication, archives, périodes sur deux mois, ICS, échappement, pliage UTF-8 et heures inconnues. Les contrats de payload existants ont été mis à jour et conservent leurs contrôles stricts.

Navigateur : plugin de navigateur indisponible, utilisation de Playwright Chromium installé. Recette locale sur 1440, 390 et 320 px : navigation, photos chargées, filtre journalier, lien article aller-retour, accueil, mois vide, erreur et reprise, aucun débordement ni erreur JavaScript. Captures relues contre le concept et la charte. Le téléchargement natif sera vérifié à distance ; localement son contenu est validé via la réponse simulée.

Édition testée avec identité entièrement fictive et API simulée, requêtes externes bloquées : ajout d’une date, heure inconnue conservée, enregistrement du payload et relecture après rechargement. Aucune publication de test ni session administrative réelle utilisée. Aucun test sur téléphone physique ou Safari/iOS. L’appel IA payant de l’atelier Hebdo n’a pas été déclenché ; validation de son schéma et des payloads avec les tests.

## Publication vérifiée

Commit fonctionnel `68d8dab9ab36ef1a4ab003a67d614a3d12f2686f`, déploiement READY `dpl_89zzHP3nRLHVEy9Qf5fbTzi1CUcf`, URL immuable `https://lyceegest-839wc7oi6-safe-scol.vercel.app`. Alias principal confirmé : `https://lycee-blaise-cendrars-sevran.fr`. Retour arrière vers `https://lyceegest-g1gt3baj0-safe-scol.vercel.app` (`b383f05`) possible ; les métadonnées ajoutées sont compatibles avec cette version.

Gate complet réussi, intégrité Spec Kit réussie. Recette réelle réussie sur l’URL immuable puis le domaine principal en 1440/390/320 px : six rendez-vous, photos, filtre du jour, article aller-retour, accueil, mois vide, téléchargement natif ICS et zéro erreur JavaScript ou débordement. Captures du domaine relues visuellement. Sept contrôles HTTP par domaine : calendrier 200, six événements version 2, un seul horaire connu, mois suivant vide, mois invalide 400, événement inexistant 404, fichier du mois avec six VEVENT, brouillon non exposé et détail administratif anonyme 401.

Preuves : `../Calendrier_lycee_2026-09-11/{local,lyceegest-839wc7oi6-safe-scol.vercel.app,lycee-blaise-cendrars-sevran.fr}/`, scripts de recette, captures et fichiers ICS. Le générateur d’import Gmail a aussi été exécuté en préparation seulement avec huit cartes et onze dates ; aucune insertion supplémentaire. Le serveur d’aperçu local a été arrêté.
