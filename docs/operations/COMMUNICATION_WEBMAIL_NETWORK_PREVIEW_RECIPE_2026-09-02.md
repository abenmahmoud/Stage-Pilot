# Recette réseau LyceeGest vers faux Webmail

## Statut

Le client de recette est prêt mais **aucun appel réseau n'a été exécuté**. Le
faux Webmail n'existe pas encore et aucune variable distante n'est configurée.
Cette préparation ne ferme ni `005/T027`, ni `005/T029`, ni `005/T032`.

## But

Prouver le contrat HTTP entre LyceeGest et une application Webmail fictive
séparée, sans adresse, contact, envoi, fournisseur réel ou persistance métier.
La recette envoie 200 commandes opaques puis rejoue 20 dossiers déjà marqués
envoyés afin de vérifier l'absence de second effet côté LyceeGest.

## Cible temporaire obligatoire

La cible doit être un projet Vercel séparé, temporaire et nommé
`lyceegest-webmail-fixture`. Son déploiement doit :

- rester en preview avec `target=null`, idéalement en région `cdg1` ;
- utiliser uniquement une URL générée de la forme
  `lyceegest-webmail-fixture-…-safe-scol.vercel.app` ;
- n'exposer que `POST /api/fixture/challenge` et
  `POST /api/communications/deliveries` ;
- refuser toute autre méthode ou route ;
- ne journaliser ni en-tête, ni corps, ni jeton, ni secret ;
- ne conserver aucune commande et ne contacter ni Brevo, ni Gmail, ni le vrai
  Webmail, ni Supabase ;
- expirer au plus tard vingt-quatre heures après sa création.

Le point de challenge renvoie une preuve HMAC liée au run, au challenge aléatoire
et à son expiration. Le client refuse la livraison tant que cette preuve n'est
pas valide. Le point de livraison vérifie le Bearer et la commande signée, puis
produit un reçu signé avec une référence fournisseur fictive déterministe. Il
n'a besoin d'aucun stockage : le rejeu est contrôlé à partir de l'état déjà
envoyé côté LyceeGest.

## Secrets éphémères

Cinq valeurs aléatoires base64url, toutes distinctes, sont nécessaires :

1. Bearer partagé avec le client ;
2. secret de commande partagé ;
3. secret de reçu partagé ;
4. secret de preuve de fixture partagé ;
5. secret de hachage fournisseur, présent uniquement dans la fixture.

Elles mesurent de 43 à 128 caractères, ne sont jamais écrites dans Git, un
fichier, une commande enregistrée ou un rapport, et sont supprimées après la
recette. Les quatre premières sont injectées au processus local sous les noms :

- `PREVIEW_WEBMAIL_BEARER_TOKEN` ;
- `PREVIEW_WEBMAIL_DELIVERY_SECRET` ;
- `PREVIEW_WEBMAIL_RECEIPT_SECRET` ;
- `PREVIEW_WEBMAIL_FIXTURE_PROOF_SECRET`.

## Portes avant exécution

L'opérateur doit contrôler et fournir :

- `EXPECTED_WEBMAIL_FIXTURE_HOST`, égal au déploiement séparé exact ;
- `PREVIEW_WEBMAIL_FIXTURE_ENDPOINT`, égal à l'URL HTTPS exacte terminée par
  `/api/communications/deliveries`, sans paramètre ;
- `PREVIEW_WEBMAIL_NETWORK_RUN_ID`, au format
  `webmail-network-AAAAMMJJ-12hex` ;
- `CONFIRM_PREVIEW_WEBMAIL_NETWORK_RECIPE`, égal exactement à
  `<run-id>@<hôte-fixture>`.

Le client refuse le domaine public du lycée, le projet LyceeGest, une adresse
IP, un hôte local, un autre chemin, une redirection, des secrets faibles ou
réutilisés et l'absence du drapeau `--preview-only`.

## Exécution future

Après une autorisation écrite couvrant la création du projet temporaire, son
accès public borné, ses cinq secrets et son retrait :

```powershell
npm run recipe:preview-communication-webmail-network
```

Le résultat attendu ne contient que le run, les compteurs `accepted: 200` et
`duplicates: 20`, la mention de références opaques fictives et l'obligation de
nettoyage. Une seule erreur arrête la recette ; aucun succès partiel ne permet de
fermer une tâche.

## Preuves et nettoyage

Conserver uniquement : SHA LyceeGest, identifiant du déploiement fixture, heure,
résumé JSON sans secret, résultat des tests et vérification de retrait. Ensuite,
avec l'autorisation destructive correspondante : retirer les secrets, désactiver
la fixture, vérifier qu'elle n'est plus joignable et confirmer qu'aucune donnée
n'a été créée dans LyceeGest, Supabase, Brevo ou le Webmail réel.

## Autorisation requise

La phrase suivante couvre exactement le prochain lot et rien d'autre :

> J'autorise la création d'un faux Webmail Vercel temporaire séparé, uniquement
> en preview et sans donnée réelle, l'injection de cinq secrets éphémères,
> l'exécution unique de la recette réseau 200 + 20, puis son retrait contrôlé.

