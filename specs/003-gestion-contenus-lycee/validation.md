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
  et la reprise de l'ancien site feront l'objet du sous-lot de contrats suivant.

## Liens preview

- Portail : https://lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app/prototype
- À la une : https://lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app/prototype?view=news
- Administration : https://lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app/admin/contenus
