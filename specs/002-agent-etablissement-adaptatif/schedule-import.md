# Import prive des emplois du temps

## Sources examinees

Les deux exports dates du 25 aout 2026 ont ete examines localement :

- 102 pages pour les emplois du temps des professeurs ;
- 45 pages pour les emplois du temps des classes ;
- une grille hebdomadaire par page, avec cours, groupes, salles et alternances ;
- plusieurs groupes simultanes peuvent partager un meme creneau.

Aucun nom, horaire individuel ou contenu des PDF n'est ajoute a Git, aux
specifications ou a la preview.

## Decision proportionnee

L'extraction de texte brute n'est pas assez fiable pour transformer directement
toutes les grilles en creneaux : les colonnes de groupes se chevauchent dans le
PDF. La premiere version doit donc privilegier la preuve et la recherche rapide,
pas une reponse automatique incertaine.

1. Televerser le PDF dans un stockage prive reserve aux agents.
2. Enregistrer son empreinte, sa date d'effet, son type et son numero de version.
3. Indexer chaque page vers une classe ou un professeur apres controle humain.
4. Permettre a l'agent d'ouvrir la bonne page par un lien temporaire.
5. N'activer une nouvelle version qu'apres validation, en conservant la version
   precedente pour un retour arriere.
6. Ajouter la lecture detaillee des creneaux seulement apres constitution d'un
   jeu de controle et mesure du taux d'erreur.

## Regles de reponse de l'agent

- Ne jamais rendre public l'emploi du temps complet d'un professeur.
- Ne repondre qu'a la personne et au besoin autorises.
- Afficher la date de la source et signaler qu'un emploi du temps peut changer.
- En cas de doute, montrer la page source a l'agent humain au lieu d'inventer un
  horaire, une salle ou un professeur.
- PRONOTE ou l'outil officiel reste prioritaire lorsqu'une integration autorisee
  et plus recente est disponible.

## Autorisation restante

La lecture locale autorise la conception de ce flux. Elle n'autorise pas encore
l'import des PDF reels dans Supabase, Vercel, le VPS ou un autre service. Cette
action devra nommer la cible, la duree de conservation et les agents habilites.
