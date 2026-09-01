# Contre-revue des corrections des recettes de classement

## Autorisation et limite

Le proprietaire a explicitement renouvelle la mission apres la premiere revue :
Claude Fable 5, six scripts corriges, lecture seule, une execution, plafond 5 USD.
Pas de relance, outil, MCP, sous-agent ou changement distant. Volume moyen.
Aucun secret, fichier prive, donnee personnelle ou conversation a transmettre.

## Mission

Contre-verifier les corrections au commit `4f5575b` du portail LyceeGest :
transport du jeton AAL2 hors arguments, nettoyage MFA et compte de test,
absence de faux succes et pertinence des tests. Signaler seulement des defauts
concrets restants, avec preuve et correction minimale. Aucun audit global.

## Sources fournies

- `scripts/routing-review-vercel-cli.mjs`
- `scripts/routing-review-session-cleanup.mjs`
- `scripts/test-preview-routing-review-client.mjs`
- `scripts/test-preview-support-assistant-routing-review.mjs`
- `scripts/test-preview-routing-review-recipe-safety.mjs`
- `scripts/test-support-assistant-routing-review.mjs`

Le premier helper de destination est inchange, precedemment audite, non inclus.
La cible Vercel doit aussi etre verifiee par metadonnees avant execution : la
forme du nom de domaine seule ne prouve pas un environnement de preview.
Ne pas supposer le contenu d'un fichier non fourni.

## Contexte deja contre-verifie par Codex

- Le CLI Vercel local transmet stdin a curl. Un essai curl Windows sur boucle
  locale a valide `--header @-`, mais pas encore une requete API authentifiee.
- Le client sans cle serveur retire son seul facteur MFA avant signOut local.
  Il ne possede pas la creation/suppression SQL des dossiers et du compte.
- La recette serveur cree un compte et deux dossiers fictifs. Son nettoyage
  doit etre tente meme en cas d'echec. Une reponse reseau ambigue n'est pas une
  preuve de rollback : examiner les identifiants disponibles pour nettoyer.
- Le role Direction/superadmin est exige par l'API de mesures et AAL2. Une
  simple adhesion admin ne le remplace pas. La recette ne s'execute pas en
  concurrence avec d'autres changements des compteurs de cette preview.
- Une FK composite avec ON DELETE CASCADE relie deja les revues aux dossiers.
  Aucun besoin d'ajouter des droits DELETE ou une migration non justifiee.

## Livrable et arret

Maximum 650 mots en francais : verdict bref, constats P0-P3 avec fichier/ligne,
scenario d'echec, impact, correction et test minimal. Distinguer les preuves
dans les fichiers des hypotheses/API non verifiees. Si aucun defaut n'est
demontre, le dire sans inventer une nouvelle liste de recommandations.
