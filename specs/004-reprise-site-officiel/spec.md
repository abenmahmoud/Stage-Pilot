# Spécification - Reprise complète du site officiel

**Statut** : validée pour implémentation en preview
**Date** : 26 août 2026

## 1. Problème

Le portail LyceeGest doit pouvoir remplacer le site WordPress historique sans
perdre une page, une actualité, un document, une image ou un lien utile. Une
partie des informations date de 2023 à 2025 : elles doivent être récupérées,
mais ne doivent pas être présentées automatiquement comme actuelles en 2026.

## 2. Utilisateurs

- **Public** : retrouve les informations du lycée avec une navigation simple.
- **Administration** : corrige et complète les contenus repris.
- **Direction** : vérifie puis autorise leur publication.
- **Référent numérique** : contrôle l'exhaustivité, les liens et la bascule.

## 3. Parcours prioritaire

1. Le système inventorie les contenus et médias publics de WordPress.
2. Chaque contenu est importé comme brouillon avec sa source et sa date.
3. L'administration corrige le texte, les liens, les images et les documents.
4. La direction marque le contenu comme vérifié puis le publie.
5. Le public consulte les pages dans le nouveau portail.
6. Une comparaison finale confirme la reprise avant toute bascule du domaine.

## 4. Exigences fonctionnelles

- **FR-001** : inventorier toutes les pages, actualités, catégories et pièces
  publiques exposées par les API et sitemaps WordPress.
- **FR-002** : signaler séparément les médias annoncés par WordPress mais non
  accessibles par son API publique.
- **FR-003** : conserver l'adresse source, la date de dernière modification,
  l'identifiant WordPress et le type d'origine.
- **FR-004** : convertir le contenu HTML en Markdown sûr sans exécuter le HTML,
  les scripts, les formulaires intégrés ou les clés présentes dans les embeds.
- **FR-005** : importer sans suppression et de manière idempotente ; relancer
  l'import ne doit ni dupliquer ni écraser un contenu déjà corrigé.
- **FR-006** : placer chaque contenu importé en brouillon `à vérifier`.
- **FR-007** : interdire la publication d'un contenu importé tant qu'une
  personne habilitée ne l'a pas marqué comme vérifié.
- **FR-008** : afficher dans l'administration la source, la date historique et
  l'état de vérification.
- **FR-009** : reprendre les médias dans un stockage maîtrisé avant la bascule,
  avec inventaire des erreurs et relance possible.
- **FR-010** : proposer une page publique stable par adresse courte et conserver
  une table de redirections des anciennes adresses.
- **FR-011** : préserver les liens externes utiles en les contrôlant, notamment
  ENT, EduConnect, e-sidoc, Cyclades, Parcoursup, Onisep et formulaires.
- **FR-012** : distinguer les informations durables, les archives et les
  informations annuelles périmées ou à confirmer.
- **FR-013** : aucune bascule Hostinger, DNS ou production ne peut être déclenchée
  par l'import ; elle exige un ordre explicite après validation.
- **FR-014** : conserver un export daté et un rapport de correspondance afin de
  prouver ce qui a été repris ou reste à traiter.

## 5. Première version indispensable

- inventaire reproductible des 28 contenus et des médias accessibles ;
- brouillons importables dans la base de preview ;
- provenance et barrière de vérification dans l'espace contenus ;
- lecture publique des pages validées ;
- liste des redirections et rapport des écarts ;
- contrôle ordinateur, téléphone, liens et absence de débordement.

## 6. Utile après la reprise

- calendrier de révision annuelle par service ;
- détection automatique des liens cassés ;
- recherche unifiée dans les pages et documents ;
- statistiques anonymes pour prioriser les contenus utiles.

## 7. Exclu de cette étape

- publication automatique par l'IA ;
- copie des comptes WordPress ou de données privées ;
- reprise d'un mot de passe, d'un secret ou d'une clé d'intégration exposée ;
- modification du domaine principal avant recette et retour arrière préparé.

## 8. Critères de réussite

1. Les 28 URL publiques connues apparaissent dans le rapport de correspondance.
2. Tout écart entre le total déclaré et les éléments accessibles est visible.
3. Une relance de l'import ne crée aucun doublon.
4. Aucun contenu importé non vérifié ne peut être publié.
5. Les pages validées s'affichent correctement à 320 px et sur ordinateur.
6. Chaque ancienne URL dispose d'une destination ou d'une décision d'archive.
7. La bascule conserve une procédure de retour vers l'ancien site.
