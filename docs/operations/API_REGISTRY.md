# Registre des API externes

Dernière vérification du module OpenAI : 2026-09-12. Les autres fournisseurs conservent leurs dates propres.

## Assistant OpenAI

| Champ | Valeur |
| --- | --- |
| Application | Portail numérique du Lycée Blaise Cendrars |
| Finalité | Réponses du guichet, préparation d’articles et d’hebdos, brouillons de communications, traduction des réponses humaines |
| Fournisseur | OpenAI |
| Transport | Responses API, `store: false` |
| Modèle | `gpt-5.6-luna` |
| Secret serveur | `OPENAI_API_KEY` |
| Sélection du modèle | `OPENAI_SUPPORT_MODEL`, `OPENAI_CONTENT_MODEL`, `OPENAI_COMMUNICATION_MODEL`, `OPENAI_SUPPORT_TRANSLATION_MODEL`; même modèle tarifé pour ce lot |
| Données envoyées | Fenêtre de conversation bornée après pseudonymisation, extraits de sources autorisées; texte préparé par l’éditeur pour les aides éditoriales et la traduction |
| Données non envoyées | Contenu des fichiers, coordonnées structurées du formulaire, mots de passe et codes secrets |
| Réponse attendue | JSON structuré : réponse, catégorie, urgence, informations manquantes et documents suggérés |
| Limites applicatives | Quotas distribués existants; requête fournisseur complète ≤ 150 000 octets, sortie ≤ 4 000 jetons; aucun outil distant, conversation persistante ni modèle non tarifé sous plafond actif |
| Repli | Classification locale déterministe, sans appel payant |
| Budget applicatif | Configuration initiale 1 € estimé/jour, Paris; réservation conservatrice de 0,04 €/appel, puis libération de la part inutilisée; réponse inconnue conservée; anomalie de coût suspend les nouveaux appels jusqu’au jour suivant |
| Prix vérifié | Standard : 0,20 USD/million de jetons entrants, 1,20 USD/million de jetons sortants; cache et remises ignorés pour rester conservateur |
| Conversion indicative | BCE 11 septembre 2026 : 1 EUR = 1,1592 USD; tarifs arrondis à 0,172533 EUR et 1,035197 EUR/million de jetons; hors taxes et frais bancaires |
| Supervision | `/gestion/budget-ia`, superadmin authentifié et membre actif du lycée; agrégats uniquement, historique de 30 jours, aucune clé affichée |
| Conservation | Requête envoyée avec `store: false`; revérifier les contrôles du projet OpenAI avant la production |
| Région | Service externe; aucune garantie de résidence UE enregistrée à ce stade |
| Responsable de rotation | Administrateur désigné par la direction du lycée |

## Conditions d’activation publique

- Créer une clé dédiée à cette application et à son environnement.
- Fixer un plafond mensuel et des alertes dans le compte fournisseur.
- Revalider le quota distribué et compléter la protection réseau avant
  l'ouverture publique.
- Faire valider l’information aux usagers et le traitement des données par le responsable du lycée.
- Vérifier le repli local, les réponses mal formées, les quotas et l’absence du secret dans le navigateur et les journaux.

Le budget applicatif ne configure pas le compte fournisseur et ne constitue pas
une limite sur sa facture bancaire. Aucun achat ni nouveau fournisseur dans ce
lot. Les réglages du compte OpenAI (alertes, recharge, conservation, résidence)
restent à contrôler par son propriétaire. `store: false` n’est pas une garantie
d’absence de journaux techniques chez le fournisseur.

Sources : [tarifs OpenAI](https://developers.openai.com/api/docs/pricing),
[cours BCE](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html).
Mise en place et preuves : `GESTION_PRIVEE_BUDGET_2026-09-12.md`.

## Brevo transactionnel

| Champ | Valeur |
| --- | --- |
| Application | Guichet numérique du Lycée Blaise Cendrars |
| Finalité | Accusés de réception, alertes agent et réponses validées |
| Secret serveur | `BREVO_API_KEY` |
| Exécution | Worker VPS isolé, lot borné chaque minute |
| Expéditeur de preview | Variable serveur `SUPPORT_FROM_EMAIL`, adresse validée par la direction |
| File durable | Supabase PGMQ `support_jobs` |
| Fiabilité | Idempotence, cinq tentatives, journal et file d’échec |
| État | Sortant vérifié avec succès le 25 août 2026 |
| Non terminé | Domaine entrant, webhook de réponse et suivi de délivrabilité en production |
