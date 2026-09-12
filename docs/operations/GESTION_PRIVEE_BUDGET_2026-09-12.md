# Gestion privée et budget IA — 12 septembre 2026

## Demande et périmètre

Adel demande d’activer le suivi/plafonnement IA, de cacher l’espace agent public
et de le séparer des stages, avec fonctions distinctes pour superadmin et
administrateurs. Configuration initiale retenue : 1 € estimé par jour.

Entrée privée `/gestion`, demandes `/gestion/demandes`, budget
`/gestion/budget-ia`. Aucun bouton de gestion sur les pages publiques. L’ancien
`?view=agent` redirige en conservant le filtre de service valide. Les liens
historiques contenus dans les notifications restent donc utilisables.

Stages/Grand Oral gardent leur navigation et leur administration existantes.
Les rôles et services ne sont pas recréés : les permissions serveur existantes
continuent de s’appliquer. Les administrateurs et agents voient leurs outils
de traitement; la direction garde ses fonctions existantes; la nouvelle lecture
financière exige superadmin, assurance prévue par la politique actuelle et
appartenance administrative active au lycée. Aucune modification de compte.

## Budget et données

Même modèle OpenAI Luna conservé sur les cinq points d’appel, quatre opérations
comptables. Traduction ajoutée au garde partagé. Pas d’achat de crédit.
Les réservations sont atomiques, sérialisées sur la journée Paris; une
consommation connue clôt une réservation une seule fois. Le montant non utilisé
redevient disponible. Échec ou consommation inconnue : réservation conservée.
Consommation supérieure à l’enveloppe : nouveaux appels suspendus.

Enveloppe conservatrice 0,04 €/appel, requête JSON complète bornée à 150 Ko,
sortie 4 000 jetons maximum, marge supplémentaire de cadrage fournisseur.
Les tarifs explicites doivent couvrir cette enveloppe avant tout appel. Aucun
outil externe ni historique persistant n’est admis dans une requête plafonnée.
Les cinq chemins contrôlent le modèle tarifé. Hors enveloppe : repli existant,
aucune requête payante supplémentaire. Les demandes et réponses locales restent
accessibles quand le budget est indisponible.

Tarifs, change et variables non secrètes : `API_REGISTRY.md`. Les dépenses sont
des estimations hors taxes; les prix en dollars ne donnent pas une facture en
euros exacte. Les appels historiques au même modèle sont réestimés quand leurs
jetons ont été enregistrés. Les données inconnues restent signalées, pas zéro.
La page n’affiche ni coordonnées, ni conversations, ni secret fournisseur.

## Vérification

- Compilation et contrôle complet `test:preview-security-gate` réussis.
- Recette PostgreSQL 16 isolée : 60 appels concurrents, 25 réservations admises,
  35 refusées; libération idempotente sous concurrence, consommation inconnue
  conservée, tarif insuffisant refusé. Aucun accès à une base réelle dans cette
  recette et aucun email, SMS ou push émis.
- Route budget réelle avec vrai contrôle de rôle, d’assurance et d’appartenance;
  seul fournisseur d’authentification fictif. Anonymes, administration, agent,
  proviseur, élèves et professeurs refusés. Révocation de l’appartenance
  immédiatement prise en compte. Autre établissement exclu des métriques.
  RLS/permissions refusent la lecture directe aux clients et la suppression au
  rôle serveur. Réponse HTTP sans cache.
- Douze parcours navigateur fictifs réussis : 1440, 390 et 320 px, anonyme,
  superadmin, administration et agent. Navigation privée, disparition de
  l’entrée publique, séparation des stages, refus du budget aux autres rôles,
  lecture des demandes, menu clavier et disparition des chiffres en cas
  d’erreur serveur. Aucun débordement horizontal ni erreur JavaScript.
- Migration appliquée sur la branche active `guichet-lycee-preview`
  (`xijocumlwivhbmffrnlj`), RLS forcée vérifiée. Les seize variables non
  secrètes du budget sont limitées à Preview / `codex/lycee-connect-prototype`,
  projet Vercel `safe-scol/lyceegest`. Aucune clé remplacée.
- Publication : en cours de vérification.

Preuves locales : `../Gestion_privee_2026-09-12/`, journaux
`../gestion-budget-*.log`. Scripts unitaires dans le dépôt; recette SQL
`scripts/test-isolated-ai-budget.mjs`, uniquement sur base isolée vide.

## Limites qui restent distinctes

Pas de nouvelle autonomie accordée sur les codes, documents ou EDT non validés.
Pas d’envoi à une famille, pas de diffusion flash ni d’achat d’API dans ce lot.
L’activation des EDT, le remplissage du coffre et la réception push réelle
nécessitent leurs validations/recettes propres. Les permissions administratives
historiques des stages sont conservées; aucune réduction silencieuse de droits.
