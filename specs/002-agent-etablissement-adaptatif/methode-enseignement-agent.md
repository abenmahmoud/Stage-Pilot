# Methode d'evolution de l'agent

## Principe retenu

L'agent n'est pas entraine sur les conversations ou sur une copie brute des
donnees du lycee. Il progresse par un cycle controle compose de trois briques :

1. **Connaissances versionnees** : procedures, informations et documents dont la
   source, le responsable, la date et le public autorise sont connus.
2. **Regles stables** : charte, niveaux d'identite, autorite d'action et limites
   de confidentialite applicables avant tout appel au modele.
3. **Outils limites** : recherche exacte dans le repertoire prive, lecture d'un
   emploi du temps autorise, creation d'une demande ou proposition de reponse.

Une correction devient durable uniquement apres ajout d'un cas de test, revue
humaine et publication d'une nouvelle version de connaissance ou de competence.

## Sources separees

- Le repertoire des personnes prouve une identite ou une relation. Il n'est
  jamais injecte dans le contexte du modele et n'est pas interroge par nom libre.
- Les documents administratifs generaux alimentent le registre de connaissances
  apres controle antivirus, classification et validation.
- Les codes, mots de passe et secrets d'activation sont refuses. Une remise de
  code future utilise un coffre et une validation humaine distincts.
- Les systemes officiels restent la source de leurs domaines. Une copie datee ne
  doit jamais etre presentee comme une synchronisation en temps reel.

## Cycle de travail

1. Importer ou mettre a jour une source dans son espace dedie.
2. Controler sa provenance, sa date, sa classification et son proprietaire.
3. Associer la source a une competence et a des outils autorises.
4. Tester les cas positif, ambigu, absent, interdit et source perimee avec des
   donnees fictives.
5. Publier apres revue, mesurer les corrections humaines et versionner la regle
   suivante sans reutiliser les conversations brutes.

## Arbitrage du document fourni

La separation `connaissances + consignes + outils` et le cycle
`mettre a jour + tester + corriger` sont retenus. Ne sont pas retenus : charger
le fichier SQLite complet dans l'IA, rechercher librement une personne par nom,
donner directement un code de premiere connexion ou considerer la coherence
d'une demande comme une preuve d'identite.
