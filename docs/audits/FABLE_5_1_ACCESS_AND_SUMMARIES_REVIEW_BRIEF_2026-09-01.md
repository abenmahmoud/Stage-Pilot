# Contre-revue regroupée - proposition non exécutée

Accord distinct demandé : un passage Claude Fable 5.1, lecture seule, plafond
2 USD, sans relance, outil, sous-agent, réseau ou accès autonome au dépôt.
Cette proposition regroupe T049C1 et T049C2 pour économiser du contexte ; elle
n'étend pas automatiquement une autorisation antérieure. Attendre la réponse.

## Mission

Vérifier deux suites de l'audit applicatif : provenance des résumés et accès
agents obligatoires. Chercher surtout une attribution erronée de résumé, un
accès malgré AAL1 ou adhésion révoquée, une substitution de droits, un retour
sortant, ou un blocage de l'enrôlement/public. Proposer des corrections minimales
et leurs tests, sans ouvrir de nouvelles fonctions ni décider de règles métier.

## Périmètre borné

Transmettre le diff des deux lots, avec les nouveaux helpers et tests complets.
Inclure le contexte des fonctions critiques, jamais les pages TSX entières.
Budget cible inférieur à 20 000 tokens d'entrée ; ne pas envoyer dépendances,
logs, configuration privée, fichiers d'environnement, secrets ou données réelles.

Priorités : `api/_shared/auth.ts`, `api/_shared/support-agent-access.ts`,
`api/_shared/support-normalization.ts`, `api/_shared/support.ts`,
`api/support/assistant.ts`, `api/support/requests/index.ts`,
`shared/support-normalization-policy.ts`, `shared/auth-return-path.ts`,
`shared/support-assistant-payload-policy.ts`, tests de provenance et d'accès.
Ajouter les hunks de `src/App.tsx`, `src/lib/auth-policy.ts`,
`src/pages/LoginPage.tsx`, `src/pages/MfaSecurityPage.tsx` et
`src/pages/prototype/LyceeConnectPrototype.tsx`.

## Limites et livrable

Les tests locaux ne certifient pas Auth distant, RLS, activation de comptes,
révocation immédiate de JWT, antivirus ou documents personnels. Rien de réel
n'est activé ; la production est exclue.

Rapport unique : gravité, scénario concret, fichier/ligne, correction simple,
test manquant et limites. Aucun « feu vert production ». Codex contre-vérifie
chaque constat. Arrêt au rapport ou au plafond ; nouvelle permission pour relancer.
