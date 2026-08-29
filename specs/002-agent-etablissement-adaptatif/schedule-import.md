# Import prive des emplois du temps

## Sources examinees

Les deux exports dates du 25 aout 2026 ont ete examines localement :

- 102 pages pour les emplois du temps des professeurs ;
- 45 pages pour les emplois du temps des classes ;
- une grille hebdomadaire par page, avec cours, groupes, salles et alternances ;
- plusieurs groupes simultanes peuvent partager un meme creneau.

Aucun nom, horaire individuel ou contenu des PDF n'est ajoute a Git, aux
specifications ou a la preview.

## Decision proportionnee

L'extraction de texte brute n'est pas assez fiable pour transformer directement
toutes les grilles en creneaux : les colonnes de groupes se chevauchent dans le
PDF. La premiere version doit donc privilegier la preuve et la recherche rapide,
pas une reponse automatique incertaine.

1. Televerser le PDF dans un stockage prive reserve aux agents.
2. Enregistrer son empreinte, sa date d'effet, son type et son numero de version.
3. Indexer chaque page vers une classe ou un professeur apres controle humain.
4. Permettre a l'agent d'ouvrir la bonne page par un lien temporaire.
5. N'activer une nouvelle version qu'apres validation, en conservant la version
   precedente pour un retour arriere.
6. Ajouter la lecture detaillee des creneaux seulement apres constitution d'un
   jeu de controle et mesure du taux d'erreur.

## Regles de reponse de l'agent

- Ne jamais rendre public l'emploi du temps complet d'un professeur.
- Ne repondre qu'a la personne et au besoin autorises.
- Afficher la date de la source et signaler qu'un emploi du temps peut changer.
- En cas de doute, montrer la page source a l'agent humain au lieu d'inventer un
  horaire, une salle ou un professeur.
- PRONOTE ou l'outil officiel reste prioritaire lorsqu'une integration autorisee
  et plus recente est disponible.

## Autorisation et protections restantes

Le 27 août 2026, le propriétaire du projet a explicitement demandé d'utiliser
ces deux exports réels dans LyceeGest, projet Vercel `safe-scol/lyceegest`.
Cette autorisation est enregistrée et n'a pas besoin d'être redemandée pour
construire le flux d'import privé en preview.

Les fichiers ne doivent toutefois jamais être ajoutés à Git, intégrés au bundle
web ou servis par une URL publique.

Le 29 aout 2026, le socle suivant est appliqué uniquement à la preview :

- bucket `schedule-ingest` privé, PDF seulement, 50 Mo maximum ;
- tables serveur `schedule_source_versions`, `schedule_page_indexes` et
  `schedule_audit`, avec RLS forcée et droits client révoqués ;
- dépôt réservé à la direction sous MFA, version automatique et confirmation de
  la taille et du type reçus ;
- une seule version active par établissement, périmètre et année scolaire ;
- pages rattachées uniquement à une référence opaque de classe ou de personnel ;
- aucune activation depuis l'écran tant que les contrôles suivants manquent.

Avant le premier téléversement réel, il reste à installer et tester l'antivirus,
compter les pages, construire le rapprochement humain, ouvrir les pages par lien
temporaire audité, définir la conservation et vérifier les comptes nominatifs.
Tant que ces protections ne sont pas actives, les PDF restent uniquement sur le
poste local.

## Jalon technique du 29 août 2026

- La file durable `schedule_document_scan` est créée uniquement sur la preview,
  avec RLS forcée et aucun droit `anon` ou `authenticated`.
- La confirmation place désormais le PDF en quarantaine et crée atomiquement le
  travail d'analyse ; un ancien dépôt `uploaded` peut être repris sans double
  activation.
- Le worker préparé dans Git exécute ClamAV avant l'inspection PDF, vérifie la
  signature et la structure, calcule SHA-256 et compte au plus 500 pages.
- Aucun texte, nom, horaire, salle ou contenu du PDF n'est extrait et aucun
  fournisseur d'IA n'est appelé.
- Le worker n'est pas encore installé sur le VPS : l'état `review` ne sera donc
  opérationnel qu'après autorisation, installation additive et recette fictive
  comprenant un PDF sain, EICAR, reprise et nettoyage.
- Une version en `review` possède maintenant un poste de rapprochement vertical,
  sans tableau horizontal : chaque page reçoit une référence opaque puis une
  validation distincte. Modifier une ligne vérifiée la repasse en brouillon.
- La base refuse une page supérieure au comptage vérifié, un type classe/personnel
  incompatible et toute modification lorsque la source n'est plus en `review`.
- La direction peut ouvrir le PDF entier par un lien privé de 60 secondes sous
  MFA, avec audit et réponse `no-store`. Ce lien administratif ne constitue pas
  encore le futur lien limité à une page pour l'agent.
