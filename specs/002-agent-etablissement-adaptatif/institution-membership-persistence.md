# Persistance des comptes et périmètres agents

**Décision technique** : 27 août 2026  
**État historique** : migration appliquée et mode base actif sur la preview isolée

**Renforcement du 1er septembre 2026** : le code n'accepte désormais que la base
pour les périmètres agents. Une valeur absente vaut `database` ; l'ancienne
valeur `metadata` échoue explicitement. AAL2 est obligatoire pour les rôles agents,
indépendamment des anciennes variables. Aucune variable distante ni compte
n'a été modifié pour ce lot. La recette Auth du déploiement courant reste ouverte.

## Objectif

Remplacer les périmètres temporaires portés par les métadonnées du compte par
une adhésion nominative, révocable et liée à l'établissement. Aucun compte réel
ni aucune adresse personnelle n'est ajouté dans Git.

## Règles

- Chaque agent possède un compte individuel et une seule adhésion par
  établissement.
- Une adhésion doit être `active` et l'établissement `pilot` ou `active`.
- Les services autorisés viennent uniquement de `institution_memberships`.
- Le superadministrateur et la direction exigent une adhésion de type `admin`.
- Un rôle `auditor` n'obtient aucun accès aux API de traitement actuelles.
- Les tables ne sont jamais lisibles directement par `anon` ou `authenticated` ;
  les API serveur contrôlent l'utilisateur puis utilisent le rôle serveur.
- `mfa_verified_at` est une trace d'audit. L'autorisation MFA dépend toujours du
  niveau AAL courant fourni par Supabase Auth.
- Une erreur de base ou une adhésion absente refuse l'accès. Il n'existe aucun
  repli vers les métadonnées, quelle que soit la configuration.

## Activation progressive

1. [Terminé] Appliquer la migration uniquement à la base Supabase isolée de la
   prévisualisation.
2. [Terminé] Créer quatre comptes fictifs éphémères, atteindre `aal2`, vérifier
   leurs adhésions persistées, puis supprimer comptes et adhésions de test.
3. [Terminé] Définir `SUPPORT_MEMBERSHIP_SOURCE=database` et
   `SUPPORT_INSTITUTION_SLUG=blaise-cendrars-sevran` uniquement pour la branche
   Vercel `codex/lycee-connect-prototype`.
4. [À faire] Créer les comptes nominatifs autorisés et enrôler leur second
   facteur. Les autres comptes sans adhésion active sont refusés sans repli.
5. [À faire] Tester lecture, prise en charge, réponse, transfert, pièces,
   récupération du compte et révocation avec ces comptes nominatifs.
6. [À faire] Activer le pilote réel seulement après validation de la direction.

Un compte de démonstration administration déjà présent dans la base de preview
possède une adhésion active limitée à `secretariat`, `administration` et
`intendance`. Aucun email de test n'a été envoyé et aucune donnée nominative n'a
été ajoutée à Git.

Le banc de test temporaire déployé sur la branche Supabase a été remplacé après
la recette par une réponse `410 Retired`, protégée par JWT. Il ne crée plus de
compte et pourra être supprimé avec la branche de preview en fin de pilote.

Le premier déploiement Vercel intégrant les deux variables de branche est le
commit `ecebadf`. La recette sans compte confirme que l'application répond et que
l'API agent refuse une session anonyme ; la recette métier nominative reste
obligatoire avant le pilote réel.
