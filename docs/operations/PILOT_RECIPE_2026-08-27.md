# Recette du pilote LyceeGest

**Cible** : preview Vercel de la branche `codex/lycee-connect-prototype`  
**Référence code** : `531eaa8`  
**Données autorisées** : données fictives uniquement

## 1. État prouvé

- Le déploiement Vercel est `READY` et l'alias stable pointe vers le nouvel
  artefact.
- L'accueil, la connexion du personnel et la page de remplacement du mot de
  passe répondent en HTTP 200.
- Une visite non authentifiée de l'API agent reçoit HTTP 401.
- La branche Supabase de preview exige 12 caractères au minimum, refuse les
  mots de passe compromis et autorise l'URL exacte de récupération.
- Les 38 tests fonctionnels du dépôt, le build TypeScript/Vite et l'audit npm
  de production sont réussis.

## 2. Recette immédiate avec données fictives

1. Créer une demande fictive depuis un téléphone et vérifier son numéro de
   dossier.
2. Reprendre la demande sur le même appareil puis ajouter un message et une
   petite pièce de test sans donnée personnelle.
3. Ouvrir l'espace agent, vérifier la connexion du personnel et traiter la
   demande fictive : assignation, note interne, réponse, transfert et clôture.
4. Vérifier que la réponse est visible dans le dossier du demandeur et que la
   note interne ne l'est jamais.
5. Demander une récupération de compte agent de test, utiliser le lien reçu,
   choisir un mot de passe fort puis vérifier la reconnexion.
6. Refaire les parcours à 320 px et sur ordinateur sans défilement horizontal.

## 3. Conditions avant un pilote nominatif

- Créer au moins deux comptes individuels pour les responsables habilités ;
  aucun code direction partagé ne doit devenir le compte définitif.
- Tester la récupération du compte et la perte du téléphone avant de rendre la
  MFA obligatoire pour tous les agents.
- Faire valider les mentions, les durées de conservation et les habilitations
  par la direction et le référent protection des données.
- Définir une boîte email de traitement et tester le retour email dans le même
  dossier avec des adresses de test.
- Obtenir une confirmation précise avant de créer un lien Vercel partageable ou
  de promouvoir la preview en production.

## 4. Import des emplois du temps

L'import réel reste suspendu. Le contrat applicable est
`specs/002-agent-etablissement-adaptatif/schedule-import.md` : stockage privé,
empreinte et version, indexation contrôlée page par page, accès temporaire et
retour arrière. L'autorisation devra nommer la branche Supabase cible, les
personnes habilitées et la durée de conservation.

## 5. Arrêt et retour arrière du pilote

En cas de comportement incorrect, arrêter le partage de la preview et conserver
les preuves techniques nécessaires à l'analyse. Le site Hostinger, le domaine
officiel, le VPS, le Webmail du Lycée et la base Supabase principale ne sont pas
modifiés par cette recette.
