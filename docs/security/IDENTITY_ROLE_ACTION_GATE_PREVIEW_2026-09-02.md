# Matrice identite-role-action - preuve preview du 2 septembre 2026

## Perimetre

Cette verification concerne le contexte transmis a l'IA, les outils de l'agent,
les identites scolaires, les relations, les adhesions et leurs protections de
base. Elle utilise uniquement le code, des objets fictifs et la branche Supabase
de preview `xijocumlwivhbmffrnlj`.

Aucune donnee reelle, production, DNS, VPS, Webmail, ENT, PRONOTE ou emission de
message n'est utilisee.

## Corrections

- La decision commune `authorizeIdentityRoleAction` controle maintenant
  etablissement, niveau d'identite, role, service, relation et MFA. La matrice
  institutionnelle, la selection des connaissances avant l'appel au modele et
  la politique de chaque outil l'utilisent.
- L'acteur de connaissances ne deduit plus `I3` des anciennes tables eleves ou
  professeurs. Il exige une seule `school_identity`, dans le bon etablissement,
  issue d'un import actif, non revoquee, horodatee et correctement verifiee.
  Les roles eleve, responsable legal et personnel restent distincts.
- Les quatre suites centrales sont rattachees a la barriere adversariale, donc
  a la barriere de securite de preview.

## Preuves

- Les 58 tests centraux passent : 9 frontieres adversariales, 14 decisions
  d'acces, 11 acteurs de connaissances, 13 contextes de competence avant IA et
  11 politiques d'outils.
- Les tests de l'outil `support.create_request`, du lecteur d'emploi du temps,
  des sources et de la politique de conversation passent egalement.
- `npm run build` et `npm run test:preview-security-gate` passent.
- Le commit technique `b012366a707dbe1fd196f79a4c5e22b86b503dc7`
  est `READY` sur le deploiement Vercel de preview
  `dpl_CjamgEvHEZAP25fjJbGy3LrTyZ9o`, avec `target=null`.
- Un controle direct du catalogue de la branche Supabase confirme 10 tables sur
  10 presentes, 10 avec RLS activee et forcee, zero privilege client et les 10
  tables lisibles par le role serveur attendu.
- Le seul outil activable passe par une competence publiee, la matrice commune,
  un schema ferme, une empreinte exacte, une transaction et une confirmation
  liee. Les branches identite, role, service, relation, MFA et A3 sont couvertes
  par la politique, meme si aucun outil sensible n'est active dans la preview.

## Revue independante

Claude Fable 5 a effectue un seul passage en lecture seule, sans reseau, secret
ni donnee personnelle. Cout constate : 3,804796 USD, sous le plafond autorise de
5 USD. Deux constats ont ete confirmes puis corriges : l'identite pre-IA encore
adossee aux anciennes tables et la duplication des gardes autour d'une matrice
centrale non branchee.

Son observation sur l'absence de preuve RLS reelle dans le seul perimetre de
fichiers transmis est levee par le controle direct du catalogue Supabase. Son
observation sur l'absence d'outil sensible actif reste une limite de perimetre,
pas un contournement : tout outil futur doit passer par la politique commune et
les niveaux A3/A4 restent fermes selon leurs regles.

## Conclusion

Les exigences techniques de `002/T015B` sont prouvees sur la preview. Comme
`T015A`, `T015B1` et `T015B2` etaient deja terminees, le parent `002/T015` peut
etre clos. Les comptes reels, decisions metier, integrations et production
restent dans leurs taches distinctes.
