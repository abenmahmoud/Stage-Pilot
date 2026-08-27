# Feuille de route d'exécution - Portail et agent d'établissement

**Date de référence** : 28 août 2026
**Périmètre** : feature `002-agent-etablissement-adaptatif` et dépendance `001`  
**Principe** : avancer vite en preview, valider avant données réelles et production

## Résultat visé

Un portail public complet et installable, un guichet unique de demandes, des
espaces de travail par service et un agent capable de répondre à partir de sources
validées. Les cours, salles et changements deviennent personnalisés après preuve
d'identité scolaire. Les décisions sensibles restent humaines.

## Chantiers ordonnés

1. **Socle fiable** : conserver une seule demande, ses messages, documents,
   événements, notifications et reprises sans perte ni doublon.
2. **Routage opérationnel** : orienter numérique, secrétariat, CPE/vie scolaire,
   intendance et direction ; garder une file humaine pour les cas ambigus.
3. **Comptes et identité** : séparer contact vérifié, identité scolaire, rôle et
   service ; OTP, annuaire officiel privé, liens parent-enfant et MFA agents.
4. **Console des services** : files filtrées, prise en charge, transfert, délais,
   réponses proposées, historique, pièces et audit.
5. **Connaissances contrôlées** : compétences versionnées, sources datées,
   responsables, tests, publication, expiration et retour arrière.
6. **Cours et salles** : import privé des emplois du temps, validation humaine,
   modèle de créneaux, accès par classe/groupe et réponse sourcée.
7. **Changements du jour** : connecteur officiel autorisé, fraîcheur visible,
   cours maintenu/déplacé/annulé et repli vers la vie scolaire.
8. **Site complet** : formations, actualités, documents, contacts, accès rapides,
   éditeur simple et inventaire de l'ancien site sans oubli.
9. **Agent utile** : dialogue libre, français simple ou autre langue, documents,
   réponses pédagogiques bornées, transfert humain et continuité sans IA.
10. **Communication** : accusés, réponses entrantes/sortantes, journal de
    livraison, consentement et retrait des contacts ; SMS seulement si validé.
11. **Sécurité et charge** : isolation des rôles, stockage privé, antivirus,
    limites adaptées au lycée, file durable, sauvegardes et test de 200 créations.
12. **Pilote puis convergence** : agents nominatifs, responsables métier,
    mesures, corrections, audit, Spec Kit Analyze/Converge et retour arrière.

## Travail des modèles

### Codex - responsable d'exécution

- Maintient Spec Kit, le code, les tests, les migrations et les commits.
- Vérifie le parcours complet navigateur-API-base-notification et la responsive.
- Ne déploie que la preview tant qu'une autorisation précise de production n'est
  pas donnée.

### Claude - revue ciblée après autorisation explicite

- Relit en lecture seule l'identité, les droits, les risques RGPD et les parcours
  sensibles.
- Produit uniquement des écarts classés par gravité, sans modifier le dépôt.
- Une invocation bornée ; secrets, données réelles et pièces exclus.

### Kimi - contradicteur données et charge après autorisation explicite

- Cherche les cas ambigus dans l'import d'emplois du temps, le routage et les
  scénarios de pointe.
- Propose des tests manquants et les hypothèses à faire valider.
- Une invocation bornée ; aucune donnée nominative ni accès de production.

Codex reste arbitre : aucune proposition externe n'est appliquée sans preuve dans
le dépôt et sans respecter la spécification. Les appels Claude/Kimi nécessitent
l'autorisation de quota définie par le propriétaire.

## Lots de nuit sûrs

- Lot N1 : moteur de routage déterministe, motif, identité requise et filtre de
  service. **Implémenté et testé**.
- Lot N2 : contrat complet comptes/OTP/identité scolaire et matrice d'accès.
  **Matrice déterministe implémentée et testée sur données fictives** : contact
  vérifié distinct de l'identité scolaire, liens propres/parent-enfant,
  révocation, cloisonnement établissement/service, MFA et absence de passe-droit
  administrateur. Les comptes, OTP, tables privées, annuaire et politiques RLS
  restent à construire avant tout usage réel.
- Lot N3 : schéma privé et réversible des versions d'emploi du temps, sans importer
  les PDF ni les noms en preview. **Contrat et politique de lecture fictive testés ;
  migration privée encore requise**.
- Lot N4 : compétence cours/salles/changements et scénarios interdits.
- Lot N4A : politique de publication, accès aux sources, expiration et retour
  arrière du registre de compétences. **Socle persistant implémenté et testé** :
  six tables privées, cloisonnement par établissement, API réservée à la direction,
  MFA au moment de publier ou retirer, écran de sources/versions/tests/journal et
  retour arrière. La migration est appliquée uniquement à la base Supabase isolée
  de preview et les six tables sont vides. Le worker d'expiration, les responsables
  métier et la publication de sources réelles restent requis.
