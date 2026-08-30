# Worker de rotation du coffre d'identités

## État

Le code et la migration additive sont préparés uniquement dans Git. Ils n'ont
pas été exécutés sur Supabase, installés sur le VPS ou associés à un minuteur.
Aucune clé ni donnée réelle n'a été utilisée.

## Conditions avant une recette

1. Obtenir une autorisation précise pour une preview isolée et fictive.
2. Restaurer dans cette cible une sauvegarde fictive de la base et vérifier un
   échantillon chiffré avec l'ancienne clé.
3. Conserver l'ancienne clé versionnée et ajouter la nouvelle clé dans le coffre
   du worker, sans afficher leurs valeurs.
4. Appliquer la migration additive uniquement à la cible autorisée.
5. Fixer explicitement l'établissement, l'import et une limite initiale de `1`.
6. Vérifier qu'aucune version source n'est supérieure à la cible.

## Recette future

1. Laisser `IDENTITY_VAULT_ROTATION_ENABLED` absent et confirmer le refus.
2. Activer manuellement le worker pour une seule ligne fictive.
3. Vérifier la transaction, l'audit agrégé et le déchiffrement avec la nouvelle
   clé ; confirmer que l'ancienne clé ne déchiffre plus la nouvelle enveloppe.
4. Provoquer une enveloppe altérée et confirmer le retour arrière du lot entier.
5. Augmenter progressivement la limite sans dépasser 250.
6. Contrôler le nombre restant par version jusqu'à zéro.
7. Restaurer de nouveau la base fictive et répéter un déchiffrement complet.

## Retour arrière

Chaque lot est atomique, mais une série de lots déjà validés ne doit pas être
rechiffrée vers une ancienne version. Le retour arrière repose sur la sauvegarde
restaurable prise avant rotation. L'ancienne clé reste disponible jusqu'à zéro
ligne ancienne, restauration réussie et validation écrite de sa suppression.

## Arrêt immédiat

Arrêter sans réessayer si le périmètre diffère, si une clé manque, si une ligne
est déjà sous une version supérieure, si l'audit échoue ou si la restauration
préalable n'est pas prouvée.
