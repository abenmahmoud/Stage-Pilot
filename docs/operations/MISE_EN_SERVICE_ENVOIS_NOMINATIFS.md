# Envois nominatifs — dossier de mise en service

Préparé le 3 septembre 2026. **Rien n'est déclenché.** Ce document décrit ce
qu'il faudrait décider pour un premier envoi réel, et ce qui manque encore.

## 1. Ce qui est utilisable aujourd'hui

- Les règles de fusion, de lot et de mode d'envoi : écrites, testées, 42 tests
  verts (`npm run test:nominatif`, `npm run test:agent-context-window`).
- Le parcours administratif `/admin/envois-nominatifs`, en simulation locale
  sur le jeu d'essai fictif : import, colonnes, bilan, aperçu par destinataire,
  lot figé.
- Les corrections de l'agent : fenêtre de conversation alignée sur ce que
  l'interface accepte, recherche documentaire contextualisée, questions arabes
  qui atteignent enfin les concepts français.

## 2. Ce qui est simulé, et le restera tant que T041 n'est pas faite

Le parcours calcule aujourd'hui ses empreintes dans le navigateur et lit un
répertoire fictif embarqué. Aucun appel serveur, aucune écriture, aucune mise
en file. C'est volontaire : cela permet de montrer et de valider le parcours
sans exposer une seule donnée réelle.

## 3. Ce qui reste à brancher (T041, T042)

1. **Route d'import privée.** Le fichier réel ne doit ni transiter par le
   contexte d'un modèle, ni être committé. Le modèle existant est
   `identity_directory_imports` + `identity_directory_private_rows` : import
   réservé, lignes chiffrées par bénéficiaire, activation séparée.
2. **Stockage des valeurs par bénéficiaire** : référence stable, source, année,
   version, état. Une valeur révoquée reste tracée, elle ne disparaît pas.
3. **Construction de l'ordre Webmail** à partir de la fusion nominative. Bonne
   nouvelle : le contrat signé existant porte déjà `subject`, `preheader` et
   `bodyText` **par livraison**. Aucune extension du contrat n'est nécessaire —
   il suffit de le remplir avec le message fusionné au lieu d'un corps commun.
4. **Recette sur PostgreSQL réel jetable** : deux livraisons vers la même
   adresse coexistent bien en base ; l'import rejoué n'en crée pas de
   troisième ; une interruption entre mise en file et reçu laisse un état
   « résultat à vérifier » rapprochable.

## 4. Ce que l'administration devra décider, sur un lot concret

Aucune de ces cases ne peut être remplie par le développement :

| Décision | À préciser |
| --- | --- |
| Cible exacte | Quel établissement, quelle base. |
| Fichier et version | Quel fichier de cantine, quelle date, quelle année scolaire. |
| Public | Élèves concernés, ou classes, ou niveau. |
| Modèle | Le texte exact reçu par les familles. |
| Nombre prêt | Recalculé depuis le fichier réel, pas repris de l'ancien document. |
| Exclusions | Combien, pour quels motifs, et qui les traite. |
| Canal de repli | Qui remet l'information aux familles sans contact utilisable. |

Les effectifs de l'ancien document — 1 256 badges, 1 083 annoncés rapprochés,
173 à vérifier — sont **indicatifs**. Ils ne sont pas des destinataires prêts.
Le nombre réel sortira du bilan d'import sur le fichier retenu.

## 5. Les drapeaux, et l'ordre dans lequel les ouvrir

Tous fermés aujourd'hui. Aucun ne sera ouvert sans demande explicite.

| Drapeau | Effet | Quand |
| --- | --- | --- |
| `VITE_NOMINATIVE_SEND_UI_ENABLED` | Fait apparaître l'entrée de menu. | Quand le référent doit y accéder sans connaître l'adresse. |
| `COMMUNICATIONS_ENABLED` | Ouvre le module de communications côté serveur. | Déjà nécessaire au centre de communications. |
| `COMMUNICATION_SEND_ENABLED` | Autorise l'appel réel au prestataire. | **En dernier**, et seulement après un lot approuvé sur données réelles. |

La simulation ne dépend d'aucun de ces drapeaux : elle est utilisable
immédiatement, y compris pour former le référent.

## 6. Le premier envoi réel, quand il viendra

1. Import du fichier réel par la route privée.
2. Lecture du bilan, traitement des ambigus et des contacts absents.
3. Choix du modèle, relecture de trois messages au hasard.
4. « M'envoyer un exemple » vers une adresse de test choisie.
5. Validation du lot : contenu et périmètre figés.
6. Revérification automatique juste avant l'envoi — révocations, contacts
   inactifs, valeurs modifiées. Un lot devenu inapplicable repasse par la
   vérification.
7. Envoi, puis suivi : simulé / en attente / transmis / livré / échec /
   résultat à vérifier. Renvoi possible sur les seuls échecs avérés.
