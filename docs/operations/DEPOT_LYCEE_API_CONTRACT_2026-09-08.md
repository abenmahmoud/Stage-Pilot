# Contrat de réception du Dépôt Lycée — 8 septembre 2026

## Adresse et authentification

Base : `https://lycee-blaise-cendrars-sevran.fr/api/depot`

Toutes les requêtes portent :

```http
Authorization: Bearer <LYCEEGEST_TOKEN>
```

Le VPS garde `LYCEEGEST_TOKEN`. LyceeGest reçoit uniquement son empreinte SHA-256
hexadécimale dans `LYCEEGEST_DEPOT_TOKEN_SHA256`. Une absence ou une différence
renvoie `401` sans recopier le jeton.

Les réponses ne contiennent que des identifiants techniques, des statuts et des
compteurs. Elles ne renvoient aucun nom, contact, attribut ou code.

## Multipart commun

Pour un fichier inférieur ou égal à 4 Mo :

```http
POST /api/depot/<type>
Content-Type: multipart/form-data
```

Champ principal obligatoire : `fichier`.

Champs texte facultatifs et bornés : `annee_scolaire`, `titre`, `valide_du`,
`valide_au`, `fraiche_jusquau`, `source_kind`. Tout autre champ ou fichier est
refusé. Cette borne de 4 Mo reste sous la limite de requête des fonctions Vercel
de 4,5 Mo ; les fichiers plus grands utilisent le dépôt signé décrit pour l'EDT.

### `annuaire`

- `fichier` : `annuaire_import.csv`, `text/csv` ;
- `rapport` : `rapport_verification.txt`, `text/plain`, obligatoire ;
- réponse nouvelle réception : `202` ;
- réponse même fichier déjà reçu : `200`, `duplicate: true`.

Exemple de réponse :

```json
{
  "ok": true,
  "type": "annuaire",
  "importId": "<uuid>",
  "status": "quarantined",
  "duplicate": false
}
```

Le worker contrôle les deux fichiers par antivirus, lit les 17 colonnes, rejoue
les vérifications, compare les huit compteurs et vérifie que toutes les classes
calculées figurent dans le rapport. La version reste inactive jusqu'à son
approbation et son activation humaines dans l'administration. Le stockage privé
`identity-ingest` autorise explicitement `text/plain` pour ce rapport ; un même
lot déjà en quarantaine ou en traitement est également reconnu comme doublon.

### `attributs`

- `fichier` : `attributs_import.csv`, `text/csv` ;
- réponse : `202`, statut `review` ; `200` si le SHA-256 existe déjà.

Chaque référence doit exister dans l'annuaire actif. Les clés de secrets sont
refusées. La valeur est chiffrée séparément en AES-256-GCM et l'import reste en
attente de validation humaine. Le lot apparaît dans « Répertoire privé du
lycée » avec son seul nom, son volume et son statut. Son activation exige MFA,
une justification et la même version active de l'annuaire que lors de sa
réception. Aucune valeur n'est affichée ni ajoutée au contexte de l'IA. Chaque
réception, activation et remplacement est consigné dans un journal append-only.

### `codes`

- `fichier` : enveloppe binaire `.enc` au format `LGC1` ;
- champ facultatif : `annee_scolaire` au format `2026-2027` ;
- réponse : `202` avec seulement `accepted` et `alreadyPresent`.

LyceeGest ouvre RSA-OAEP-SHA256 puis AES-256-GCM en mémoire, valide le CSV clair,
exige une référence présente dans l'annuaire actif, puis appelle exclusivement
`api/_shared/code-vault-write.ts`. Le code est immédiatement rechiffré au repos.
Une attribution existante n'est jamais écrasée automatiquement.

### `edt`

