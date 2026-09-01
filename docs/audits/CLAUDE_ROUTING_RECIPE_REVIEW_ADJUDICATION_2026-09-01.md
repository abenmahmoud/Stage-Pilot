# Arbitrage de la revue des recettes de classement

## Mission terminee

Autorisation explicite recue le 1er septembre 2026 pour six scripts, une seule
execution Claude Fable 5 en lecture seule et un plafond de 5 USD. Le paquet
comptait 41 338 caracteres avec le brief et les numeros de lignes. Aucun outil,
MCP, sous-agent, personnalisation, secret, donnee personnelle ou session
persistante. Le code de production et les autres projets restent exclus.

Execution terminee normalement en un tour. Le CLI annonce **0,632103 USD** :
0,61689 pour Fable 5 et 0,015213 pour son auxiliaire automatique Haiku. Cette
mesure du CLI ne constitue pas une verification de facture ni du quota
d'abonnement. L'accord est consomme, sans relance ni depense du reliquat.

## Constats verifies

| Constat | Arbitrage et correction |
| --- | --- |
| Jeton AAL2 dans les arguments du processus | Confirme dans les deux recettes et dans le message de diagnostic du Vercel CLI 59.10.0 inspecte localement. Le jeton passe maintenant via l'entree standard avec `--header @-`, jamais dans les arguments ou un fichier temporaire. Format JWT et absence de sauts de ligne controles avant lancement. Il s'agissait d'un risque local des outils, pas d'une fuite publique observee. |
| Facteur MFA laisse par le client sans cle serveur | Absence de desenrolement confirmee. Le client retient uniquement l'identifiant du facteur qu'il cree, tente son retrait avant de fermer sa propre session et signale toute erreur. La reexecution distante et le comportement exact du nom de facteur restent non verifies. |
| Fixture superadmin excessive | La proposition de remplacer ce role par la seule adhesion `admin` est rejetee pour ce test : l'API de mesures exige explicitement `direction` ou `superadmin` et le perimetre global, sous MFA. Le nettoyage reste obligatoire ; un echec n'est plus suivi d'un message de succes. La suppression du compte est encore tentee si celle de l'adhesion leve une exception. Aucune fixture reelle creee pour cette revue. |
| Cascade de suppression absente | Non confirme : la cle etrangere composite vers le dossier comporte deja `on delete cascade`. Une assertion ciblee conserve cette preuve. Aucun droit DELETE ajoute au journal de classement. |
| URL Vercel pouvant aussi designer la production | Limite connue et documentee. L'operateur doit verifier projet, commit et cible non production dans les metadonnees Vercel avant toute recette. La regex n'est pas presentee comme une preuve d'environnement. |
| Latence MFA et changements concurrents des mesures | Risques conditionnels, non reproduits. Le run exige une preview sans autre travail concurrent sur ses mesures. Pas de boucle automatique d'essais OTP ajoutee. |
| Fichier env requis alors que les variables sont exportees | Confirme dans le client sans cle serveur. Les deux recettes tolerent maintenant l'absence du fichier par defaut, mais refusent toujours un chemin explicitement fourni absent. |

Codex a egalement deplace les messages de succes apres les blocs de nettoyage :
une erreur de retrait MFA, session, adhesion ou compte ne produit plus un bilan
reussi. Un incident de nettoyage exige une verification operateur avant une
nouvelle execution, meme si les compteurs metier ont retrouve leur valeur initiale.

## Preuves et limites

- Quatre tests de securite de recette passent : destinations trompeuses refusees
  avant reseau, configurations exportees sans fichier, transport du jeton hors
  arguments, huit entrees d'autorisation invalides et dix combinaisons de
  nettoyage MFA/session. Les appels Supabase restent simules.
- Le programme curl de Windows a recu un en-tete fictif par entree standard
  contre un serveur temporaire exclusivement local, ferme apres verification.
  Le code du Vercel CLI inspecte transmet l'entree standard au processus curl.
  Cela ne prouve pas une connexion authentifiee au deploiement.
- Les onze tests d'observabilite passent, y compris la cascade composite.
- La barriere complete de securite de preview, l'integrite Spec Kit et la
  compilation passent. Le controle natif du Vercel CLI reussit sans appel
  authentifie. L'avertissement de taille XLSX preexistant subsiste.
- T030D3 reste ouverte pour la recette API avec les acces prives de preview.
  Aucun compte, dossier, email, SMS ou fichier reel cree pendant la revue.

Sources primaires utilisees pour les corrections :
[curl, en-tetes depuis stdin](https://curl.se/docs/manpage.html#-H) et
[Supabase, retrait d'un facteur MFA](https://supabase.com/docs/reference/javascript/auth-mfa-unenroll).

La premiere revue externe a porte sur les six fichiers avant correction. Le
proprietaire a ensuite autorise une contre-revue distincte des corrections et
du nouvel auxiliaire de nettoyage, documentee dans
`CLAUDE_ROUTING_RECIPE_FOLLOWUP_ADJUDICATION_2026-09-01.md`.
