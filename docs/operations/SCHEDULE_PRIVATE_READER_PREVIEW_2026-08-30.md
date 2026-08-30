# Lecture privée des emplois du temps - recette preview

## Périmètre

- Branche Supabase `guichet-lycee-preview` uniquement.
- Créneaux et établissements de recette entièrement fictifs.
- Aucun PDF, emploi du temps, nom, classe ou compte réel importé.
- Aucun accès public, connecteur PRONOTE, ENT, VPS ou production.

## Invariants

- Chaque créneau appartient à une version du même établissement par clé étrangère
  composite.
- Au moins une référence opaque de classe, groupe ou personnel est requise.
- La fin est postérieure au début et la confiance est comprise entre 0 et 1.
- Seul un créneau approuvé par un humain peut être lu.
- Une source active doit avoir une limite de fraîcheur.
- La direction choisit la fin de validité éventuelle et la date de recontrôle ;
  le serveur refuse une fraîcheur située hors de cette période.
- Après activation de la source, ses créneaux deviennent immuables.
- RLS est forcée ; `anon` et `authenticated` n'ont aucun droit sur la table.

## Lecteur serveur

Le lecteur reçoit un périmètre déjà autorisé, jamais des droits déclarés par le
navigateur. Il accepte au maximum 40 références opaques, filtre directement
l'établissement, la version active, sa période, sa fraîcheur et les créneaux
approuvés. Il retourne le prochain cours autorisé et la source datée, sans
référence de professeur.

Lorsqu'un créneau porte un groupe, l'appartenance à la classe ne suffit pas : la
référence de groupe doit elle aussi être autorisée. Un professeur ne passe que
par sa propre référence opaque.

Le branchement serveur identité scolaire-vers-références autorisées est actif :
identité non révoquée, annuaire actif, lignes valides et datées. Une cible tierce
exige une relation `guardian_of` active. L'assistant appelle cet adaptateur
uniquement pour une question explicitement personnelle sur le prochain cours ;
il ne transmet jamais de cible tierce issue du texte. Les références du périmètre
sont normalisées au format canonique de l'emploi du temps ; le périmètre propre
d'un personnel ne contient que sa référence enseignant.

Sans identité scolaire, version fraîche ou résultat cohérent, l'assistant refuse
de répondre et propose un dossier suivi. L'appel ne passe pas par le modèle et la
réponse ne contient aucune référence de personnel. La sélection d'un enfant lié
et la recette authentifiée avec des comptes fictifs restent volontairement
fermées avant la prochaine étape.

## Recette

Une transaction a créé deux établissements fictifs, une version, une page
validée et un créneau approuvé. Elle a refusé un créneau lié à la version d'un
autre établissement, un doublon du même créneau puis toute modification après activation. Elle a aussi
vérifié l'absence de droit de lecture client.

Le `ROLLBACK` final laisse zéro établissement, source et créneau de recette. RLS
reste activée et forcée ; le rôle serveur conserve seul la lecture. L'indexeur
Supabase ne signale plus de clé étrangère sans index couvrant.
