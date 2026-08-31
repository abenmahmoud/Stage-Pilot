# Brief Claude - reprise de pièce demandeur après redémarrage

## Mission proposée, non exécutée

- Modèle : à confirmer explicitement avant tout lancement.
- Objectif : rechercher une fuite locale, une collision de reprise ou une
  réutilisation de clé entre dossiers dans le lot T037AE.
- Périmètre : diff du lot et quatre fichiers maximum : mémoire IndexedDB,
  composant public, tests ciblés et spécification 001.
- Permission : lecture seule, aucun outil d'écriture, réseau ou déploiement.
- Volume estimé : faible, moins de 1 500 lignes utiles.
- Livrable : constats classés par sévérité avec scénario reproductible et ligne.
- Arrêt : après un passage complet du périmètre, sans élargissement automatique.

## Questions d'audit

1. Une entrée locale peut-elle conserver un nom, un contenu, un jeton, un chemin
   ou une URL de fichier ?
2. Une empreinte ou une clé peut-elle être réutilisée pour un autre dossier ou
   une autre occurrence du même fichier ?
3. Les courses entre plusieurs fichiers ou onglets peuvent-elles supprimer une
   opération encore active ou dépasser durablement le plafond ?
4. Le succès, le retrait et l'oubli de l'appareil nettoient-ils tous les états
   locaux concernés sans inventer une réussite serveur ?
5. Une personne qui revient après expiration obtient-elle une nouvelle clé sans
   perdre l'accès au brouillon serveur, qui reste retirable séparément ?

Ce document prépare seulement une délégation. Aucun quota Claude n'est consommé
sans autorisation bornée pour cette exécution.
