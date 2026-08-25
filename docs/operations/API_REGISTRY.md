# Registre des API externes

Dernière vérification : 2026-08-25

## Assistant OpenAI

| Champ | Valeur |
| --- | --- |
| Application | Portail numérique du Lycée Blaise Cendrars |
| Finalité | Comprendre un message libre, proposer une première aide et classer une demande |
| Fournisseur | OpenAI |
| Transport | Responses API, `store: false` |
| Modèle | `gpt-5.6-luna` |
| Secret serveur | `OPENAI_API_KEY` |
| Sélection du modèle | `OPENAI_SUPPORT_MODEL` |
| Données envoyées | Dix messages maximum après masquage des emails, téléphones, noms déclarés et secrets; extension, type et taille approximative des fichiers |
| Données non envoyées | Contenu des fichiers, coordonnées structurées du formulaire, mots de passe et codes secrets |
| Réponse attendue | JSON structuré : réponse, catégorie, urgence, informations manquantes et documents suggérés |
| Limites applicatives | 30 analyses par appareil et 300 par adresse réseau sur 10 minutes dans l'aperçu; 8 000 caractères par conversation |
| Repli | Classification locale déterministe, sans appel payant |
| Budget | Aperçu protégé uniquement; plafond fournisseur et suivi de coût obligatoires avant ouverture publique |
| Conservation | Requête envoyée avec `store: false`; revérifier les contrôles du projet OpenAI avant la production |
| Région | Service externe; aucune garantie de résidence UE enregistrée à ce stade |
| Responsable de rotation | ESSUF GROUP SASU / administrateur du projet |

## Conditions d’activation publique

- Créer une clé dédiée à cette application et à son environnement.
- Fixer un plafond mensuel et des alertes dans le compte fournisseur.
- Remplacer la limite mémoire de l'aperçu par un quota distribué et le pare-feu
  Vercel avant l'ouverture publique.
- Faire valider l’information aux usagers et le traitement des données par le responsable du lycée.
- Vérifier le repli local, les réponses mal formées, les quotas et l’absence du secret dans le navigateur et les journaux.

## Brevo transactionnel

| Champ | Valeur |
| --- | --- |
| Application | Guichet numérique du Lycée Blaise Cendrars |
| Finalité | Accusés de réception, alertes agent et réponses validées |
| Secret serveur | `BREVO_API_KEY` |
| Exécution | Worker VPS isolé, lot borné chaque minute |
| Expéditeur de preview | `blaise.cendrars.contact@gmail.com` |
| File durable | Supabase PGMQ `support_jobs` |
| Fiabilité | Idempotence, cinq tentatives, journal et file d’échec |
| État | Sortant vérifié avec succès le 25 août 2026 |
| Non terminé | Domaine entrant, webhook de réponse et suivi de délivrabilité en production |
