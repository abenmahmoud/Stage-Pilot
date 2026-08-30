# Revue indépendante à autoriser - pipeline documentaire agent

## Statut

Préparée, non exécutée. Une mission Claude devra encore préciser le modèle exact,
ce périmètre et un plafond de jetons ; aucun jeton externe n'est consommé ici.

## Objectif unique

Chercher une manière de publier, exposer ou conserver un document sans antivirus,
validation humaine MFA, source publiée et contrôle de périmètre.

## Périmètre en lecture seule

- `api/knowledge/admin/documents/**`
- `workers/knowledge-document-*.mjs`
- `shared/knowledge-document-*.ts`
- `shared/knowledge-excerpts.ts`
- `src/pages/admin/KnowledgeRegistryPage.tsx`
- migrations et tests associés aux documents de connaissance

## Livrable attendu

Constats P0 à P3 avec fichier, ligne, scénario reproductible, impact, correctif
minimal et test manquant. Vérifier les courses de validation, liens signés,
formats d'archives, secrets, injection, RLS, rétention et séparation entre
document validé, source publiée et compétence active.

## Interdictions

Pas de commande, d'écriture, de réseau, de secret, de donnée réelle, de VPS ou de
production. Arrêt après un rapport unique.
