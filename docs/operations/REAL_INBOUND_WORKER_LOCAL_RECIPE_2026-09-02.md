# Recette locale complète du worker entrant

**Date** : 2 septembre 2026
**Périmètre** : pile Supabase et moteur ClamAV strictement locaux
**Tâche** : `005/T022K1`, terminée

## Objectif

Exécuter le véritable programme de traitement d'une pièce entrante avec les
93 migrations du dépôt, PostgreSQL, PGMQ, Storage privé et ClamAV, sans joindre
la preview distante et sans utiliser de donnée réelle.

## Garde-fous

- l'option `--local-stack-only` est obligatoire avant toute connexion ;
- PostgreSQL est limité à `127.0.0.1:54322/postgres` ;
- Storage est limité à `127.0.0.1` sur le port local Supabase déclaré ;
- la clé serveur locale reste en mémoire et n'est ni écrite ni affichée ;
- l'image officielle `clamav/clamav:1.5` reste épinglée par empreinte ;
- ClamAV n'a ni réseau ni port publié ;
- les identifiants, textes et fichiers de la recette sont fictifs et fixes ;
- aucun projet Supabase distant n'est nommé ou accepté par le harnais.

La pile a été lancée avec la CLI Supabase `2.116.0`. Les 93 migrations ont été
rejouées depuis zéro avant la recette. La documentation Supabase actuelle
confirme que les services locaux passent par la même passerelle API et que les
objets doivent être supprimés via Storage, pas directement par SQL :
[développement local](https://supabase.com/docs/guides/local-development/overview),
[suppression d'objets](https://supabase.com/docs/guides/storage/management/delete-objects).

## Scénarios vérifiés

1. Un texte fictif sain est déposé dans la quarantaine privée, loué dans PGMQ,
   relu et vérifié par SHA-256, analysé par ClamAV, copié dans le bucket propre,
   relu, marqué `clean`, journalisé puis acquitté atomiquement.
2. EICAR suit le même circuit et devient `blocked`. L'objet reste exclusivement
   dans la quarantaine et un événement machine unique est conservé.
3. Un troisième fichier rencontre une indisponibilité réelle du processus
   scanner. Il devient `scan_error`, sa tâche reste dans PGMQ avec temporisation,
   puis un second bail le replace en quarantaine et le termine `clean` avec le
   vrai moteur.

Sortie vérifiée :

```json
{"migrations":93,"database":"local-postgresql","storage":"local-private","antivirus":"ClamAV 1.5.4","clean":1,"blocked":1,"retry":1,"recovered":1,"queueResidues":0,"temporaryResidues":0}
```

Un contrôle indépendant après la recette retrouve zéro établissement, objet,
événement, tâche active, archive et objet Storage de la fixture. Aucun conteneur
ClamAV temporaire ne subsiste.

## Limites conservées

La preuve porte sur une pile locale reconstruite avec les migrations exactes.
Elle ne vaut pas activation du worker, supervision de service, recette sur la
branche Supabase distante ou qualification du futur runtime VPS. `005/T022K`
reste donc ouverte pour cette étape d'exploitation explicitement autorisée.

Production, Vercel, Supabase distant, VPS, Webmail, Brevo, DNS et données réelles
sont inchangés.
