# Recette locale complète de l'antivirus éditorial

**Date** : 2 septembre 2026  
**Périmètre** : pile Supabase et moteur ClamAV strictement locaux  
**Tâche** : `003/T009C3`, terminée

## Objectif

Exécuter le véritable worker des médias éditoriaux avec les 93 migrations du
dépôt, PostgreSQL, PGMQ, Storage privé et ClamAV, sans joindre la preview
distante et sans utiliser de donnée réelle.

## Garde-fous

- l'option `--local-stack-only` est obligatoire avant toute connexion ;
- PostgreSQL est limité à `127.0.0.1:54322/postgres` ;
- Storage accepte uniquement l'API Supabase locale sur `127.0.0.1` ;
- la clé serveur locale reste en mémoire et n'est ni écrite ni affichée ;
- l'image officielle `clamav/clamav:1.5` est épinglée par empreinte ;
- le conteneur ClamAV n'a ni réseau, ni port publié, ni privilège étendu ;
- les identifiants, textes et fichiers de la recette sont fictifs et fixes ;
- aucun projet Supabase distant n'est nommé ou accepté par le harnais.

La pile locale utilise la CLI Supabase `2.116.0`. Le changement annoncé de
passerelle des installations auto-hébergées ne concerne pas ce parcours CLI :
[changelog Supabase](https://supabase.com/changelog?types=breaking-change),
[développement local](https://supabase.com/docs/guides/local-development/cli/getting-started).

## Scénarios vérifiés

1. Un PDF fictif sain est relu dans la limite déclarée, vérifié par SHA-256,
   analysé, copié sans écrasement dans le bucket propre, relu, puis marqué
   `ready` avant suppression de la quarantaine.
2. Un DOCX fictif contenant le fichier de test EICAR est détecté par ClamAV,
   marqué `blocked`, journalisé et absent du bucket propre.
3. Une indisponibilité du scanner conserve la tâche ; le bail PGMQ suivant
   termine le même fichier sans doublon.
4. Une panne injectée après le commit `ready` conserve la tâche et les deux
   copies ; le rejeu vérifie la copie propre, retire la quarantaine et ne crée
   pas un second reçu.
5. Une copie propre altérée après validation échoue cinq fois, passe à
   `archived`, conserve un événement `scan_error` et n'est plus publiable.

Sortie finale vérifiée :

```json
{"migrations":93,"database":"local-postgresql","storage":"local-private","antivirus":"ClamAV 1.5.4","clean":1,"blocked":1,"scannerRecovery":1,"cleanupRecovery":1,"tamperFailClosed":1,"archivedFailureProof":1,"cleanupResidues":0,"temporaryResidues":0}
```

Après le nettoyage, un contrôle retrouve zéro média, reçu, tâche PGMQ active ou
archivée et objet Storage de la fixture. Le conteneur ClamAV et toute la pile
Supabase locale sont arrêtés. `supabase/config.toml` est identique à Git.

## Vérifications complémentaires

- `npm run test:site-content-file-worker` : 8 tests réussis ;
- `npm run test:worker-download-bounds` : 9 tests réussis ;
- `npm run test:local-real-site-content-file-worker-safety` : garde locale
  réussie ;
- `npm run test:preview-security-gate` : réussi ;
- `npm run build` : réussi, avec l'avertissement XLSX déjà connu.

## Limites conservées

Cette preuve qualifie le code et la reprise sur une pile locale reconstruite.
Elle ne vaut pas activation d'un timer, déploiement du worker, traitement des
médias WordPress historiques, import réel ou pilote public. `003/T009C` reste
ouverte pour ces décisions et opérations explicitement autorisées.

Production, Supabase distant, VPS, Hostinger, DNS, Webmail, ENT, PRONOTE et
données réelles sont inchangés.
