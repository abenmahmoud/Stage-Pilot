# Persistance des comptes et périmètres agents

**Décision technique** : 27 août 2026  
**État** : migration et contrôle serveur prêts, activation différée

## Objectif

Remplacer les périmètres temporaires portés par les métadonnées du compte par
une adhésion nominative, révocable et liée à l'établissement. Aucun compte réel
ni aucune adresse personnelle n'est ajouté dans Git.

## Règles

- Chaque agent possède un compte individuel et une seule adhésion par
  établissement.
- Une adhésion doit être `active` et l'établissement `pilot` ou `active`.
- Les services autorisés viennent uniquement de `institution_memberships` quand
  le mode base de données est activé.
- Le superadministrateur et la direction exigent une adhésion de type `admin`.
- Un rôle `auditor` n'obtient aucun accès aux API de traitement actuelles.
- Les tables ne sont jamais lisibles directement par `anon` ou `authenticated` ;
  les API serveur contrôlent l'utilisateur puis utilisent le rôle serveur.
- `mfa_verified_at` est une trace d'audit. L'autorisation MFA dépend toujours du
  niveau AAL courant fourni par Supabase Auth.
- Une erreur de base ou une adhésion absente refuse l'accès. Il n'existe aucun
  repli silencieux vers les métadonnées lorsque le mode base est actif.

## Activation progressive

1. Appliquer la migration uniquement à la base de prévisualisation.
2. Créer quatre comptes fictifs et leurs adhésions, puis vérifier le cloisonnement.
3. Créer les comptes nominatifs autorisés et enrôler leur second facteur.
4. Définir `SUPPORT_MEMBERSHIP_SOURCE=database` et
   `SUPPORT_INSTITUTION_SLUG=blaise-cendrars-sevran` en prévisualisation.
5. Tester lecture, prise en charge, réponse, transfert, pièces et révocation.
6. Activer le pilote réel seulement après validation de la direction.

Avant l'étape 4, l'application conserve le mode `metadata` actuel afin que le
déploiement de cette préparation ne bloque pas la démonstration.
