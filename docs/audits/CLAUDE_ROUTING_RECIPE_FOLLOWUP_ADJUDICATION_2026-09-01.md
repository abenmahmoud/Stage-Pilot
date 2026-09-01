# Contre-revue des recettes : arbitrage et preuves

## Execution autorisee

Le renouvellement explicite du proprietaire a autorise une seule contre-revue
Fable 5 des six scripts au commit `4f5575b`, en lecture seule et sous plafond
5 USD. Le paquet comptait 46 305 caracteres. Aucun secret ni fichier utilisateur
transmis ; outils, MCP, sous-agents et persistance de session desactives.

L'execution s'est terminee normalement, en un tour. Le CLI annonce 0,742712 USD :
0,72585 pour Fable 5 et 0,016862 pour l'auxiliaire automatique Haiku du CLI.
Il s'agit d'une mesure au tarif liste, pas d'une verification de facture ou du
quota d'abonnement. Cette autorisation est consommee ; aucune autre relance.

## Arbitrage

| Constat Claude | Decision Codex |
| --- | --- |
| P1 : absence de verification automatique des metadonnees Vercel | Confirmee dans les scripts. La procedure imposait deja un controle externe, effectue pour `4f5575b`. Le controle est maintenant executable avant toute creation de client Supabase : URL exacte, projet, equipe, branche, commit complet, statut READY et environnement standard de preview. Erreur, timeout, JSON incomplet ou cible differente bloquent la recette. Aucun PATCH en production observe. |
| Recommandation `target === "preview"` | Adaptee au contrat observe : l'API brute renvoie `target: null` pour cette preview, et le CLI inspect normalise en `preview`. Le controle accepte null explicite ou preview, jamais un champ absent, la production ou un environnement personnalise. L'API brute est preferee a inspect, qui omet projet et commit dans sa sortie JSON. |
| P3 : exceptions nulles si une reponse Auth est incomplete | Corrigees pour creation du compte, connexion et enrollment dans les deux recettes. Messages generiques constants et acces optionnel aux donnees ; un test du vrai client SDK avec reponse simulee vide verifie un diagnostic de connexion et aucun succes. |
| P3 : cles applicatives heritees par npm/Vercel/curl | Corrige : filtre insensible a la casse des variables applicatives sensibles, preservation de l'authentification Vercel necessaire. Le test injecte uniquement des marqueurs fictifs. Il verifie aussi que PATH reste disponible, y compris avec sa casse Windows. |
| P3 : fichier temporaire cree hors try | Creation deplacee dans le try ; retrait du dossier toujours tente meme si celui du fichier echoue. Pas de suppression recursive : seuls le fichier et le dossier temporaire crees par le test sont concernes. |
| Transport stdin et nettoyage deja corriges | Contre-revue favorable ; tests de transport, refus d'autorisation et dix cas MFA/session conserves. L'affirmation generale d'absence de faux succes ne vaut que pour les chemins effectivement verifies. |

## Verification

- Six tests de surete passent. Ils executent les deux recettes avec faux
  reseau/CLI, refusent notamment une production a URL plausible et verifient
  qu'aucun appel Supabase ne precede les gardes. Quatorze variantes de
  metadonnees invalides et trois echecs de transport/JSON sont refuses.
- Les onze tests d'observabilite passent.
- La barriere complete de securite de preview, l'integrite Spec Kit et la
  compilation passent. Avertissement XLSX preexistant conserve ; aucun ecran
  ni asset public modifie.
- Le nouveau controle a interroge en lecture seule la veritable API Vercel :
  `dpl_6jSnuAHnyucu7MUzDGqafovjXZm8`, SHA
  `4f5575b2bd53e4ca1a455d6ff77503ac87d8727c`, READY, preview du projet attendu.
  Aucun secret ou sortie brute de metadonnees stocke dans Git.
- La recette Auth/MFA avec dossiers fictifs n'est pas executee : la cle de
  service locale est toujours masquee lors du dernier controle booleen.
  T030D3 demeure ouverte. Aucun compte, dossier, email ou SMS cree par ce lot.

Les changements apres cette contre-revue sont verifies par Codex. Ils n'ont
pas fait l'objet d'un troisieme appel Claude. La protection est un controle a
l'instant du demarrage, pas un verrou contre une promotion concurrente : aucune
modification du deploiement ou des compteurs pendant la recette n'est admise.

Sources techniques : [Vercel inspect](https://vercel.com/docs/cli/inspect),
CLI local 59.10.0 (aide, sortie JSON et code de normalisation inspect), API
Vercel lue sans mutation, et code/tests du depot. Aucun schema Supabase change.
