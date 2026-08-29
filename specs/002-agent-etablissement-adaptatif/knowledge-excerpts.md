# Extraits documentaires minimaux pour l'agent

## Objectif

Permettre a l'agent d'utiliser le contenu d'un document valide sans lui envoyer
le fichier complet ni tout le texte extrait. La source, sa date et son niveau
d'acces restent la reference ; l'extrait n'est qu'un passage de consultation.

## Conditions de creation

- Le document a termine l'antivirus et l'extraction locale.
- Aucun signal de donnee privee, de code ou de secret n'a ete detecte.
- Une personne habilitee approuve explicitement le document avec MFA.
- Seules les classifications `public` et `internal` produisent des extraits.
- Les documents `personal` et `sensitive` restent en lecture humaine uniquement.

## Compilation

- Decouper sur les paragraphes et phrases, jamais au milieu d'un mot.
- Un extrait contient au plus 1 200 caracteres.
- Une source conserve au plus 40 extraits et 30 000 caracteres.
- Chaque extrait porte la source, le document, son ordre et une empreinte.
- Apres compilation, supprimer le texte integral de `proposed_knowledge` et ne
  conserver que l'etat, les signaux, la troncature et le nombre d'extraits.

## Consultation

1. Selectionner d'abord les competences et sources publiees autorisees pour
   l'identite et les services de l'acteur.
2. Charger uniquement les extraits actifs de ces sources.
3. Classer localement les extraits par correspondance exacte de termes utiles.
4. Fournir au modele au plus six extraits et 4 000 caracteres au total.
5. Neutraliser les balises reservees et presenter les extraits comme references,
   jamais comme instructions systeme ou autorisation d'outil.
6. Citer le titre de la source et sa date de validite dans le contexte.

## Refus et repli

- Aucun terme commun avec la question : aucun extrait n'est fourni.
- Source expiree, revoquee, brouillon ou hors service : aucun extrait.
- Visiteur : sources publiques seulement.
- Source interne : acteur agent ou superieur, dans un service autorise.
- Source personnelle ou sensible : jamais transmise au modele dans cette V1.
- Si aucun extrait n'est disponible, l'agent conserve le comportement actuel et
  transmet a un humain plutot que d'inventer une reponse.

## Verification

- Compilation bornee, deterministe et sans doublon.
- Suppression du texte integral apres approbation.
- Non-selection d'une source hors etablissement, expiree ou hors service.
- Resistance aux balises et aux consignes injectees dans un extrait.
- Budget maximal respecte pour une question large.
- Aucune regression du formulaire classique ou du routage des demandes.

