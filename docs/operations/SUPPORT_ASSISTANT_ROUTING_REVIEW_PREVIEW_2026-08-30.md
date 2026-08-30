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

## Blocage distant et reprise

Le connecteur Supabase actif ne trouve pas `xijocumlwivhbmffrnlj` et les fichiers
locaux contiennent des valeurs `[SENSITIVE]` non exploitables. Aucune migration
n'a donc été appliquée. Le code est protégé par l'interrupteur désactivé et peut
être déployé sans lire la table absente.

Pour reprendre avec une URL de base preview prouvée :

1. Exécuter le script verrouillé avec `--check`.
2. Exécuter `--rollback-test`.
3. Exécuter `--apply`.
4. Exécuter `--recipe` et vérifier zéro résidu.
5. Contrôler les auditeurs sécurité et performance Supabase.
6. Activer l'interrupteur uniquement sur la preview, redéployer puis tester deux
   dossiers fictifs : une confirmation et une correction.

Ne jamais utiliser ce script avec la référence principale et ne jamais activer
l'interrupteur avant la recette réussie.
