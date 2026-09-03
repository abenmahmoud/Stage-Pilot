# Envois nominatifs — guide court

Pour le référent numérique. Cinq écrans, dix minutes, aucun message envoyé
tant que l'administration n'a pas ouvert l'envoi.

Adresse : `/admin/envois-nominatifs`.

## Ce que fait ce parcours

Un message par élève, contenant **uniquement sa propre information**. Deux
enfants d'un même parent reçoivent deux messages distincts à la même adresse,
chacun avec sa valeur. C'est la différence avec une communication de groupe.

## Les cinq étapes

**1. Importer.** Un fichier CSV, ou le jeu d'essai fictif pour se faire la main.
Le fichier est lu dans le navigateur ; rien ne part à ce stade.

**2. Confirmer les colonnes.** Les colonnes évidentes sont préremplies. Une
question ne l'est jamais : *que permet cette valeur ?* Un numéro de badge ne
permet rien tout seul — il passe. Un code d'accès ou d'activation ouvre un
service — il ne passe pas par la diffusion, il relève du coffre de remise de
codes. Le titre de la colonne ne décide pas ; vous décidez.

**3. Lire le bilan.** Sept situations :

| État | Ce que ça veut dire |
| --- | --- |
| Prêt | La ligne partira dans le lot. |
| Valeur manquante | La colonne valeur est vide pour cette personne. |
| Rapprochement absent | Personne ne correspond dans le répertoire. |
| Rapprochement ambigu | Plusieurs personnes correspondent. Le système ne choisit pas. |
| Doublon dans le fichier | La personne apparaît déjà plus haut. |
| Contact absent | Aucun contact utilisable : remise par un autre canal. |
| Contact révoqué | Le contact ne peut plus être utilisé. |

Les homonymes de la même classe sortent en « ambigu » **exprès**. Les noms et
la classe servent à vérifier un rapprochement, jamais à en décider un quand il
reste un doute.

**4. Voir chaque message.** Un onglet par destinataire, avec le texte exact qui
partirait. C'est le moment de vérifier qu'un `0042` est bien resté `0042` et
non `42`.

**5. Valider le lot.** Le lot est figé : source, année, modèle, lignes et
exclusions. Vous validez le **contenu et le périmètre**, pas chaque message un
par un. Les lignes exclues restent visibles et pourront former un lot
complémentaire.

## Ce qui est protégé, et comment

- **Une valeur ne peut pas partir chez quelqu'un d'autre.** La fusion vérifie
  que la valeur appartient au bénéficiaire de la livraison, sinon elle échoue.
- **Un message ne peut pas partir avec un `{{marqueur}}` visible.** Une variable
  sans valeur bloque la ligne avant la mise en file.
- **Un lot approuvé ne se met pas à jour tout seul.** Si une valeur, un contact
  ou le modèle change, le lot redevient à vérifier.
- **La simulation n'appelle jamais le prestataire.** Zéro requête, garanti par
  le code et par un test, pas par une consigne.
- **Une réponse incomplète du prestataire n'est jamais un succès.** Sans
  identifiant de message, l'état est « résultat à vérifier », et le renvoi est
  interdit tant que les reçus ne sont pas rapprochés.

## Les trois modes d'envoi

| Mode | Ce qu'il touche | Ce qu'il exige |
| --- | --- | --- |
| Simulation | Rien. Données fictives. | Rien. Toujours disponible. |
| M'envoyer un exemple | Une adresse de test que vous choisissez. Contenu fictif. | Envoi ouvert + adresse choisie. |
| Envoi du lot | Les contacts autorisés du lot approuvé. | Envoi ouvert + lot approuvé et encore applicable. |

## Ce que ce parcours ne fait pas encore

L'écran fonctionne aujourd'hui en simulation locale, sur le jeu d'essai fictif.
Le raccordement au serveur — import privé, stockage chiffré des valeurs, mise
en file réelle — est la tâche T041 de la spec 005. Les règles ci-dessus sont
déjà écrites et testées : c'est le branchement qui reste, pas les garanties.
