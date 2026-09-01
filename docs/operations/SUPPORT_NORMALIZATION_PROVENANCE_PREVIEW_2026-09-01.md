# Provenance des résumés - preview

## Périmètre

Suite du constat P2 de l'audit Fable 5.1 au commit `135c822`. Ce document
rapporte une correction et des vérifications Codex, pas une nouvelle validation
de Claude. T049C1 est locale ; T049C et l'ouverture élargie restent ouvertes.

## Comportement

- L'API d'analyse signe le résultat déjà obtenu, sans appel IA supplémentaire.
- Le reçu expire après quinze minutes. Il lie établissement, catégorie, appareil
  et empreinte de la conversation, description, langue et résumé normalisés.
- L'empreinte du contenu est elle-même un HMAC : un tiers sans secret ne peut
  pas tester un dictionnaire de textes contre un hash visible. Aucun texte ni
  coordonnées en clair n'est présent dans le reçu.
- La création ignore les statuts, preuves ou identités déclarés par le client.
  Elle vérifie la signature et persiste la provenance dans la transaction.
- Un reçu absent, mal formé, expiré, altéré ou d'un autre périmètre donne
  `fourni_par_demandeur`, sans rejeter une demande par ailleurs valide.
- L'espace agent distingue « Résumé de l'assistant en français » et « Résumé
  transmis en français ». Les deux renvoient aux messages originaux.
- La signature atteste l'origine du résumé seulement. Ni identité, ni vérité
  des propos, ni pièce jointe, ni décision administrative ne sont certifiées.
- Le reçu a un domaine cryptographique distinct du reçu d'outil : aucune
  substitution ne permet de créer une autorisation d'action ou de routage.
- Aucun jeton de provenance dans le brouillon appareil ou les sorties publiques.
  Seuls le statut, l'empreinte du reçu et sa date restent dans le dossier privé.

## Vérifications exécutées

- `test:support-normalization` : 13 tests, dont les vrais gestionnaires HTTP
  transpilés, le parseur réel et la preuve réelle avec dépendances fictives.
  La frontière d'écriture est interceptée avant toute mutation de base.
- Altération de chaque texte ou rôle, périmètre différent, signature invalide,
  borne exacte d'expiration, revendications surnuméraires, temps impossibles,
  absence de secret, fallback sans IA, historique maximal et troncature testés.
- `test:support-assistant-client-payload` : 9 tests ; `test:support-multilingual` :
  4 ; régressions du précédent audit : 18 ; contrats responsive : 4.
- `build` et `test:preview-security-gate` passent. L'avertissement de taille
  du module XLSX préexistant demeure.
- Fixture navigateur locale : extraction par l'AST TypeScript du véritable bloc
  de résumé, rendu React avec les libellés et CSS réels. Cas signé et ancien
  statut non vérifié, paragraphes fictifs longs. Largeur du document 305 px
  (barre verticale) pour un cadre de 320 px, et 1 440 px pour un cadre de
  1 440 px ; aucun élément du bloc hors cadre. Captures inspectées.

## Limites et suite

Aucune connexion privée, vraie création de dossier, requête IA, notification,
migration ou mutation distante dans cette recette. Le signal d'appareil reste
renouvelable et ne prouve jamais une identité. L'audit précédent ne couvre pas
automatiquement ce nouveau code. La contre-revue proposée attend son accord
distinct, dans `docs/audits/FABLE_5_1_NORMALIZATION_REVIEW_BRIEF_2026-09-01.md`.

Avant ouverture élargie : recette réseau authentifiée, quotas et budget global,
documents personnels avec relation scolaire vérifiée, MFA et adhésions réelles,
restauration et validation de la protection des données. Aucun basculement de
production, DNS, VPS, Webmail, ENT ou PRONOTE n'est inclus.
