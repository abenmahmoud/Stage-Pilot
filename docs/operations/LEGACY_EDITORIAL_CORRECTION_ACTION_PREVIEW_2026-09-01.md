# Correction contrôlée des brouillons WordPress - preview

## État du lot

L'action `apply_editorial_corrections` est implémentée mais désactivée par
défaut. Aucun brouillon distant n'a été corrigé et la migration n'a pas été
appliquée à une base distante.

## Garanties

- seuls `superadmin` et `proviseur` peuvent demander l'action ;
- la session doit être au niveau MFA `aal2` ;
- le corps contient exactement l'action, la version attendue et `CORRIGER` ;
- seuls les brouillons WordPress avec clé d'import et relecture ouverte sont
  acceptés ;
- la version est vérifiée dans l'écriture atomique afin de refuser un écran
  périmé ;
- une nouvelle version est créée, tandis que le statut reste `brouillon` et la
  relecture reste obligatoire ;
- l'audit conserve uniquement les codes, champs et nombres d'occurrences ;
- l'action ne publie pas, ne valide pas la source et ne touche pas aux médias.

## Activation preview, après décision explicite

1. Appliquer uniquement sur la base preview la migration
   `20260901123000_add_legacy_editorial_correction_action.sql`.
2. Activer `LEGACY_EDITORIAL_CORRECTIONS_ENABLED=true` côté serveur et
   `VITE_LEGACY_EDITORIAL_CORRECTIONS_ENABLED=true` côté navigateur, uniquement
   dans l'environnement preview.
3. Redéployer la preview et utiliser un compte direction nominatif sous MFA.
4. Tester d'abord un brouillon fictif, vérifier la nouvelle version, l'audit
   minimal, le maintien en relecture et le refus d'une deuxième version périmée.
5. Laisser toute publication à une décision humaine séparée.

## Retour arrière

Désactiver d'abord les deux interrupteurs et redéployer. Les versions déjà
créées restent restaurables par le mécanisme éditorial existant. Ne jamais
supprimer l'historique ou l'audit pour annuler une correction.

## Vérifications permanentes

`test:legacy-editorial-apply-action` couvre le contrat fermé, les rôles, MFA,
la source, l'état, la concurrence, le reçu navigateur, l'audit minimal et la
migration. Il est inclus dans `test:preview-security-gate` par la suite de tests
des réponses administratives de l'éditeur.
