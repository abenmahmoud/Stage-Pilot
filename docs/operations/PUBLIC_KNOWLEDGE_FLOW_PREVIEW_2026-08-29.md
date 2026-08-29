# Recette des connaissances publiques en preview

## Perimetre

La recette du 29 aout 2026 a cible uniquement :

- la branche Supabase `guichet-lycee-preview` ;
- la preview Vercel protegee de `codex/lycee-connect-prototype` ;
- une procedure ENT entierement fictive et marquee `[TEST]`.

Aucune personne, liste, piece jointe ou information reelle du lycee n'a ete
utilisee. La production, le domaine public, Hostinger, le VPS, PRONOTE et l'ENT
n'ont pas ete modifies.

## Defaut corrige

Le serveur ecrivait un evenement `consult_public` apres une reponse IA reussie,
mais l'ancienne contrainte SQL refusait cette action. L'erreur etait absorbee
afin de ne pas masquer la reponse sure a l'utilisateur.

La migration `20260829103209_allow_public_knowledge_usage_audit.sql` aligne la
base avec le contrat applicatif. Le test unitaire verifie a la fois le code et la
migration.

## Chaine verifiee

1. Creation temporaire d'une source publique fictive et datee.
2. Liaison a un document fictif, un extrait borne et une competence publiee.
3. Evaluation positive fictive puis activation temporaire de la competence.
4. Appel de `/api/support/assistant` sur la preview Vercel protegee.
5. Selection de la competence et de l'extrait, puis reponse IA classee `ent`.
6. Ecriture de deux audits `consult_public`, un pour la version et un pour la
   source.
7. Verification SQL des quatre seules cles d'audit : `channel`, `sessionHash`,
   `model` et `turnCount`.
8. Suppression exacte des ressources creees et verification du retour a zero.

## Garde-fous

- La recette locale refuse toute `DATABASE_URL` qui ne contient pas la reference
  de la branche Supabase de preview.
- Le modele n'a recu ni URI, checksum, fichier brut, liste nominative ou donnee
  personnelle.
- Les secrets Vercel non exportables n'ont pas ete copies sur le poste. L'appel
  distant a utilise un acces temporaire a la preview protegee.
- Le test n'active aucune competence reelle et ne laisse aucune connaissance de
  demonstration dans la base.
