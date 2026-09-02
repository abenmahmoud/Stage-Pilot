# Recette réseau LyceeGest vers faux Webmail

## Statut

La recette a été exécutée une seule fois le 2 septembre 2026, puis entièrement
nettoyée. Elle ferme `005/T027` et `005/T032`. Elle ne remplace pas les preuves
transactionnelles et de reprise déjà suivies séparément sous `005/T029`.

Preuve détaillée :
`docs/operations/COMMUNICATION_WEBMAIL_NETWORK_PREVIEW_EVIDENCE_2026-09-02.md`.

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

Vercel classe le premier déploiement d'un projet neuf comme production. Après
autorisation distincte, l'exécution a donc utilisé une amorce HTML vide, sans
fonction ni secret, protégée par SSO. Cette amorce est restée protégée pendant
la construction de la vraie preview, puis a été supprimée et sa disparition
vérifiée avant la désactivation du SSO de la fixture. La recette applicative
n'a utilisé que le déploiement `target=null`.

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

## Exécution réalisée

L'exécution autorisée a utilisé la commande suivante une seule fois, après les
contrôles de cible, de preuve et d'environnement :

```powershell
npm run recipe:preview-communication-webmail-network
```

Le résultat obtenu contient uniquement le run, `accepted: 200`,
`duplicates: 20`, la mention de références opaques fictives et l'obligation de
nettoyage. Aucune reprise automatique du run réseau n'a été effectuée.

## Preuves et nettoyage

Sont conservés uniquement : SHA LyceeGest, identifiants des déploiements
temporaires, heures, résumé JSON sans secret, résultats des tests et preuve de
retrait. Le projet Vercel n'apparaît plus dans l'inventaire de l'équipe et son
ancienne URL n'est plus récupérable. Aucun objet n'a été créé dans LyceeGest,
Supabase, Brevo ou le Webmail réel.

## Autorisations utilisées

L'autorisation a couvert exactement le projet temporaire, les cinq secrets, le
run unique et le retrait. Une seconde confirmation a couvert l'ordre technique
imposé par Vercel : conserver l'amorce vide sous SSO pendant le build de la
preview, puis la supprimer avant l'accès public temporaire et la recette.

> J'autorise la création d'un faux Webmail Vercel temporaire séparé, uniquement
> en preview et sans donnée réelle, l'injection de cinq secrets éphémères,
> l'exécution unique de la recette réseau 200 + 20, puis son retrait contrôlé.
