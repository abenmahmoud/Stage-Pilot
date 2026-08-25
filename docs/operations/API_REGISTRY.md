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
| Limites applicatives | 20 analyses par navigateur et adresse réseau sur 10 minutes; 8 000 caractères par conversation |
| Repli | Classification locale déterministe, sans appel payant |
| Budget | Aperçu protégé uniquement; plafond fournisseur et suivi de coût obligatoires avant ouverture publique |
| Conservation | Requête envoyée avec `store: false`; revérifier les contrôles du projet OpenAI avant la production |
| Région | Service externe; aucune garantie de résidence UE enregistrée à ce stade |
| Responsable de rotation | ESSUF GROUP SASU / administrateur du projet |

## Conditions d’activation publique

- Créer une clé dédiée à cette application et à son environnement.
- Fixer un plafond mensuel et des alertes dans le compte fournisseur.
- Faire valider l’information aux usagers et le traitement des données par le responsable du lycée.
- Vérifier le repli local, les réponses mal formées, les quotas et l’absence du secret dans le navigateur et les journaux.
