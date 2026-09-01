# Quotas assistant : identifiants reconnus et trafic global

## Ce qui change

La route assistant ne se limite plus au `sessionId` declare par le navigateur.
Elle applique les compteurs suivants avant toute analyse :

- garde reseau existant : 20 000 appels par heure ;
- meme garde-fou pour l'etablissement, tous reseaux confondus ;
- 24 appels par 24 heures pour l'ancien signal declare et pour le cookie
  anonyme signe par le serveur ;
- meme seuil additionnel pour un compte verifie par Auth et/ou une session
  de suivi valide possedant une autorisation de dossier dans l'etablissement.

Ces compteurs utilisent les HMAC et la table atomique existante. Aucune nouvelle
permission SQL. Le nouveau scope `assistant_global` est accepte par la migration
`20260901212344_add_global_assistant_traffic_guard.sql`, appliquee uniquement a
`guichet-lycee-preview` apres controle de la cible non principale.

Le cookie contient seulement alea, version, etablissement, emission et expiration.
Sa signature est separee de celles des recus d'outils. Duree trente jours sans
prolongation a la lecture ; `HttpOnly`, `SameSite=Lax`, et `Secure` avec prefixe
`__Host-` en production Vercel. Aucun domaine partage. Les autres cookies de la
reponse sont conserves. Le suivi et ses droits ne sont ni crees ni modifies.

Le signal declare continue de lier les recus de routage et de normalisation,
pour ne pas casser une demande preparee avant la mise a jour. Le nouveau cookie
ne donne aucun acces a un dossier ou a une information scolaire.

## Preuves et limites de preuve

- Neuf tests executent le vrai resolveur de cookie et le garde compile avec
  fournisseurs et stockage doubles : changements d'identifiant declare, compte
  identique avec nouveaux cookies, cookie forge/duplique/expire/futur, autre
  etablissement, erreurs Auth/base, session inconnue/revoquee/expiree/hors scope.
- Les conditions des jointures et filtres de session sont reellement evaluees
  par le double relationnel. Pas de preuve Auth distante ou de compte nominatif.
- Le veritable handler s'arrete avant l'analyse sur refus du garde. La
  preservation de la liaison des recus et l'independance du formulaire sont
  verifiees. Aucun appel OpenAI ni autre fournisseur dans les tests.
- 200 appelants fictifs concurrents passent dans le double de stockage partage,
  sans plafond NAT bas. C'est un test de composition, **pas** une charge reseau
  distribuee sur Vercel/PostgreSQL.
- Recette PostgreSQL appliquee a la preview : la requete SQL extraite du vrai
  `enforceSupportRateLimits`, compilee par Drizzle, accepte le dernier creneau,
  refuse le suivant et remet le compteur a un apres expiration. Le compteur
  reste borne a 20 000. Transaction annulee ; controle separe : zero fixture.
- RLS forcee et absence de droits directs anon/authenticated verifies par cette
  recette. Conseiller Supabase : 62 INFO preexistants, aucun WARN/ERROR.
- Compilation, barriere de securite, treize tests de provenance des resumes,
  quatre contrats responsive et integrite Spec Kit passent. 91 migrations,
  556 taches dont 454 terminees et 102 ouvertes. Ce n'est pas un taux operationnel.
  L'avertissement de taille XLSX reste preexistant ; aucune mise en page changee.
- Le generateur `scripts/assistant-quota-sql-recipe.mjs` ne se connecte a aucune
  base. Il produit une recette complete avec UUID/hash fictif aleatoire, limites
  de duree, refus de triggers applicatifs inconnus et `ROLLBACK` final.

Pour reproduire la recette, produire le SQL avec :

```powershell
node --experimental-strip-types scripts/assistant-quota-sql-recipe.mjs
```

Verifier independamment la cible locale jetable ou preview, executer le SQL
complet dans une seule connexion autorisee, puis controler l'absence du hash
synthetique retourne. Ne pas copier ces operations sur la production.

## Ce qui n'est pas resolu par ce lot

- Effacer tous les cookies, refuser leur stockage ou envoyer une valeur invalide
  peut creer un nouvel anonyme. La valeur invalide ne devient jamais un ID
  reconnu ; elle est remplacee apres application du garde global. Un anonyme
  ne represente pas une personne unique. Le garde global reste commun.
- Une nouvelle session de suivi peut avoir un nouveau compteur ; seul un compte
  Auth reconnu stabilise ce compteur entre appareils. Aucun lien parent-enfant
  ou niveau I3 ne decoule de ce mecanisme.
- Les 20 000 appels/heure sont un garde-fou technique repris du seuil existant,
  pas une recommandation de depense. Il compte le trafic de cette route, meme
  sans appel modele, et pas les traductions ou la redaction editoriale.
- Le budget monetaire global, sa reservation avant depense, les tarifs verifies,
  l'observation en conditions reelles et le reglage d'exploitation restent
  ouverts. Le proprietaire a ete interroge sur son maximum journalier ; aucun
  montant ni activation de depense n'a ete decide a sa place.
- Une attaque peut epuiser un plafond partage. Pare-feu, alertes et observation
  doivent completer ce garde avant ouverture elargie. Le formulaire et le suivi
  conservent leurs propres limites, sans dependre du plafond assistant.
- Le cookie technique et sa duree restent a inclure dans les mentions et la
  validation de protection des donnees avant production. Un retrait du suivi
  ne donne pas un nouveau quota anonyme sur le meme navigateur.
- Aucune nouvelle mission Claude ni consommation externe. T049C et les
  contre-revues restent ouverts. Aucun compte, personne ou envoi reel.
