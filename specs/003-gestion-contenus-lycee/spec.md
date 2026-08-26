# Spécification - Gestion des contenus du lycée

**Statut** : validée pour implémentation en preview
**Date** : 26 août 2026

## 1. Problème

Le lycée publie chaque semaine des informations, dates, articles et documents.
Le référent numérique et la direction doivent pouvoir les mettre à jour sans
modifier le code ni dépendre d'un prestataire. Une erreur de publication, un
document périmé ou une information non validée aurait un impact immédiat sur les
élèves, parents et personnels.

## 2. Utilisateurs

- **Administration** : prépare et modifie les brouillons.
- **Proviseur** : valide, publie, programme, archive et restaure une version.
- **Superadministrateur** : mêmes droits que la direction et gestion des modèles.
- **Public** : consulte uniquement les contenus publiés, en cours de validité.

L'espace agent devient l'espace administratif interne. Il regroupe les demandes
et la gestion éditoriale, mais conserve des droits distincts selon l'action.

## 3. Parcours prioritaire

1. L'éditeur choisit un type et un modèle.
2. Il saisit ou fait reformuler le titre, le résumé et le contenu.
3. Il ajoute une image ou des documents publics.
4. Il contrôle l'aperçu ordinateur et téléphone.
5. Il enregistre un brouillon ou demande une validation.
6. Une personne habilitée publie immédiatement ou programme la publication.
7. Le site public affiche uniquement la version validée.
8. Chaque modification crée une version récupérable et une trace d'audit.

## 4. Exigences fonctionnelles

- **FR-001** : gérer les types `article`, `alerte`, `page` et `document`.
- **FR-002** : proposer les états `brouillon`, `à valider`, `publié` et `archivé`.
- **FR-003** : permettre titre, résumé, contenu riche sûr, catégorie, public,
  image, documents, mise en avant, dates de publication et d'expiration.
- **FR-004** : fournir des modèles éditables et duplicables, sans les lier au
  code de l'application.
- **FR-005** : proposer au départ les modèles actualité, information urgente,
  événement, document administratif et information de formation.
- **FR-006** : l'aide IA peut rédiger, raccourcir, corriger, simplifier ou
  proposer un titre à partir du brouillon. Elle ne publie jamais.
- **FR-007** : toute sortie IA reste modifiable et doit être acceptée
  explicitement par l'éditeur.
- **FR-008** : ne transmettre à l'IA ni liste nominative, ni coordonnées
  personnelles, ni document brut, ni secret.
- **FR-009** : conserver une version immutable à chaque enregistrement important
  et permettre la restauration en créant une nouvelle version.
- **FR-010** : archiver au lieu de supprimer définitivement depuis l'interface.
- **FR-011** : stocker les fichiers dans un espace privé et ne produire un lien
  temporaire que pour un contenu publié ou un agent autorisé.
- **FR-012** : accepter PDF, images, Word et Excel jusqu'à 10 Mo, avec nom,
  description et texte alternatif obligatoires selon le type.
- **FR-013** : le public ne voit que les contenus publiés dont la date d'effet
  est passée et la date d'expiration non atteinte.
- **FR-014** : permettre recherche, filtres par type, statut et catégorie, ainsi
  que duplication d'un contenu.
- **FR-015** : afficher un aperçu fidèle sur ordinateur et téléphone avant
  publication.
- **FR-016** : enregistrer auteur, valideur, action et date sans journaliser le
  contenu complet dans les logs techniques.

## 5. Première version indispensable

- liste, recherche et filtres ;
- création et édition depuis un modèle ;
- éditeur Markdown avec titres, gras, listes, liens et citations ;
- brouillon, validation, publication, programmation, expiration et archivage ;
- documents et images ;
- versions et restauration ;
- aide IA de rédaction contrôlée ;
- page publique « À la une » alimentée par les contenus publiés ;
- interface responsive et accessible.

## 6. Utile plus tard

- calendrier éditorial partagé ;
- traduction relue par un humain ;
- diffusion vers email, PWA ou réseaux après confirmation ;
- statistiques de consultation sans profilage individuel ;
- blocs de pages avancés et réutilisables ;
- circuit de validation par service.

## 7. Exclu ou trop complexe pour la V1

- publication autonome par l'IA ;
- constructeur visuel sans limites pouvant casser la charte ;
- modification directe du HTML ou exécution de scripts ;
- import automatique de documents non vérifiés ;
- suppression définitive depuis l'interface courante.

## 8. Critères de réussite

1. Un agent crée un brouillon depuis un modèle en moins de trois minutes.
2. Un brouillon ou document non publié est inaccessible au public.
3. Une publication apparaît dans « À la une » sans redéploiement du site.
4. Une expiration retire automatiquement le contenu de la lecture publique.
5. Une restauration ne détruit aucune version précédente.
6. L'IA ne peut ni publier ni recevoir un fichier ou des données personnelles.
7. Les parcours principaux ne débordent pas à 320 px.
