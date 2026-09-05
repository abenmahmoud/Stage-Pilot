# Plan — fiabiliser la connaissance de l'agent (principes OB1 adaptes)

Base : `docs/operations/CARTOGRAPHIE_OB1_2026-09-05.md`, ecrite apres lecture du
code reel. Les regles 1 a 10 de la passation sont **deja decidees** : ne les
rediscute pas, applique-les.

## Regles de perimetre, valables pour tous les lots

- Branche `codex/lycee-connect-prototype` uniquement. **Jamais de `git push`.**
- Un commit local par lot. Verifie `git status` avant de commencer et
  **n'ecrase aucune modification qui n'est pas de toi** (le bruit CRLF sur
  `package-lock.json`, `supabase/config.toml` et les fichiers du brief hebdo
  est un artefact de fin de ligne, pas une modification : laisse-le).
- Migrations : jamais `--linked`, jamais `db push`, jamais une URL distante.
  Recette sur pile Supabase locale jetable uniquement.
- Aucune donnee reelle, aucun envoi, aucun drapeau active, aucun deploiement.
- Ne lis jamais `~/Documents/LyceeGest-DONNEES-PRIVEES` ni aucun `.env`.
- N'installe pas OB1, ne copie pas son schema, ne cree pas une seconde base,
  ne lui transmets rien.
- Si une preuve manque, ecris **non verifie**. N'invente pas un resultat.
- Compte rendu par lot dans `docs/operations/night-logs/OB1-LOT<n>.md`.

## LOT 1 — Migration additive et reversible

Ajouter a `public.knowledge_sources`, sans casser une ligne existante :

- `provenance_status text not null default 'imported'` contraint a
  `observed`, `inferred`, `user_confirmed`, `imported`, `generated`,
  `superseded`, `disputed`.
- `use_policy text not null default 'can_use_as_instruction'` contraint a
  `can_use_as_instruction`, `can_use_as_evidence`,
  `requires_human_confirmation`, `do_not_inject_automatically`.
- `superseded_by uuid` avec cle etrangere composite vers
  `(id, institution_id)`, auto-reference interdite.
- `review_comment text` borne en longueur, et `reviewed_by` / `reviewed_at`
  alignes sur la convention des autres tables.

Les defauts sont choisis pour que **le comportement actuel soit exactement
preserve** : toute source existante reste `imported` + instruction.

Contraintes a poser, pas a supposer :
- une source `superseded` **doit** porter un `superseded_by` ;
- une source non `superseded` **ne peut pas** en porter un ;
- `superseded_by` et le lien de remplacement sont **immuables** une fois
  poses (declencheur, comme le coffre) ;
- une source `generated` ou `inferred` ne peut **pas** avoir
  `use_policy = 'can_use_as_instruction'` : garantie par la contrainte, pas
  par la discipline de l'appelant. C'est la regle 2 rendue structurelle.

Ecrire la migration inverse dans le meme fichier (commentee) ou un fichier
`down` selon la convention du depot. RLS et privileges inchanges : verifier
apres coup qu'`anon` et `authenticated` n'ont gagne aucun droit.

Preuves : `supabase db reset` complet, insertion de chaque combinaison
interdite rejetee nommement, relecture `information_schema`.

## LOT 2 — Module pur de politique d'usage

`shared/knowledge-use-policy.ts`, sans base ni reseau, dans la meme famille que
`shared/public-agent-skill-policy.ts` — que tu **etends sans le reecrire**.

Une fonction unique decide, pour une source candidate et un acteur :
utilisable comme instruction, utilisable comme preuve citee, a confirmer par un
humain, ou jamais injectee. Elle retourne aussi **le motif** de la decision,
sous forme de code stable (pas une phrase), parce que le LOT 4 doit pouvoir
l'ecrire dans la trace.

Sont exclues sans condition : source expirée, `superseded`, `disputed`,
`do_not_inject_automatically`, hors etablissement, hors service, ou dont la
classification n'est pas sure pour cet acteur.

Tests purs : une decision par cas, y compris les combinaisons contradictoires.

## LOT 3 — Brancher le filtre serveur

