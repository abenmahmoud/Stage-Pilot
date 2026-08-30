# Rotation du coffre d'identités

## Portée livrée

La primitive locale rechiffre une enveloppe AES-256-GCM d'une version `vN` vers
une version cible strictement supérieure. Elle exige l'ancienne clé, vérifie
l'enveloppe et son contexte établissement/import/référence, puis chiffre avec
un nonce neuf. Elle ne lit ni n'écrit la base et ne journalise aucune donnée
déchiffrée.

Elle accepte aussi un lot de 250 lignes au plus. Toutes les lignes, enveloppes,
références et versions sont validées avant le résultat. Un lot peut réunir
plusieurs anciennes versions vers une cible unique. Les identifiants dupliqués,
champs inconnus, enveloppes déjà à jour et retours vers une version inférieure
sont refusés. Le bilan contient uniquement la cible, le nombre traité et des
compteurs par version source.

Le worker transactionnel est préparé mais fermé tant que
`IDENTITY_VAULT_ROTATION_ENABLED` n'est pas explicitement à `true`. Il exige un
UUID d'établissement, un UUID d'import et une limite bornée. Il verrouille les
lignes anciennes avec `SKIP LOCKED`, compare encore l'ancienne version, le
nonce, le tag et le ciphertext au moment de l'écriture, puis inscrit un unique
audit agrégé dans la même transaction. Un échec annule tout le lot.

## Procédure opérationnelle future

1. Générer une clé de 32 octets dans le coffre du worker, sans l'afficher.
2. Conserver l'ancienne variable et ajouter la nouvelle variable versionnée.
3. Définir la nouvelle version courante seulement sur le runtime de preview.
4. Valider la rotation sur des personnes entièrement fictives et vérifier la
   restauration de la base et du secret dans un environnement isolé.
5. Sélectionner au plus 250 lignes anciennes avec verrou `SKIP LOCKED`, exécuter
   la primitive locale, puis appliquer toutes les enveloppes dans une seule
   transaction avec compteur agrégé et aucun texte clair dans les journaux.
6. Contrôler qu'aucune ligne active n'utilise l'ancienne version et qu'une
   restauration peut encore déchiffrer un échantillon fictif.
7. Retirer l'ancienne clé seulement après validation écrite et fenêtre de retour
   arrière terminée.

## Interdictions

- ne jamais remplacer une clé en place sous le même nom de version ;
- ne jamais retirer l'ancienne clé avant zéro ligne restante et restauration ;
- ne jamais faire transiter le clair par un journal, une API ou le modèle IA ;
- ne jamais exécuter la rotation sur des données réelles depuis une preview ;
- ne jamais considérer la primitive locale comme un worker opérationnel.
- ne jamais activer le worker sans sauvegarde restaurée, cible isolée et fenêtre
  de retour arrière validée ;
- ne jamais installer un minuteur automatique avant la recette fictive manuelle.

## Preuves locales

`npm run test:identity-directory-vault` exécute 37 contrôles : chiffrement aléatoire,
authentification AAD, altération, mauvaise clé, rotation v1 vers v2, nouveau
nonce, déchiffrement par v2, rejet par v1, version identique, clé source absente
et interdiction d'un retour vers une version inférieure. Il couvre aussi un lot
mixte v1/v2 vers v3, les doublons, plafonds, champs inconnus, reprise incorrecte
et l'absence de données en clair dans le résultat.

`npm run test:identity-vault-rotation-worker` exécute 24 contrôles statiques sur
l'interrupteur, le ciblage, la limite, le verrou SQL, les comparaisons
optimistes, l'audit, l'index et l'absence de journal nominatif.
