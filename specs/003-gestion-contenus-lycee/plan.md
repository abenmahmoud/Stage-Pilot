# Plan - Gestion des contenus du lycée

## Architecture proportionnée

- **Interface interne** : nouvelle page `/admin/contenus` dans l'espace
  authentifié existant.
- **Lecture publique** : API dédiée ne renvoyant que les contenus publiés et non
  expirés, consommée par la rubrique « À la une » du portail.
- **Écriture** : API serveur avec vérification du rôle et MFA progressive déjà
  utilisée par le projet.
- **Données** : tables séparées pour contenus, modèles, fichiers, liaisons,
  versions et audit.
- **Fichiers** : bucket Supabase privé `site-content`, liens signés de courte
  durée, dépôt direct signé après autorisation serveur.
- **Édition** : Markdown rendu par une bibliothèque sans HTML brut.
- **IA** : endpoint serveur OpenAI, `store: false`, sortie structurée, limites
  quotidiennes et aucune action de publication.

## Autorisations

| Action | Administration | Proviseur | Superadmin |
| --- | --- | --- | --- |
| Lire et créer | Oui | Oui | Oui |
| Modifier un brouillon | Oui | Oui | Oui |
| Demander validation | Oui | Oui | Oui |
| Publier ou archiver | Non | Oui | Oui |
| Gérer les modèles | Non | Oui | Oui |
| Utiliser l'aide IA | Oui | Oui | Oui |

## Sécurité

- Tables publiques avec RLS activée mais sans droit direct `anon` ou
  `authenticated` ; les API serveur restent l'unique passage.
- Rôles tirés de `app_metadata`, jamais de métadonnées modifiables par l'usager.
- Aucune suppression physique dans les routes V1.
- Validation stricte des longueurs, types, slugs, statuts et dates.
- Les réponses d'administration sont projetées aux seuls champs de l'écran et
  validées avant tout remplacement d'état ou message de réussite ; acteurs,
  chemins privés et métadonnées SQL restent côté serveur.
- Fichiers privés, types et tailles limités, noms de stockage aléatoires.
- La confirmation relit au plus 10 Mo et vérifie la signature binaire avant tout
  état utilisable. Le pilote avec fichiers réels reste fermé jusqu'à la mise en
  quarantaine et au reçu `clean` du worker antivirus.
- Contenu Markdown rendu sans HTML brut afin d'éviter les scripts injectés.
- Liens publics signés et courts ; un brouillon ne reçoit aucun lien public.
- IA limitée et isolée de la publication.
- Les propositions IA suivent le même schéma exact côté fournisseur, serveur et
  navigateur ; aucune sortie libre n'est appliquée au brouillon.
- Les modèles utilisent une version attendue pour refuser l'écrasement silencieux
  d'une modification concurrente.

## Livraison

1. Migration additive uniquement sur la branche Supabase de preview.
2. API et interface derrière l'authentification existante.
3. Tests unitaires des validateurs et du workflow.
4. Vérification manuelle ordinateur et téléphone.
5. Publication sur la branche Vercel de preview uniquement.