- Lot N5 : files `À qualifier`, délais et dossiers sans propriétaire.
  **Visibilité opérationnelle implémentée et testée** : vue `À classer`, compteurs
  sans responsable et échéances dépassées, marqueurs par dossier et ordre par
  priorité puis échéance enregistrée. Les relances et escalades restent bloquées
  jusqu'à la validation des délais métier et des responsables de chaque service.
- Lot N5A : périmètres de traitement par service. **Politique serveur de preview
  implémentée et testée** : superadmin/direction complets, DDFPT, administration
  et vie scolaire cloisonnés sur liste, détail, réponse, note et pièce jointe.
  La persistance et les RLS sont appliquées sur la base de preview isolée ; quatre
  comptes fictifs avec MFA `aal2` ont validé les adhésions puis ont été supprimés.
  Les comptes nominatifs, la récupération et la recette métier restent requis.
- Lot N5B : continuité assistant-dossier. **Implémentée et testée** : le dialogue
  utile est conservé message par message dans l'ordre, les réponses automatiques
  restent identifiées et le même fil est visible par l'usager et l'agent.
- Lot N5C : concurrence entre agents. **Implémentée et testée** : prise en charge
  atomique, révision obligatoire avant modification ou réponse, refus d'un état
  périmé et actualisation du dossier sans écrasement silencieux.
- Lot N5D : pilotage superadministrateur. **Implémenté en preview** : charge
  ouverte, urgente, en retard et sans agent par service, avec accès direct à la
  file correspondante et respect du périmètre serveur.
- Lot N5E : alertes internes par service. **Implémenté et testé** : le destinataire
  dépend du service affecté, les trois files administratives partagent une boîte
  fonctionnelle et une configuration absente revient au superadministrateur sans
  exposer l'adresse interne au demandeur. Les valeurs réelles restent à fournir
  et à configurer avant le pilote.
- Lot N5F : rappels téléphoniques. **Implémenté en preview** : une demande de
  rappel crée une tâche même avec un email, la console possède une file dédiée,
  la prise en charge est atomique et un résultat est obligatoire. Le rappel ne
  confirme pas automatiquement l'identité scolaire.
- Lot N5G : passage du dialogue au dossier. **Correctif implémenté et validé
  localement** : une demande scolaire suffisamment claire passe à l'état
  `offer_case`, affiche « Votre demande est prête », conserve le formulaire de
  secours et demande une confirmation avant enregistrement. Le blocage ENT reste
  prioritaire sur la consultation d'un emploi du temps, le profil accentué
  « élève » est prérempli et les vues PC/mobile ne débordent pas. La règle serveur
  empêche aussi un résultat IA trop prudent de remettre à `false` une demande que
  le contrôle déterministe juge complète. La création
  réelle d'un dossier fictif en preview, son suivi et sa lecture agent restent la
  dernière recette de T027D.
- Lot N6 : tests de non-régression, build, contrôle mobile et rapport d'écarts.

## Prochaine séquence verrouillée

1. Déployer N5G sur la preview et vérifier que l'agent propose « Vérifier et
   envoyer » dès qu'une demande scolaire est assez claire.
2. Créer un unique dossier fictif autorisé, puis vérifier son numéro, le suivi
   usager, le routage numérique et sa lecture dans la console agent.
3. Fermer T027D seulement après cette preuve de bout en bout et nettoyer les
   données de démonstration si elles ne doivent pas être conservées.
4. Ajouter le worker d'expiration et prouver qu'une source périmée désactive la
   compétence sans réponse trompeuse.
5. Faire nommer les responsables et valider les premières sources et procédures
   avant toute compétence active contenant des informations réelles.

## Portes de validation humaine

- Import de listes, emplois du temps ou pièces réelles.
- Activation d'un annuaire, OTP scolaire, PRONOTE, ENT ou SMS.
- Création des comptes agents et attribution des rôles.
- Publication des contenus de l'ancien site.
- Mention publique d'ESSUF GROUP ou du partenariat.
- Bascule DNS, site officiel, VPS ou toute production.

## Définition de « prêt à piloter »

- Parcours visiteur, contact vérifié, identité scolaire et agent testés.
- Aucune fuite entre comptes, familles, classes, services ou établissements.
- Une demande survit aux pannes et conserve messages, pièces et événements.
- Les réponses dynamiques ont une source et une fraîcheur ; les sources périmées
  provoquent un refus sûr.
- Formulaire et suivi fonctionnent lorsque l'IA est indisponible.
- Responsables, procédures, rétention, sécurité, sauvegarde et retour arrière sont
  nommés et testés.
