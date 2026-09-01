# Validation du classement assistant - état preview du 30 août 2026

## Périmètre

- Branche applicative : `codex/lycee-connect-prototype`.
- Base autorisée : preview `xijocumlwivhbmffrnlj` uniquement.
- Migration : `20260830090500_create_support_assistant_routing_reviews.sql`.
- Interrupteur : `SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED`, désactivé par défaut.
- Aucune donnée réelle, aucun email, aucun compte et aucune production.

## Contrat

L'assistant peut émettre un reçu HMAC valable quinze minutes. Il lie seulement
l'établissement, la catégorie, le service, l'origine IA ou locale et le modèle
éventuel. Il ne contient aucun message, nom, contact, document ou identifiant de
session. La demande reste créable si ce reçu manque, expire ou ne concorde pas.

Une proposition vérifiée est persistée une seule fois. Un agent peut la confirmer
sous MFA, ou la corriger par un transfert autorisé. Après cette décision, les
champs de liaison et le statut sont immuables. Les rôles `anon` et
`authenticated` n'ont aucun privilège direct ; seules les routes serveur utilisent
la table sous périmètre établissement.

## Vérifications locales

- Reçu : signature, altération, expiration, croisement de périmètre et modèle.
- Migration : clé composite vers la demande, unicité, RLS forcée et privilèges.
- API : attachement transactionnel, confirmation MFA et correction atomique.
- Interface : reçu hors mémoire appareil, décision visible et mise en page mobile.
- Agrégats : aucun contenu, identité ou coordonnée.
- Suites connexes : agent, routage, accès agent, concurrence, établissement et
  scénarios adversariaux.
- TypeScript et build réussis ; audit npm de production à zéro vulnérabilité.

## Activation preview

- Le connecteur a confirmé la branche `guichet-lycee-preview`, référence
  `xijocumlwivhbmffrnlj`, distincte du projet principal.
- La migration est présente sous sa version Git `20260830090500`. Le projet
  principal n'a jamais été ciblé ni interrogé pendant cette activation.
- La recette transactionnelle a été corrigée pour tester la clé composite avec
  une seconde demande fictive. Elle bloque les cinq attaques attendues, termine
  par `ROLLBACK` et laisse zéro utilisateur, établissement, demande ou revue de
  test.
- L'auditeur sécurité ne remonte que l'information attendue « RLS sans
  politique » : RLS est forcée et `anon`/`authenticated` n'ont aucun privilège.
  L'avis de clé étrangère sans index composite est couvert par l'unicité de
  `request_id`; ajouter un index redondant n'est pas justifié sur cette table.
- `SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED=true` est configuré comme variable
  Vercel de preview limitée à `codex/lycee-connect-prototype`.

## Recette applicative restante

Deux recettes bornées ont été ajoutées :

- `recipe:preview-support-assistant-routing-review` crée et supprime lui-même un
  compte fictif, son MFA et deux dossiers lorsque la clé de service preview est
  fournie localement ;
- `recipe:preview-routing-review-client` ne détient aucun privilège serveur et
  exécute seulement la connexion MFA, les API et les contrôles d'agrégats sur
  des fixtures préparées séparément.

La tentative du 30 août a confirmé que Vercel remplace huit secrets de preview
par le marqueur `[SENSITIVE]` lors de l'export local. Le script refuse désormais
explicitement ce marqueur. Une fixture SQL de diagnostic a aussi montré que la
création directe d'un utilisateur Auth n'est pas une voie de recette fiable ;
aucune décision applicative n'a été enregistrée. Toutes les lignes réservées ont
été supprimées et les compteurs utilisateur, identité, adhésion, MFA, session,
demande, revue et événement ont été contrôlés à zéro.

Le prochain contrôle reste donc applicatif : injecter localement une clé de
service de la preview, confirmer le premier dossier, corriger le second sous MFA,
vérifier les agrégats puis le nettoyage automatique. Ne jamais utiliser ce
protocole sur le projet Supabase principal.

## Vérification du 1er septembre 2026

Le contrôle non destructif de configuration confirme l'origine HTTPS de la
preview et la présence d'une clé de service masquée, pas utilisable. Il ne
révèle aucune valeur. Le connecteur confirme encore `guichet-lycee-preview`
distincte du projet principal, `with_data=false` et `ACTIVE_HEALTHY`.

Deux défauts des outils de recette ont été reproduits puis corrigés :

- Le premier segment du domaine ne suffisait pas à prouver la destination.
  `routing-review-preview-target.mjs` impose désormais l'origine HTTPS exacte,
  les deux références connues et une URL de déploiement sans alias de branche.
  Un refus ne réaffiche jamais l'URL ou sa valeur potentiellement sensible.
