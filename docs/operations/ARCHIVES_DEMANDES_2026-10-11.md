# Archives de la file de demandes — 11 octobre 2026

Adel demande de ne conserver pour le traitement du soir que les demandes de la
semaine du 5 au 11 octobre, les salles et le matériel restant dans le suivi SPIE.
L’archivage est administratif et réversible : aucun dossier n’est supprimé,
résolu, clos ou déclaré indésirable par cette opération.

## Fonctionnement

- La file normale et ses compteurs excluent les archives et le matériel SPIE.
- Le filtre Matériel du lycée / SPIE conserve son périmètre explicite.
- Archives permet de consulter les anciens dossiers. Toutes inclut les archives
  du périmètre choisi. Les statuts initiaux restent consultables.
- Archiver / Sortir des archives utilise une route authentifiée et le périmètre
  existant de l’agent, une transaction avec verrou et contrôle de révision, puis
  un événement audité. Aucun élargissement d’accès ni contrôle d’identité modifié.
- Un nouveau message entrant après le dernier archivage réintègre le dossier
  dans la file. Un envoi sortant ne suffit pas à le réintégrer.
- Seul un événement serveur d’archivage peut masquer un dossier. Le contexte
  fourni par un visiteur ne peut pas le faire disparaître.
- Aucun email, SMS ou push n’est déclenché par l’archivage.

## Lot demandé

Avant opération : 79 dossiers, dont 7 matériel SPIE, 7 créés entre le 5 et le
11 octobre et 65 anciens dossiers hors SPIE. Le dernier message entrant des
65 anciens dossiers est également antérieur au 5 octobre, minuit à Paris.
Trois dossiers déjà terminés conservent leur statut. Aucune réparation SPIE
n’est supposée à partir du calendrier des passages.

L’opération groupée doit verrouiller la sélection, refuser tout écart au nombre
attendu et enregistrer un événement `request.archived` pour chaque ligne. Acteur
`system`, sans identité humaine fabriquée, motif explicite de l’instruction dans
le chat, corrélation commune et informations de retour arrière. Contrôler après
opération les 65 archives, les 7 demandes récentes, les 7 SPIE inchangés, les
statuts, pièces, messages et files d’envoi. Les preuves opérationnelles restent
dans les sorties locales privées, hors Git.

## Validation

Compilation TypeScript et Vite réussie. Contrats de file (9 tests), filtres
d’entrée (9 tests), isolation établissement (7 tests), politique d’archive et
requête PostgreSQL sur cinq cas fictifs réussis : archive, nouveau message,
restauration, absence d’archive, matériel. Recette distante et résultat du lot à
consigner séparément après confirmation, sans annoncer une publication anticipée.
