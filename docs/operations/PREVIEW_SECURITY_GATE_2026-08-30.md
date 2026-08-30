# Porte de sécurité - preview

## Périmètre automatisé

La commande `npm run test:preview-security-gate` contrôle :

- CSP, HSTS, anti-cadrage, `nosniff`, référent et permissions navigateur ;
- absence de cache public sur les API et revalidation du service worker ;
- absence de source maps de production ;
- refus des mots de passe, OTP, codes et clés ;
- limites de débit et identifiants opaques ;
- rotation des sessions, MFA et périmètres d'agents ;
- frontières adversariales des routes de demandes ;
- autorisation et confidentialité du centre de communications ;
- unicité et intégrité des versions de migrations.

## Limites

Cette porte travaille uniquement sur le dépôt et des données fictives. Elle ne
prouve pas la configuration d'un compte réel, le comportement du WAF, une revue
DPO, un test d'intrusion externe ou l'absence de vulnérabilité inconnue. T049
reste donc ouverte.

## Règle d'exploitation

Un lot touchant l'authentification, les demandes, les communications, les
imports, les migrations ou les en-têtes doit faire passer cette commande avant
le push de preview.
