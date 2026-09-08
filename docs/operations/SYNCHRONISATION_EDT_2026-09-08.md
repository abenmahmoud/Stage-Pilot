# Synchronisation EDT — 8 septembre 2026

## Résultat construit

LyceeGest possède désormais un connecteur de dossier pour le poste Windows du
lycée. Toutes les cinq minutes, il peut contrôler un export de classes et un
export de professeurs au format PDF, CSV ou Excel `.xlsx`. Un fichier n'est
envoyé que lorsqu'il est stable depuis au moins 60 secondes et que son empreinte
SHA-256 a changé.

Le serveur accepte les formats tabulaires par le même Dépôt Lycée privé que le
PDF. Il réserve un objet privé, fournit une URL d'envoi limitée à cet objet,
confirme la taille et le type, puis place la version en quarantaine pour le
contrôle antivirus. Un nouvel envoi de la même empreinte retrouve la version
existante. Une coupure entre la réservation et l'envoi recrée une URL courte et
reprend le transfert sans créer de seconde version.

L'activation reste humaine. La synchronisation n'écrase donc jamais l'emploi du
temps lu par l'agent : le fichier reçu attend le contrôle, la correspondance des
colonnes si nécessaire, la vérification des pages, l'approbation et l'activation.
L'agent continue à consulter uniquement la version active.

## Limite du dialogue PRONOTE affiché

La capture du 8 septembre affiche le profil `ENEJ` et l'URL fixe
`https://api.enej.lavienne86.fr/v1/externalimport`. Cette cible appartient au
connecteur ENEJ de la Vienne et ne doit pas être activée pour le lycée Blaise
Cendrars à Sevran.

La documentation Index Éducation confirme que l'export automatisé vers un ENT
utilise un socle partenaire et, selon le socle, une URL fournie par l'ENT ou un
répertoire. Le XML est chiffré pour ce socle. LyceeGest ne tente donc ni de se
faire passer pour ENEJ, ni de déchiffrer ce format propriétaire.

Le connecteur livré automatise le transport d'un export PDF/CSV/XLSX présent
sur le poste. Pour une automatisation directe du XML opérationnel PRONOTE, il
faudra obtenir le connecteur et le contrat technique Index Éducation destinés
au portail tiers. Ce raccord reste dans T003/T066.

## Fichiers livrés

- `scripts/sync-edt-client.mjs` : contrôle, empreinte, réservation, envoi,
  confirmation, reprise et journal local sans secret ;
- `deploy/windows/Install-LyceeGestEdtSync.ps1` : installation guidée et tâche
  Windows toutes les cinq minutes ;
- `deploy/windows/Invoke-LyceeGestEdtSync.ps1` : déchiffrement DPAPI du jeton
  seulement pendant l'exécution ;
- `deploy/windows/edt-sync-config.example.json` : exemple pour deux sources.

Le jeton n'est ni dans la configuration JSON, ni dans Git, ni dans le journal.
L'installateur le chiffre avec DPAPI pour le compte Windows qui installe la
tâche. La tâche doit donc rester sous ce même compte nominatif.

## Installation sur le poste du lycée

L'installation réelle attend seulement les chemins exacts des fichiers exportés.
Depuis un PowerShell ouvert dans le dépôt :

```powershell
& .\deploy\windows\Install-LyceeGestEdtSync.ps1 `
  -ClassesExportPath 'C:\Exports-EDT\classes.xlsx' `
  -TeachersExportPath 'C:\Exports-EDT\professeurs.xlsx'
```

L'installateur demande ensuite le jeton du Dépôt Lycée sans l'afficher. Il copie
le client sous `%LOCALAPPDATA%\LyceeGest\EdtSync`, protège le jeton par DPAPI et
crée la tâche `LyceeGest - Synchronisation EDT`.

Pour tester immédiatement après installation :

```powershell
& "$env:LOCALAPPDATA\LyceeGest\EdtSync\Invoke-LyceeGestEdtSync.ps1" `
  -InstallDirectory "$env:LOCALAPPDATA\LyceeGest\EdtSync"
```

Le fichier `edt-sync-state.json` indique `synchronized`, `resumed`,
`already_received` ou `unchanged`. Il ne contient ni jeton, ni URL signée.

## Contrôle dans LyceeGest

Après un envoi :

1. ouvrir l'administration des emplois du temps ;
2. attendre la fin du contrôle antivirus ;
3. pour un CSV/Excel, vérifier la correspondance des colonnes préremplie ;
4. vérifier les pages et les créneaux calculés ;
5. approuver puis activer avec une justification.

La correspondance validée est mémorisée pour le prochain export du même
périmètre. Elle reste confirmée humainement sur chaque nouvelle structure de
fichier. L'activation remplace alors l'ancienne version de façon atomique.

## Preuves locales

- client : nouvel envoi, fichier inchangé, fichier absent et refus d'une URL
  signée hors Supabase ;
- scripts PowerShell : analyse syntaxique réussie ;
- route réelle locale : réservation CSV, reprise après interruption, envoi vers
  le stockage privé, confirmation, file antivirus, déduplication et nettoyage ;
- 28 assertions sur la recette complète du Dépôt, exclusivement avec des
  données fictives ;
- TypeScript : aucune erreur.

## Retour arrière

La tâche Windows peut être arrêtée sans toucher au site :

```powershell
Disable-ScheduledTask -TaskName 'LyceeGest - Synchronisation EDT'
```

Les versions déjà reçues restent inactives tant qu'un humain ne les active pas.
Le déploiement Web précédent peut être réattaché au domaine indépendamment de la
tâche Windows.