- `fichier` : PDF `application/pdf`, CSV `text/csv` ou Excel `.xlsx`
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` ;
- `source_kind` : `classes` par défaut ;
- réponse : `202`, statut `quarantined` ; `200`, `duplicate: true` si le même
  fichier a déjà été reçu pour le même périmètre et la même année scolaire.

Le fichier passe dans le circuit existant : stockage privé, antivirus,
correspondance des colonnes pour CSV/Excel ou indexation PDF, revue et activation
humaines. Son SHA-256 est enregistré et un index unique partiel empêche deux
réservations concurrentes du même fichier.

## EDT signé jusqu'à 50 Mo

Vercel limite le corps d'une fonction à 4,5 Mo. Le connecteur automatique utilise
toujours le dépôt signé ; il convient au PDF, au CSV et au fichier Excel jusqu'à
50 Mo. Il calcule l'empreinte localement puis réserve une destination :

```http
POST /api/depot/edt
Content-Type: application/json

{
  "mode": "reserve",
  "originalName": "edt-classes.pdf",
  "sizeBytes": 12000000,
  "schoolYear": "2026-2027",
  "title": "Emploi du temps des classes",
  "effectiveFrom": "2026-09-08",
  "effectiveUntil": null,
  "freshUntil": "2026-09-15",
  "sourceKind": "classes",
  "sourceFormat": "pdf_import",
  "mimeType": "application/pdf",
  "checksum": "<sha256-hexadecimal>"
}
```

Réponse `201` :

```json
{
  "ok": true,
  "type": "edt",
  "importId": "<uuid>",
  "status": "reserved",
  "duplicate": false,
  "upload": {
    "bucket": "schedule-ingest",
    "path": "<chemin opaque>",
    "token": "<jeton upload signé>",
    "signedUrl": "<url HTTPS temporaire limitée à cet objet>"
  }
}
```

Le client envoie ensuite le fichier directement à Supabase par `signedUrl`, puis
confirme :

```http
POST /api/depot/edt
Content-Type: application/json

{"mode":"confirm","importId":"<uuid>"}
```

Réponse `202` quand le contrôle est mis en file, `200` avec `duplicate: true`
si la confirmation avait déjà été reçue, `409` si le fichier est absent ou
incomplet.

Si une réservation portant la même empreinte est encore au statut `reserved`,
le serveur renvoie `200`, `duplicate: true` et une nouvelle `signedUrl` pour
reprendre l'envoi. Il ne crée pas de deuxième version. Après réception, la même
réservation renvoie seulement l'identifiant et le statut existants.

## Codes HTTP communs

- `200` : réception idempotente déjà connue ;
- `201` : destination signée réservée ;
- `202` : fichier reçu et traitement ou revue en attente ;
- `400` : structure, colonnes ou métadonnées invalides ;
- `401` : jeton absent ou incorrect ;
- `409` : dépendance absente, notamment annuaire actif ou upload incomplet ;
- `413` : requête trop volumineuse ;
- `415` : format ou type MIME refusé ;
- `503` : clé, compte technique ou stockage serveur non configuré.

## Mise en service externe encore nécessaire

1. faire relire puis appliquer les migrations
   `20260908013000_create_person_attribute_imports.sql`,
   `20260908133000_make_depot_schedule_idempotent.sql` et
   `20260908134500_allow_depot_verification_report.sql` selon la procédure
   contrôlée du projet ;
2. créer ou choisir le compte technique et renseigner son UUID ;
3. poser les cinq variables secrètes serveur décrites dans `.env.local.example` ;
4. configurer `LYCEEGEST_URL` et `LYCEEGEST_TOKEN` sur le VPS ;
5. après application dans l'environnement ciblé, répéter la recette de bout en
   bout avec les seuls fichiers fictifs avant les exports réels, y compris
   l'activation d'un lot d'attributs depuis l'écran d'administration ;
6. conserver `CODE_VAULT_REVEAL_ENABLED=false` jusqu'à la validation finale des
   parcours de remise.

Référence de la limite Vercel :
<https://vercel.com/docs/functions/limitations#request-body-size>.