Cabler le LOT 2 dans `sourceIsAuthorizedAndCurrent` et le chargeur
`api/_shared/public-knowledge-context.ts`, **cote serveur uniquement**.

Une source `can_use_as_evidence` doit atteindre le contexte comme **element
cite** (titre, date, statut), jamais comme consigne : la separation doit etre
visible dans le contexte transmis au modele, pas seulement dans un commentaire.

Ne touche a aucun outil du coffre de codes.

Preuve attendue : une source basculee en `can_use_as_evidence` cesse
d'apparaitre dans la partie instructions du contexte, et apparait dans la
partie preuves — verifie sur le contexte reellement construit, pas sur le code.

## LOT 4 — Trace de rappel

Etendre la trace existante (`agent_skill_audit`, action `consult_public`) — ne
cree pas une table concurrente sans avoir montre que celle-ci ne suffit pas.

Elle doit desormais porter, par rappel : les sources **proposees**, celles
**retenues**, celles **ecartees avec leur motif** (le code stable du LOT 2), la
version de chaque source retenue, et la politique qui a autorise l'usage.

Deux exigences non negociables :
- **la question n'est jamais stockee en clair** — le `sessionHash` actuel est
  la bonne pratique, conserve-la ;
- **aucune valeur sensible** (code, identifiant, donnee nominative) ne peut
  entrer dans la trace : prouve-le par un balayage, pas par une relecture.

Pose une duree de conservation minimale et documente-la.

## LOT 5 — File de validation et passage « publie -> connaissance »

Reutilise l'administration existante ; ne construis pas un second back-office.

- Une proposition de connaissance issue d'une discussion est **expurgee des
  donnees personnelles**, entre en file, et ne rejoint **jamais**
  automatiquement le contexte de reponse.
- Apres publication humaine d'une actualite, un responsable peut choisir
  « Rendre utilisable par l'agent » : cela cree une proposition liee au
  contenu source. **Une seconde validation** la rend utilisable.
- Une correction, un retrait ou une expiration retire immediatement l'ancienne
  version des resultats de recherche.
- Un brouillon Hebdo n'alimente jamais l'agent.
- Notification et connaissance restent deux decisions distinctes.

## LOT 6 — Heure de Paris et controles de fraicheur

- Le calcul de peremption et de journee utilise `Europe/Paris`, pas UTC.
  Corrige aussi le cron `15 2 * * *` en consequence.
- Controles de fraicheur a 08 h, 13 h et 18 h heure de Paris.
- Une publication declenche un controle supplementaire.

Note pour le meme lot, trouve pendant la verification du coffre : le quota
d'affichage du coffre compte la journee en UTC (`now.toISOString().slice(0,10)`
dans `recordVaultCodeDisplay`) et repart donc a 2 h du matin. Corrige-le ici,
c'est le meme defaut.

## LOT 7 — Tests adverses obligatoires

Un test par ligne, chacun doit **echouer** si la garantie saute :

1. une phrase dite dans un chat ne devient pas une consigne ;
2. une memoire generee par l'IA reste en attente ;
3. un brouillon Hebdo reste invisible pour l'agent ;
4. une information expiree ou remplacee n'est jamais rappelee ;
5. une source contestee est exclue ;
6. une source validee mais hors audience ou hors role est exclue ;
7. l'absence de source actuelle produit une reponse prudente et une
   orientation vers le bon formulaire ;
8. aucune donnee sensible dans une trace, un log ou un contexte de modele ;
9. deux requetes identiques ne creent pas de doublon ;
10. chaque reponse fondee sur la base conserve la reference et la version des
    sources utilisees.

Donnees fictives uniquement. Recette sur PostgreSQL local reel pour ceux qui
touchent la base.

## LOT 8 — Cloture honnete

Meme exigence que la cloture du coffre : lot par lot, ce qui est **reellement
prouve**, ce qui est **simule**, ce qui reste **a brancher**. Ne coche une
tache de `tasks.md` que si elle l'est vraiment. Termine par : fichiers
modifies, migrations ajoutees, tests executes et leurs resultats, limites
restantes, et l'ordre recommande pour la suite.

Avant de conclure : `tsc --noEmit`, `npx vite build`,
`npm run test:preview-security-gate`, `npm run test:spec-integrity`.
