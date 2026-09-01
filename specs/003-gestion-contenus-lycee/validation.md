# Validation du jalon

**Date** : 26 août 2026
**Branche** : `codex/lycee-connect-prototype`
**Commit fonctionnel** : `a0388a3`
**Environnement** : preview uniquement

## Résultats

- Build TypeScript et Vite réussi.
- 11 tests de politique de l'assistant réussis.
- 6 tests des validateurs de contenu réussis.
- Aucune vulnérabilité dans les dépendances de production selon `npm audit --omit=dev`.
- Vérification visuelle sur ordinateur, 390 px et 320 px sans débordement horizontal.
- API publique déployée : réponse JSON valide avec la liste vide attendue.
- API d'administration déployée : accès refusé sans authentification.
- Base preview : 5 modèles, 6 tables avec RLS, aucun droit direct pour `anon` ou
  `authenticated`, bucket `site-content` privé.

## Complément du 28 août 2026

- Le commit `0349530` a été construit avec succès par Vercel et servi sur l'alias
  de la branche de preview.
- Build TypeScript et Vite réussi après durcissement de l'éditeur.
- 3 tests dédiés vérifient l'avertissement de brouillon, les noms accessibles des
  commandes et l'absence du bouton de notification inactif.
- L'éditeur affiche un état non enregistré, propose une annulation et protège le
  changement de contenu, d'onglet ou de page.
- La session agent administration a été vérifiée sans élargissement de rôle ni
  modification de compte.
- Une modification temporaire du titre a affiché l'avertissement et activé
  l'enregistrement ; le champ a ensuite été remis à vide sans créer de contenu.

## Vérification humaine restante

La direction doit se connecter, créer un brouillon fictif, le soumettre puis le
publier. Cette étape confirme le rôle réel du compte et le parcours complet sans
introduire nous-mêmes de contenu présenté comme officiel.

## Complément du 1er septembre 2026 - contrats d'administration

- La bibliothèque, la fiche éditable et l'historique sont plafonnés dès les
  requêtes puis projetés sur des champs strictement nécessaires.
- Le navigateur refuse une réponse contenant un acteur, un chemin de stockage,
  un champ inconnu, un doublon, une URL signée étrangère ou un ordre incohérent.
- Création, modification, validation, publication, archivage, duplication,
  restauration et vérification de source renvoient un reçu minimal lié à
  l'identifiant, l'action, l'état et la version attendus.
- Sept tests adverses et vingt-six tests historiques liés aux contenus passent
  sans donnée réelle, base distante, upload, publication ou envoi externe.
- La barrière de sécurité complète, l'intégrité des 516 tâches Spec Kit, le
  build et `npm audit --omit=dev` passent ; aucune vulnérabilité n'est détectée.
- Les réservations et confirmations de fichiers, les modèles, l'assistance IA
  et la reprise de l'ancien site sont fermés dans le complément suivant.

## Complément du 1er septembre 2026 - réponses auxiliaires

- Une réservation de fichier est liée au nom, type, taille, titre, description,
  chemin privé attendu et jeton signé avant tout appel au stockage.
- La confirmation doit reprendre exactement l'UUID et les métadonnées réservées
  avec l'état `ready` ; les listes signées refusent toute autre origine.
- Création et modification d'un modèle renvoient uniquement le modèle projeté.
  Une mise à jour exige la version encore courante en base et refuse un écran
  périmé au lieu d'écraser silencieusement une modification.
- La proposition IA est validée sur sept champs exacts, des listes uniques et
  des limites éditoriales avant d'entrer dans le brouillon.
- La reprise WordPress ne renvoie plus les erreurs, références ou identifiants
  individuels : l'écran reçoit uniquement progression et compteurs agrégés.
- La migration `20260901060000` est appliquée exclusivement à la branche
  Supabase preview `xijocumlwivhbmffrnlj`. Les actions `reserve_upload`,
  `confirm_upload` et `reject_upload` passent dans une transaction fictive ; le
  rollback est vérifié à zéro résidu.
- Dix tests adverses, trente-trois tests historiques ciblés, le build et
  l'intégrité des 81 migrations passent sans fichier, contenu ou email réel.
- La confirmation télécharge désormais le fichier avec une limite ferme de
  10 Mo et vérifie sa signature réelle. Dix cas dédiés refusent notamment un
  exécutable déclaré PDF, un PNG tronqué et une archive déclarée DOCX.
- Le passage antivirus des médias éditoriaux reste explicitement ouvert en
  T009C et bloque toute ouverture publique avec fichiers réels. Le contrôle de
  signature réduit le risque mais ne remplace pas un moteur antivirus.
- La barrière de sécurité complète, le build, l'intégrité des 521 tâches Spec
  Kit et `npm audit --omit=dev` passent après ces changements ; l'audit trouve
  zéro vulnérabilité de production.

## Complément du 1er septembre 2026 - socle antivirus éditorial

- La migration `20260901073000` est appliquée uniquement à la base preview
  `xijocumlwivhbmffrnlj` : bucket privé de quarantaine, file dédiée, états et
  transitions protégées, empreinte SHA-256 et preuves d'audit bornées.
- Les 78 médias WordPress déjà présents, dont 47 liés à des brouillons, restent
  inchangés ; aucun contenu n'était publié au moment du contrôle.
- Une transaction fictive prouve le refus d'un passage direct à `ready`, puis le
  cycle `pending -> quarantine -> ready` avec `clamav_clean`. Son rollback laisse
  zéro média, zéro audit et zéro message de file.
- Le worker, le service et le timer sont versionnés mais non installés sur le
  VPS. Aucun fichier réel ni moteur ClamAV distant n'est utilisé ; T009C reste
  ouverte jusqu'à cette recette explicitement autorisée.
- Le build, la barrière complète de sécurité, les 82 migrations, l'intégrité des
  522 tâches et l'audit des dépendances passent ; zéro vulnérabilité est trouvée.

## Liens preview

- Portail : https://lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app/prototype
- À la une : https://lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app/prototype?view=news
- Administration : https://lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app/admin/contenus
