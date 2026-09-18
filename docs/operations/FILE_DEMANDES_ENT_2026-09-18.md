# File des demandes ENT — 18 septembre 2026

## Constat vérifié

La console connectée affiche 47 demandes sur 30 jours, 46 encore ouvertes,
26 à attribuer et 4 doublons possibles. Les catégories les plus fréquentes sont
ENT/PRONOTE (24), messagerie académique (6), classe/affectation (5) et
restauration (4). Les mesures techniques montrent 251 conversations en 7 jours,
dont 164 réponses IA retenues. Une réponse retenue n'est pas une résolution :
une seule demande est marquée résolue. L'envoi de notifications est opérationnel
au relevé (9 envois réussis, aucun essai en échec sur 24 h).

Deux dossiers ENT consultés dans la console n'ont pas de lien d'identité vers
l'annuaire actif. La proposition agent renvoyait alors vers un **nouveau chat**
pour y retrouver l'accès ENT. Cette transition risquait de produire un second
dossier, alors que les données de l'export du 17 septembre sont déjà chargées.
Il ne faut ni attribuer ces anciens dossiers par ressemblance de nom, ni envoyer
un identifiant ou un code sans nouvelle preuve d'identité.

## Correction

Dans « Mes demandes », un dossier ENT propose maintenant « Retrouver mon accès
ENT ». La personne confirme son identité avec l'OTP sur un contact connu du
lycée, puis la carte sécurisée lit exclusivement **son propre compte** dans
l'annuaire actif. Le code initial n'est affiché que pour un compte indiqué comme
non activé, si une attribution valide existe et que les contrôles du coffre
l'autorisent. Une erreur de coordonnées ou d'accès se poursuit dans **le même
dossier**. Les brouillons proposés aux agents indiquent désormais ce parcours,
sans recommander un nouveau chat.

Ce correctif ne rattache pas automatiquement les 47 dossiers à des identités,
ne les ferme pas et n'envoie aucune réponse aux familles. Les demandes qui
nécessitent une modification de coordonnées, un nouveau code, un document
officiel ou une décision restent à traiter par un agent habilité. Un nouvel
export ENT est utile seulement si des comptes/coordonnées/états d'activation ont
changé depuis le 17 septembre ; il ne résout pas à lui seul l'absence de lien
d'identité sur les anciennes demandes.

## Suite du 18 septembre — résolution par le demandeur

Une personne qui ouvre **son propre dossier** peut désormais confirmer « Oui,
c’est réglé ». Cette action journalisée retire le dossier de la file ouverte,
sans prétendre que la simple consultation du code ou de l'emploi du temps a
résolu le problème. Si elle écrit ensuite dans le même fil, le dossier résolu
repasse en cours et la notification agent reprend. Aucune donnée du coffre n'est
mise dans un email ou dans le journal de résolution.

La proposition de réponse dans la gestion reconnaît maintenant la catégorie ENT
même lorsque le dernier message ne répète pas « ENT ». Les demandes d'emploi du
temps et d'accès à PRONOTE ont des brouillons dédiés, limités aux procédures
publiques et au parcours personnel après vérification. La cantine reste
exclue du brouillon ENT. Ces textes doivent encore être relus et envoyés par
un agent ; ils ne déclenchent pas de campagne vers les 47 demandeurs.

Les dossiers historiques restent ouverts tant que le demandeur ou l'équipe ne
les clôt pas. La reprise collective nécessitera un message ciblé et validé
avant tout envoi réel, puis un contrôle des retours et des cas qui exigent une
intervention humaine.

## Recette et suivi

- Contrôler `npm run test:support-reply-suggestion`, `npm run test:agent-ai-budget`,
  `npx tsc --noEmit`, `npm run build` et le gate sécurité avant publication.
- Après publication, ouvrir un dossier ENT existant avec un compte de test
  autorisé : vérification OTP, affichage de l'identifiant personnel, absence de
  nouveau dossier, et reprise dans le même fil si l'accès manque.
- Ne jamais utiliser les codes réels, les OTP ou une correspondance nominale
  approximative pour une recette automatisée.
