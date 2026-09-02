# Barrière finale de sécurité de la preview

**Date** : 2 septembre 2026  
**Branche** : `codex/lycee-connect-prototype`  
**Jalon vérifié** : `0503d38`

## Résultat

La commande `npm run test:preview-security-gate` termine avec le code de sortie
zéro sur l'état propre du dépôt. Elle a été rejouée après la fermeture des
relations d'identité et la préparation de la promotion réversible.

Les preuves transversales comprennent notamment :

- 104 routes API découvertes avec une frontière de méthode explicite ;
- 71 routes privées sous les gardes d'authentification attendues ;
- 16 tables du guichet couvertes par la preuve RLS privée ;
- 93 migrations et 93 versions uniques ;
- matrice identité-rôle-action commune, services persistés, MFA et refus entre
  établissements, foyers, dossiers et services ;
- corps HTTP, réponses JSON, fichiers, téléchargements et sorties fournisseurs
  bornés avant copie complète ou effet visible ;
- secrets refusés avant stockage ou analyse ;
- workers entrants, éditoriaux et documentaires fermés sans leurs drapeaux ;
- contrats publics, privés, agent, contenu, communication et Webmail validés ;
- recettes de preview et locales verrouillées sur des cibles fictives et des
  nettoyages bornés.

Le build Vercel du même jalon documentaire, déploiement
`dpl_3sCzmc37CJfvfavvJ6B3bkHsmoto`, est `READY`, porte exactement le SHA
`0503d383fdef8d87844534a62365c58d3094aec8` et conserve `target=null`.
La page protégée charge l'assistant sans débordement à 320 px ;
`GET /api/content/public?limit=1` renvoie `200` avec le contrat
`items`, `nextCursor`, `scope` attendu.

## Dernier candidat non fermé

`005/T032` exige une vraie recette réseau entre LyceeGest et un faux Webmail
déployé séparément, avec secrets éphémères, contacts fictifs et preuve de zéro
résidu. Le dépôt contient le transport et onze tests locaux, mais aucun endpoint
de faux Webmail déployé. Remplacer cette preuve par un appel en mémoire ou un
endpoint de la même application ne satisferait pas la spécification.

La tâche reste donc ouverte jusqu'à une autorisation précise nommant le faux
service, sa cible de preview, sa durée et ses secrets temporaires. Aucun endpoint
public, email, contact réel, appel Brevo, variable distante ou projet Vercel
supplémentaire n'a été créé pendant cette vérification.

## Limites

Cette barrière ne remplace pas les validations humaines, comptes nominatifs,
restaurations distantes, lecteurs d'écran réels, intégrations Webmail/ENT/PRONOTE,
imports autorisés, pilotes ou actions de production encore ouvertes dans Spec
Kit. Aucun audit Claude supplémentaire n'a été lancé.
