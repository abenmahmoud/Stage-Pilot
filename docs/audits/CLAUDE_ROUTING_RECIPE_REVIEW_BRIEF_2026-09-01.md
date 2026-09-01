# Revue des recettes de classement de preview

## Accord et perimetre

Le proprietaire a confirme une nouvelle mission Claude Fable 5 le 1er septembre
2026 : six scripts, lecture seule, un seul passage, plafond de 5 USD. Cet accord
est distinct de la revue precedente du worker. Aucun secret, fichier utilisateur,
autre projet, outil, MCP, sous-agent ou session persistante n'est autorise.

Fichiers transmis, au commit `7b84eda` :

- `scripts/routing-review-preview-target.mjs`
- `scripts/routing-review-vercel-cli.mjs`
- `scripts/test-preview-routing-review-client.mjs`
- `scripts/test-preview-support-assistant-routing-review.mjs`
- `scripts/test-preview-routing-review-recipe-safety.mjs`
- `scripts/test-support-assistant-routing-review.mjs`

## Question

Chercher les defauts concrets qui empecheraient une recette fiable et sure de
confirmation/correction humaine du classement sur la preview. Prioriser la
destination des secrets, les appels Windows, MFA, les erreurs, les fixtures et
leur nettoyage. Ne pas inventer de contrat dans les API non fournies.

Le code de destination et le lanceur Windows viennent d'etre corriges. La suite
locale et le build passent, mais l'execution distante de ces recettes n'est pas
prouvee. La forme d'un nom Vercel ne prouve pas son environnement : l'operateur
doit verifier les metadonnees du deploiement avant execution. Aucun acces reel
n'est fourni a l'auditeur et il ne doit pas en demander.

## Livrable et arret

Un verdict court, les constats P0-P3 avec fichier/ligne, une preuve reproductible,
la correction minimale et les tests utiles. Distinguer bug confirme, hypothese
et preuve manquante. Maximum 700 mots. Proposer seulement du texte : Codex
verifie les constats et applique les corrections. Fin apres cette reponse,
aucune relance automatique et aucune nouvelle execution sans autre accord.
