# Traitement des demandes — 23 septembre 2026

## Constat sur la file réelle

Audit en lecture seule du compte superadministrateur sur le domaine officiel :
59 dossiers, 2 urgents, 18 en attente du demandeur, 37 sans agent nominatif et
10 rapprochements de doublons proposés. Aucun HTTP 5xx n'apparaît dans les
journaux Vercel des dernières 24 heures. La difficulté constatée est donc le
parcours de traitement, pas une panne générale du serveur.

La file mélangeait les accès ENT, les codes de session PC, le matériel, la
cantine et les demandes administratives. L'API acceptait déjà un filtre par
catégorie, mais l'interface ne l'exposait que pour le raccourci matériel. Le
libellé « à attribuer » était également trompeur : l'envoi d'une réponse
attribue déjà le dossier à l'agent connecté. Une demande de cantine historique
est encore visible dans le service numérique ; les nouvelles demandes de ce
type sont routées vers l'intendance par les règles actuelles.

## Correction du parcours agent

- filtre visible par type : ENT/PRONOTE, codes session PC, matériel/SPIE,
  cantine/intendance, documents, classes et autres besoins ;
- distinction entre le type de demande et le service responsable ;
- remplacement de « à attribuer » par « sans agent » et rappel que la première
  réponse prend automatiquement le dossier ;
- proposition de correction immédiate lorsque le service actuel ne correspond
  plus aux règles locales, sans fusion ni modification automatique ;
- réponse proposée repliée par défaut pour alléger l'écran, avec un bouton
  unique « Préparer cette réponse », puis relecture et envoi ;
- pour une demande sensible, la première action prépare une réponse générale
  sûre ; aucun code ni document personnel ne peut partir avant confirmation de
  l'identité ;
- brouillon dédié aux codes de session PC : passage par l'OTP du portail puis
  affichage temporaire dans « Ma session PC », jamais dans l'email ni dans le
  texte du dossier.

Le matériel du lycée reste dans la catégorie `ordinateur`, visible dans
« Matériel & SPIE ». Le référent qualifie et coordonne ; SPIE diagnostique et
répare. Les codes de session PC restent dans le circuit numérique protégé et ne
sont pas mélangés au suivi d'une panne matérielle.

## Vérifications

Build de production réussi. Quarante tests ciblés passent : file, focus du
dossier, routage et suggestions de réponse, dont le nouveau scénario de code
de session PC sans exposition d'identifiant ou de code. La recette distante
authentifiée et la publication seront ajoutées après déploiement du commit.

## Limites conservées

Les dossiers historiques ne sont ni transférés, ni répondus, ni fermés en
masse. La proposition de transfert reste une décision humaine. Une réponse
officielle, un code, un document personnel et une clôture restent validés par
un agent habilité. Aucune notification, aucun email et aucun OTP réel n'a été
envoyé pendant cet audit.
