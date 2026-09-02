# Acces public au pilote LyceeGest - 2 septembre 2026

## Adresse partageable

Le pilote valide sur la base Supabase de preview est accessible sans compte
Vercel a l'adresse suivante :

`https://lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app/prototype`

Le deploiement immuable correspondant est
`dpl_EZCRLdHUdVo6oNWd4AhruDDr96Pa`, en etat `READY`, region `cdg1` et commit
`d898a45159e30192eb99ba86f51f2c2788037fa1`. Les seuls changements de ce
commit par rapport au code teste sont documentaires.

## Verification anonyme

Apres retrait de la protection SSO Vercel sur le projet `lyceegest` :

- `/` et `/prototype` repondent `200` sans cookie ni compte Vercel ;
- `/api/content/public` repond `200` ;
- `/api/support/requests` en lecture repond `200` ;
- `/api/support/assistant` repond `200` a un scenario ENT fictif, utilise l'IA,
  classe la demande `ent`, propose un dossier et conserve neuf tours ;
- `/api/support/agent/requests`, `/api/content/admin` et
  `/api/communications/admin` refusent l'anonyme en `401` ;
- l'accueil a ete ouvert dans un navigateur vierge et affiche l'assistant,
  le Webmail, les acces rapides, les specialites et LyceeGest.

Le parcours de creation, persistance, suivi sur le meme appareil et nettoyage
d'une demande fictive avait deja ete valide sur la meme version applicative et
la meme base a 93 migrations. Voir
`LYCEEGEST_PREVIEW_93_MIGRATIONS_SUPPORT_E2E_2026-09-02.md`.

## Frontieres maintenues

- La base Supabase de production `sfqhxiamhgsbbogluqtq`, encore a trois
  migrations, n'a pas ete modifiee.
- Aucun DNS, domaine Hostinger, VPS, Webmail ou envoi d'email n'a ete modifie.
- Les pages et API agents restent protegees par l'authentification applicative,
  les habilitations institutionnelles et le MFA.
- La protection SSO est desactivee pour les previews du projet `lyceegest` afin
  que le pilote soit partageable. Il faut la retablir apres attribution d'un
  domaine public dedie ou apres fin de la phase pilote.

## Tentative isolee non retenue

Le projet Vercel `lyceegest-blaise-cendrars` a ete cree pour tenter une adresse
publique totalement isolee. Vercel ne permet pas de recopier les valeurs de
secrets deja masques : ses API serveur repondaient donc `500`. Cette adresse ne
doit pas etre partagee. Sa protection SSO a ete reactivee et aucun deploiement
de ce projet ne pointe vers la production historique.

