# Reponse a un incident LyceeGest

**Statut** : contrat de preview, non active en production  
**Perimetre** : portail public, guichet, console agent, base, fichiers, identite et notifications

## 1. Regles absolues

- Ne jamais restaurer directement dans la base ou le stockage actifs.
- Ne jamais supprimer une file d'echec, un journal ou une preuve pour retablir le service.
- Ne jamais contourner le MFA, les politiques RLS, la quarantaine antivirus ou une validation humaine.
- Ne jamais placer de mot de passe, jeton, code ENT, contenu de dossier, coordonnee ou document dans le compte rendu d'incident.
- Ne jamais annoncer un retour normal avant les controles de reouverture.
- Ne jamais envoyer une communication collective sans validation explicite de la direction.

Une preuve locale ou fictive ne prouve pas qu'une sauvegarde distante est restaurable. La production reste interdite tant que les responsables, la conservation, les alertes et la restauration distante ne sont pas valides.

## 2. Niveaux de gravite

| Niveau | Situation | Decision minimale |
| --- | --- | --- |
| S0 | Signal sans impact confirme | Surveiller et documenter le signal. |
| S1 | Fonction degradee avec solution de repli | Isoler la fonction et suivre le retour normal. |
| S2 | Service indisponible, file bloquee ou doute sur l'integrite | Suspendre les ecritures concernees et prevenir la direction. |
| S3 | Suspicion de fuite, acces indu, secret expose ou alteration | Contenir immediatement, conserver les preuves et saisir direction et DPO. |

Une personne habilitee confirme le niveau. L'application ne declenche seule ni restauration, ni purge, ni communication externe.

## 3. Roles avant pilote

Les personnes nominatives restent a designer par la direction. Avant tout pilote, le registre d'exploitation doit identifier :

- le coordinateur d'incident, qui tient la chronologie et autorise les etapes ;
- l'operateur technique, qui execute seulement les actions autorisees ;
- le responsable metier du service touche, qui verifie le fonctionnement ;
- le validateur de communication, qui approuve chaque message collectif ;
- le contact DPO, sollicite pour toute donnee personnelle ou suspicion de violation.

Une meme personne ne doit pas executer et valider seule une restauration ou une bascule.

## 4. Cycle obligatoire

### Detecter et declarer

1. Noter l'heure UTC, la surface touchee, le symptome et le premier signal.
2. Relever le commit, le deploiement, les migrations et les identifiants techniques deja disponibles.
3. Utiliser uniquement des compteurs agreges dans le premier compte rendu.
4. Ouvrir une chronologie sans recopier de conversation, coordonnee ou piece jointe.

### Contenir sans detruire

1. Suspendre seulement la fonction touchee avec le mecanisme deja autorise.
2. Laisser les travaux en echec et les fichiers en quarantaine dans leur etat auditable.
3. Preserver les journaux et empecher les nouvelles actions susceptibles d'aggraver l'incident.
4. Conserver les parcours de repli sans promettre une livraison ou une restauration.

### Diagnostiquer

1. Comparer le dernier etat sain au commit et aux migrations deployes.
2. Verifier les erreurs bornees et les compteurs, jamais le contenu prive inutile.
3. Reproduire uniquement avec des donnees fictives dans un environnement isole.
4. Classer la cause comme applicative, infrastructure, fournisseur, securite ou inconnue.

### Decider et restaurer

1. Faire valider la decision par le coordinateur et le responsable metier.
2. En cas de restauration, verifier le manifeste et l'authenticite avant toute ecriture.
3. Restaurer d'abord vers une cible vide, isolee et non routable vers les usagers.
4. Comparer compteurs, empreintes et relations attendues sans exposer les donnees.
5. Conserver la cible active intacte jusqu'a une decision ecrite distincte.

### Reouvrir progressivement

1. Lecture publique et pages statiques.
2. Creation et suivi d'une demande fictive.
3. Console agent avec compte nominatif et MFA.
4. Pieces jointes, quarantaine et journal d'acces.
5. Files de notifications sans fournisseur reel, puis fournisseur seulement apres autorisation.
6. Verification metier, mobile, accessibilite, erreurs et compteurs avant annonce.

### Clore et apprendre

1. Noter l'heure de retour, les controles executes et la personne qui les a valides.
2. Conserver la chronologie, les preuves techniques minimales et les decisions.
3. Creer les actions correctives avec responsable et echeance.
4. Enregistrer un retour d'experience sans donnee personnelle inutile.

## 5. Matrice par surface

| Surface | Contention initiale | Preuve minimale | Condition de reouverture |
| --- | --- | --- | --- |
| Site public | Garder les ecritures et fonctions sensibles fermees. | Statuts HTTP, deploiement, commit et heure. | Pages prioritaires, anciennes adresses et en-tetes verifies. |
| API du guichet | Suspendre la mutation touchee, pas toute la lecture. | Route, statut, identifiant de requete et compteurs agreges. | Creation, rejeu idempotent et suivi fictif verifies. |
| Base de donnees | Arreter les nouvelles ecritures du perimetre douteux. | Version de migration, compteurs et controle d'integrite. | Cible isolee restauree et validation metier obtenue. |
| Pieces jointes | Maintenir la quarantaine et couper la liberation. | Etat antivirus, nombre de travaux et empreintes techniques. | Scan, acces temporaire et journal d'acces verifies. |
| Notifications | Conserver la file et desactiver le transport touche. | Taille de file, tentatives, recus opaques et erreurs bornees. | Rejeu fictif sans doublon puis livraison autorisee confirmee. |
| Identite et acces | Revoquer la session concernee et maintenir le MFA. | Evenement d'acces minimal, role, niveau et heure. | Cloisonnement, MFA et recuperation nominative revalides. |

## 6. Preuves et compte rendu

Le dossier d'incident peut contenir : heures UTC, commit, deploiement, versions de migration, routes, statuts, compteurs agreges, identifiants techniques opaques, decisions, validateurs et resultats de tests.

Il exclut : mots de passe, codes, jetons, emails personnels, numeros de telephone, noms d'eleves, conversations, documents, chemins signes et corps d'erreur fournisseur. Un besoin d'analyse de contenu prive suit une procedure d'acces separee, justifiee et journalisee.

## 7. Verification locale sans action distante

```powershell
npm run test:support-operations
npm run test:support-resilience
npm run test:recovery-sample-bundle
npm run test:migration-integrity
npm run build
```

Ces commandes valident le code et des donnees fictives. Elles n'activent pas une alerte, une sauvegarde programmee, une restauration distante, un fournisseur ou la production.

## 8. Portes encore humaines

T057 reste ouverte jusqu'a la designation des responsables, la validation DPO, la configuration des alertes, la sauvegarde programmee de la base et du stockage, puis une restauration autorisee dans une cible distante isolee. Le present runbook ne donne aucun accord implicite pour ces operations.
