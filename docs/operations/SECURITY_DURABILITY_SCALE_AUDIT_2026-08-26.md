# Audit securite, durabilite et charge - 26 aout 2026

## Perimetre verifie

- Depot : `abenmahmoud/Stage-Pilot`.
- Branche : `codex/lycee-connect-prototype`.
- Application : portail du Lycee Blaise Cendrars / LyceeGest.
- Base auditee : branche Supabase de preview `guichet-lycee-preview`.
- Aucun changement sur la base principale, le VPS, Hostinger, les DNS ou le
  Webmail du Lycee.

## Verdict actuel

La preview possede un socle coherent pour poursuivre le pilote et les
demonstrations. Elle n'est pas encore autorisee pour une ouverture generale avec
des donnees reelles : la restauration, le MFA des agents, les regles de
conservation, la protection des mots de passe compromis et les tests complets de
roles restent a fermer.

Trois mille visites mensuelles representent environ cent visites par jour et ne
constituent pas, seules, une charge difficile pour cette architecture. Le vrai
scenario a proteger est le pic de rentree : plusieurs centaines de personnes
peuvent ouvrir l'aide, creer un dossier ou envoyer un fichier dans une courte
periode, depuis la meme connexion du lycee.

## Controles valides

### Base et relations

- Toutes les cles etrangeres connues disposent d'un index de couverture.
- Aucun contact, evenement de livraison, fichier ou rappel orphelin n'a ete
  detecte dans la preview.
- Les fichiers ne peuvent plus referencer un message appartenant a un autre
  dossier.
- Les rappels telephoniques ne peuvent plus referencer un contact appartenant a
  un autre dossier.
- Un contact doit appartenir a un dossier; un seul contact principal actif et
  une seule valeur active identique par canal sont autorises par dossier.
- Les tables du guichet ont RLS active, aucune politique publique et aucun droit
  direct pour `anon` ou `authenticated`. Les routes serveur sont l'unique entree.

### Securite corrigee

- `get_role()` est maintenant `SECURITY INVOKER`, inaccessible a `anon` et avec
  un `search_path` fixe.
- `set_updated_at()` utilise un `search_path` fixe.
- Les politiques historiques sont limitees a `authenticated` et les fonctions
  d'identite stables sont evaluees une fois par requete SQL.
- Quatre index ordinaires redondants de `professeurs` ont ete retires; les
  contraintes uniques equivalentes restent presentes.
- Le limiteur de debit est atomique en base et commun a toutes les instances
  Vercel. Il ne conserve que des empreintes HMAC, jamais l'adresse IP brute.
- Les seuils reseau autorisent au moins 200 personnes derriere le meme NAT du
  lycee; la limite par session reste plus stricte pour contenir les abus.
- Le test du limiteur a accepte la limite, refuse l'appel suivant puis nettoye
  sa donnee d'essai.

### Fiabilite deja en place

- Creation et messages transactionnels avec cles d'idempotence uniques.
- Sessions appareil et jetons d'acces stockes sous forme d'empreintes.
- Emails et analyses de fichiers places dans des files Postgres durables `pgmq`.
- Reprises, tentatives, file d'echec et evenements de livraison conserves.
- Stockage prive avec quarantaine avant antivirus.
- Au moment de l'audit : aucune tache email ou fichier en attente, aucun scan en
  erreur et aucun job echoue non repris.
- Client Postgres Vercel limite a une connexion par instance via le pooler.

### Construction

- `npm run build` reussit.
- `npm audit --omit=dev` : aucune vulnerabilite connue.
- Le test de charge est protege par une confirmation `preview-only`, cree une
  file temporaire, isole chaque execution et nettoie demandes, sessions et file
  meme en cas d'erreur.

## Points encore ouverts

### Bloquants avant donnees reelles a grande echelle

1. Activer la protection Supabase contre les mots de passe compromis.
2. Imposer des comptes agents individuels et le MFA; supprimer tout code partage.
3. Faire valider les mentions, finalites, durees, purge et droits par la
   direction et le DPO.
4. Mettre en place une sauvegarde chiffree de la base et du stockage, puis
   restaurer un dossier et un fichier dans un environnement isole.
5. Verifier de nouveau les deux workers VPS, leurs timers, journaux et alertes
   avant le pilote reel.
6. Terminer les tests RLS par role, webhooks rejoues, panne Brevo, pieces
   falsifiees, jetons expires et injections de consignes.

### Performance et exploitation

- Les anciennes tables Stages, Grand Oral et documents ont encore plusieurs
  politiques RLS permissives equivalentes. Leur fusion attend des tests de roles
  complets; ce n'est pas un risque de capacite pour 3 000 visites mensuelles.
- Le test de 200 creations simultanees a deja ete inscrit comme valide dans la
  specification. Le nouveau script nettoyable n'a pas ete relance sur ce poste,
  car aucune URL de connexion directe a la base de preview n'y est chargee.
- Ajouter des seuils d'alerte : age du plus vieux job, nombre de jobs en echec,
  scans bloques, taux d'erreurs API, temps de reponse p95 et taux de rejet Brevo.
- Les ecrans historiques sont maintenant charges a la demande : l'entree
  principale est passee d'environ 658 ko a 452 ko avant compression. Le module
  tableur d'environ 500 ko reste isole et ne se charge que dans l'import admin.
- La politique de nettoyage des anciennes limites de debit et des sessions
  expirees doit etre automatisee avant une exploitation pluriannuelle.

## Objectifs de validation du pilote

- 200 creations concurrentes, 200 dossiers, 200 messages, 200 liaisons de
  session et zero doublon inattendu.
- API creation p95 inferieur a 1,5 seconde hors notification externe.
- Aucun dossier perdu lorsque Brevo ou OpenAI est indisponible.
- La file se resorbe apres retablissement et chaque envoi reste idempotent.
- Un fichier bloque ne quitte jamais la quarantaine.
- Un utilisateur ne peut lire aucun autre dossier avec un numero public seul.
- Une restauration documentee recree un dossier, son fil, ses evenements et son
  fichier propre sans utiliser la production.

## Decision de mise en ligne

- **Demonstration protegee** : oui.
- **Pilote limite avec donnees fictives** : oui.
- **Pilote reel restreint** : apres fermeture des six blocants ci-dessus.
- **Remplacement du site officiel** : non, tant que contenus, retour arriere,
  accessibilite, DPO et exploitation ne sont pas valides.
