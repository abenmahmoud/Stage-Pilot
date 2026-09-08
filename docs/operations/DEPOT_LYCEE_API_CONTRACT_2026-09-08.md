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
approbation et son activation humaines dans l'administration.

### `attributs`

- `fichier` : `attributs_import.csv`, `text/csv` ;
- réponse : `202`, statut `review` ; `200` si le SHA-256 existe déjà.

Chaque référence doit exister dans l'annuaire actif. Les clés de secrets sont
refusées. La valeur est chiffrée séparément en AES-256-GCM et l'import reste en
attente de validation humaine. Aucune valeur n'est ajoutée au contexte de l'IA.

### `codes`

- `fichier` : enveloppe binaire `.enc` au format `LGC1` ;
- champ facultatif : `annee_scolaire` au format `2026-2027` ;
- réponse : `202` avec seulement `accepted` et `alreadyPresent`.

LyceeGest ouvre RSA-OAEP-SHA256 puis AES-256-GCM en mémoire, valide le CSV clair,
exige une référence présente dans l'annuaire actif, puis appelle exclusivement
`api/_shared/code-vault-write.ts`. Le code est immédiatement rechiffré au repos.
Une attribution existante n'est jamais écrasée automatiquement.

### `edt`

- `fichier` : PDF `application/pdf` ;
- `source_kind` : `classes` par défaut ;
- réponse : `202`, statut `quarantined`.

Le PDF passe dans le circuit existant : stockage privé, antivirus, indexation,
revue et activation humaines.

## EDT supérieur à 4 Mo

Vercel limite le corps d'une fonction à 4,5 Mo. Pour un PDF plus grand, le Dépôt
réserve d'abord une destination :

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
  "sourceKind": "classes"
}
```

Réponse `201` :

```json
{
  "ok": true,
  "type": "edt",
  "importId": "<uuid>",
  "status": "reserved",
  "upload": {
    "bucket": "schedule-ingest",
    "path": "<chemin opaque>",
    "token": "<jeton upload signé>"
  }
}
```

Le VPS envoie ensuite le PDF directement à Supabase avec `upload.path` et
`upload.token`, puis confirme :

```http
POST /api/depot/edt
Content-Type: application/json

{"mode":"confirm","importId":"<uuid>"}
```

Réponse `202` quand le contrôle est mis en file, `200` avec `duplicate: true`
si la confirmation avait déjà été reçue, `409` si le fichier est absent ou
incomplet.

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

1. appliquer la migration `20260908013000_create_person_attribute_imports.sql`
   selon la procédure locale contrôlée du projet ;
2. créer ou choisir le compte technique et renseigner son UUID ;
3. poser les cinq variables secrètes serveur décrites dans `.env.local.example` ;
4. configurer `LYCEEGEST_URL` et `LYCEEGEST_TOKEN` sur le VPS ;
5. exécuter une recette avec les seuls fichiers fictifs avant les exports réels ;
6. conserver `CODE_VAULT_REVEAL_ENABLED=false` jusqu'à la validation finale des
   parcours de remise.

Référence de la limite Vercel :
<https://vercel.com/docs/functions/limitations#request-body-size>.
