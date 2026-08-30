# Extraction locale des présentations PPTX

## Objectif

Permettre au superadministrateur de déposer une présentation institutionnelle
sans transmettre le fichier à un service externe. Le worker traite uniquement
les XML de texte des diapositives et des notes après le contrôle antivirus.

## Limites

- archive bureautique : 2 000 entrées et 200 Mo décompressés au maximum ;
- présentation : 300 diapositives et 300 pages de notes au maximum ;
- XML : 5 Mo par entrée et 40 Mo cumulés ;
- texte conservé : 120 000 caractères au maximum ;
- aucune image, vidéo, macro, objet incorporé ou OCR n'est interprété.

## Refus fermés

Le worker refuse les archives chiffrées, une fausse structure PPTX, les entrées
de texte dupliquées, les XML invalides, les déclarations `DOCTYPE` ou `ENTITY`
et tout dépassement de limite. Le message d'erreur ne contient pas le texte du
document.

Après extraction, une coordonnée, un secret ou une instruction visant à modifier
le comportement de l'agent supprime le texte proposé et impose une relecture
humaine. Une extraction propre reste un brouillon : elle ne publie jamais seule
une source ou une compétence.
