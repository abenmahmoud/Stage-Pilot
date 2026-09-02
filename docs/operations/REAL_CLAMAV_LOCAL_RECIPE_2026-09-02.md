# Recette locale avec le véritable moteur ClamAV

**Date** : 2 septembre 2026
**Périmètre** : machine locale et fichiers strictement fictifs
**Tâche** : `005/T022J1`, terminée

## Objectif

Remplacer la seule simulation de processus antivirus par une preuve du véritable
moteur sur l'adaptateur de communications entrantes, sans base, stockage, VPS,
port public, secret ni donnée réelle.

## Moteur épinglé

- image officielle : `clamav/clamav:1.5` ;
- empreinte OCI :
  `sha256:f0954d679017eb6d48221e2b2be3ac5457bf278a844f39b672376f55a085f591` ;
- version observée : `ClamAV 1.5.4/28108/Sun Aug 30 06:27:10 2026` ;
- réseau du conteneur : `none` ;
- port publié : zéro ;
- mémoire limitée à 3 Gio et deux processeurs.

Le choix d'une empreinte évite qu'une future modification de l'étiquette `1.5`
change silencieusement la recette. L'image officielle et ses conventions sont
documentées par [ClamAV](https://docs.clamav.net/manual/Installing/Docker.html).

## Résultat

La recette `npm run recipe:local-real-clamav-scanner` :

1. refuse de démarrer sans `--local-container-only` ;
2. exige que l'image épinglée soit déjà présente ;
3. crée un conteneur éphémère sans réseau ;
4. attend son état `healthy` et vérifie la version du moteur ;
5. transmet les octets au véritable adaptateur LyceeGest avec confirmation
   exacte de taille et SHA-256 ;
6. reçoit `clean` et `clamav_clean` pour un texte fictif sain ;
7. reçoit `blocked` et `antivirus_detected_threat` pour EICAR ;
8. supprime le conteneur dans tous les cas et contrôle l'absence de résidu.

Sortie vérifiée :

```json
{"clean":"clean","eicar":"blocked","temporaryResidues":0}
```

Les 18 tests historiques de l'adaptateur et les 23 tests du worker passent
ensuite sans régression. Un lancement direct sans confirmation échoue avant
toute opération Docker et laisse zéro conteneur.

## Limites conservées

Le processus `clamdscan` est exécuté dans le même conteneur que `clamd`. Le
harnais vérifie le fichier de configuration produit par l'application, mais le
client conteneurisé utilise sa propre configuration locale. Cette preuve valide
les octets, l'empreinte, le protocole de processus, les verdicts, les reçus et le
nettoyage ; elle ne valide pas encore le raccordement du futur runtime au socket
ou port local du démon.

Cette première recette ne louait aucune tâche PGMQ et ne touchait pas Storage.
La recette suivante `005/T022K1` couvre désormais localement PostgreSQL, PGMQ,
Storage, panne scanner et reprise. `005/T022K`, `005/T011D` et `003/T009C`
restent ouvertes pour leurs runtimes de preview explicitement autorisés.

Production, Vercel, VPS, Webmail, Brevo, DNS et bases distantes sont inchangés.
