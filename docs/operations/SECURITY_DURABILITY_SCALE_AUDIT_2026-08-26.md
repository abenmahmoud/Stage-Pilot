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
- Chaque jeton email cible un contact precis; il ne valide plus toutes les
  adresses d'un meme dossier et son usage est limite par réseau.
- Le reçu du webhook entrant, le message, l'evenement et la mise en file sont
  maintenant atomiques : une panne intermediaire laisse Brevo relancer le flux.
- La confirmation d'identite scolaire exige un lien existant vers la liste
  officielle. Avant ce rapprochement, les demandes ENT et email academique
  utilisent seulement une consigne de verification controlee par le serveur.
- La reservation des fichiers est serialisee par dossier, y compris lorsque
  plusieurs depots commencent en meme temps.
- Emails et analyses de fichiers places dans des files Postgres durables `pgmq`.
- Reprises, tentatives, file d'echec et evenements de livraison conserves.
- Stockage prive avec quarantaine avant antivirus.
- Au moment de l'audit : aucune tache email ou fichier en attente, aucun scan en
  erreur et aucun job echoue non repris.
- Client Postgres Vercel limite a une connexion par instance via le pooler.
- Les migrations historiques absentes du depot ont ete recuperees depuis le
  journal Supabase, sans exporter de donnees utilisateur.

### Construction

- `npm run build` reussit.
- `npm audit --omit=dev` : aucune vulnerabilite connue.
- Le test de charge est protege par une confirmation `preview-only`, cree une
  file temporaire, isole chaque execution et nettoie demandes, sessions et file
  meme en cas d'erreur.

### Verification de la preview publiee

- Commit verifie : `6312dce`.
- Deploiement Vercel : `lyceegest-erf64ut7i-safe-scol.vercel.app`, etat `Ready`.
- Alias stable mis a jour :
  `lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app`.
- La publication a ete declenchee par Git sur la branche qui possede les
  variables Supabase de preview. Aucun deploiement manuel n'a ete utilise.
- Accueil `200`, manifeste PWA valide, liste publique sans session `200` et vide.
- Console agent sans authentification refusee `401`.
- Webhook Brevo sans secret refuse `401`.
- Assistant de preview `200`, reponse structuree et avertissement de ne jamais
  transmettre un mot de passe ou un code secret.
- Aucun journal Vercel de niveau erreur sur cette branche dans les 24 heures
  precedant la publication ni pendant les tests apres deploiement.
- Verification visuelle locale du build : aucune image cassee et aucun
  debordement horizontal a `1440x900`, `390x844` et `320x700`; aucun bouton ne
  sort de l'ecran dans ces trois vues.

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
7. Executer une reconstruction complete depuis les migrations dans une base
   jetable avant de declarer la procedure de reprise validee.

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

## Verification complementaire apres audit externe

- Commit de code : `74ee3e2`.
- Deploiement Git de preview :
  `lyceegest-f0lsl9bje-safe-scol.vercel.app`, etat `Ready`.
- L'alias stable de la branche pointe sur ce deploiement.
- Page du prototype `200`; liste publique sans session `200` et vide; console
  agent sans authentification `401`; webhook sans secret `401`; jeton mal forme
  `400`.
- Test synthetique avec deux contacts email : le jeton cible a retourne `200`,
  l'adresse destinataire a seule ete verifiee, l'autre est restee non verifiee,
  puis le dossier d'essai a ete supprime.
- Apres la migration, zero empreinte reseau dans les dossiers, zero jeton mal
  rattache, zero droit direct public sur les tables support, zero job echoue non
  repris et zero scan en attente ou en erreur.
- Aucun journal Vercel de niveau erreur n'a ete trouve pendant ces controles.
- Le conseiller Supabase ne remonte plus d'alerte de schema support; la
  protection des mots de passe compromis reste la seule alerte de securite de
  niveau avertissement. Les tables support sans politiques restent des infos
  intentionnelles : RLS est activee et les roles clients n'ont aucun droit.
