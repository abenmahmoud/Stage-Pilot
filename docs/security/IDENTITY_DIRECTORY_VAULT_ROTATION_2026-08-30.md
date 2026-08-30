# Rotation du coffre d'identités

## Portée livrée

La primitive locale rechiffre une enveloppe AES-256-GCM d'une version `vN` vers
une version cible strictement supérieure. Elle exige l'ancienne clé, vérifie l'enveloppe et
son contexte établissement/import/référence, puis chiffre avec un nonce neuf.
Elle ne lit ni n'écrit la base et ne journalise aucune donnée déchiffrée.

## Procédure opérationnelle future

1. Générer une clé de 32 octets dans le coffre du worker, sans l'afficher.
2. Conserver l'ancienne variable et ajouter la nouvelle variable versionnée.
3. Définir la nouvelle version courante seulement sur le runtime de preview.
4. Valider la rotation sur des personnes entièrement fictives et vérifier la
   restauration de la base et du secret dans un environnement isolé.
5. Traiter des lots bornés avec verrou `SKIP LOCKED`, transaction par lot,
   compteur agrégé et aucun texte clair dans les journaux.
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

## Preuves locales

`npm run test:identity-directory-vault` vérifie chiffrement aléatoire,
authentification AAD, altération, mauvaise clé, rotation v1 vers v2, nouveau
nonce, déchiffrement par v2, rejet par v1, version identique, clé source absente
et interdiction d'un retour vers une version inférieure.