- Sous Windows, `spawnSync('npx.cmd', ...)` échouait avec `EINVAL`. Le lancement
  passe maintenant par Node et le point d'entrée JavaScript de npm, en mode
  hors ligne et sans installation. Un contrôle de version précède les clients
  Supabase et toute création de fixture. La disponibilité du Vercel 59.10.0
  déjà en cache a été vérifiée ; cela ne valide pas son authentification.

Le transport conserve des arguments distincts sans shell, masque les erreurs
du fournisseur et borne ses délais : connexion curl 10 secondes, requête
25 secondes et processus 45 secondes. Le contrôle de version a un délai de
15 secondes. Aucun paramètre de production ou secret n'est modifié.

`test:preview-routing-review-recipe-safety` exerce vingt refus dans les deux
vrais exécutables avec réseau interdit. Les deux configurations valides vont
seulement jusqu'au faux réseau ; le CLI est simulé pour ces essais. Le second
test contrôle le lancement natif, l'absence d'installation et les erreurs de
disponibilité. Ces essais ne créent aucun compte ni dossier.

La suite d'observabilité avait une assertion de source périmée : elle cherchait
le marqueur `assistantRoutingAttached` dans un objet JavaScript alors que
l'événement est construit en SQL paramétré. Le marqueur est toujours lié au
résultat de l'insertion. Le test suit maintenant cette écriture et contrôle
également le lien à l'appareil et le refus d'un reçu présenté mais invalide.
Il ne prétend plus que tout reçu incorrect laisse créer une demande.

Les tests d'observabilité et les six tests du reçu passent. La recette API
complète reste **non exécutée**, T030D3 reste ouverte. Avant toute exécution,
vérifier les métadonnées Vercel du déploiement choisi : la forme de son URL
n'atteste pas à elle seule son statut non production. Fournir la clé via le
gestionnaire de secrets, jamais dans une réponse ou un compte rendu.
Ces corrections d'outillage ont été vérifiées par Codex ; aucun nouvel audit
Claude ni coût externe n'a été engagé.

La barrière complète `test:preview-security-gate`, l'intégrité des spécifications
et `npm run build` passent après ces corrections. Le build conserve son
avertissement de taille du module XLSX ; ce lot ne modifie aucun écran ni asset.
Ces résultats locaux ne remplacent pas la recette authentifiée encore bloquée.

## Après la revue externe des recettes

Les jetons sont désormais transmis à curl par l'entrée standard, jamais par
argument de processus ou fichier temporaire. Le client sans clé serveur retire
le facteur MFA qu'il a créé avant de fermer sa propre session. Les deux recettes
n'annoncent une réussite qu'après leur nettoyage ; un échec impose de vérifier
les résidus de cette seule exécution avant tout nouveau run.

Exécuter sans autre manipulation concurrente des demandes de preview : les
mesures sont comparées à une valeur initiale globale. Le rôle de la fixture
reste celui nécessaire aux mesures Direction avec MFA ; une simple adhésion
administrative ne donne pas ce droit. Vérifier les métadonnées du déploiement
choisi reste obligatoire, même lorsque son URL ressemble à une preview.

La nouvelle mission Claude a coûté 0,632103 USD selon le CLI pour un seul passage
autorisé à 5 USD. Arbitrage :
`docs/audits/CLAUDE_ROUTING_RECIPE_REVIEW_ADJUDICATION_2026-09-01.md`.

## Contre-revue et garde Vercel executable

Une seconde mission, explicitement renouvelee, s'est terminee pour 0,742712 USD
selon le CLI. Les deux recettes interrogent maintenant les metadonnees Vercel
avant tout client Supabase : projet et equipe exacts, URL sans alias, branche
attendue, SHA complet, statut READY et environnement standard de preview.
Le champ brut `target: null` observe pour la preview est admis ; un champ absent,
la production ou un environnement personnalise sont refuses. Cette lecture ne
cree pas d'acces public et ne modifie pas le deploiement.

Les cles applicatives ne sont plus heritees par les processus du CLI. La seule
authentification Vercel necessaire est preservee. Une reponse Auth incomplete
produit un diagnostic generique, jamais une exception nulle ni un succes.
La verification automatique ne dispense pas de choisir le bon commit et de
ne pas promouvoir le deploiement pendant la recette.

Le controle reel en lecture seule passe pour `4f5575b`, mais la recette API
metier reste bloquee par la cle de service locale. Arbitrage et limites :
`docs/audits/CLAUDE_ROUTING_RECIPE_FOLLOWUP_ADJUDICATION_2026-09-01.md`.
