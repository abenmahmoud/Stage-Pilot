# Revue externe bornee du 28 aout 2026

## Perimetre et limites

- Branche examinee : `codex/lycee-connect-prototype`.
- Preview uniquement ; aucune action sur la production, Hostinger, DNS, VPS,
  Webmail, PRONOTE ou ENT.
- Aucun secret, contact, emploi du temps ou document reel transmis.
- Claude : une execution en lecture seule, arretee par saturation de contexte.
  Aucun rapport ni conclusion exploitable ; aucune relance.
- Kimi : une execution en lecture seule sur une archive Git isolee de 15 fichiers,
  avec une sortie limitee a 120 lignes.

## Contre-verification Codex

| Signal externe | Decision | Preuve ou correction |
| --- | --- | --- |
| Une longue description perdait son debut | Confirme, severite moderee | Le resume conserve maintenant le probleme initial et les derniers details dans 5 000 caracteres. Test automatise ajoute. |
| Aucun acces direct au formulaire classique | Confirme | Un raccourci secondaire est accessible depuis l'accueil ; la conversation reste le parcours principal. |
| Le numero de demande ne pouvait pas etre copie | Confirme, confort | Bouton de copie et retour visuel `Copie` ajoutes. |
| La necessite d'un email ou telephone etait visible seulement apres erreur | Confirme, comprehension | Consigne placee avant les deux champs ; la validation serveur existante reste obligatoire. |
| Les erreurs API internes etaient exposees au public | Non confirme | Le filtre partage renvoie les erreurs metier controlees ou le message generique `Erreur serveur`. Aucun changement sans preuve contraire. |
| La navigation mobile debordait a 320 px | Non reproduit | Controle navigateur : largeur du document egale a 320 px, sans erreur ni overlay. |
| `DDFPT` et `Communication direction` devaient disparaitre | Rejete dans ce perimetre | Ces termes appartiennent a la console des agents et au routage interne, pas au parcours public teste. |

## Verification apres correction

- 5/5 tests de conversation.
- 11/11 tests de l'agent de support.
- 16/16 tests de politique de conversation.
- Compilation TypeScript et build Vite reussis.
- `npm audit --omit=dev --audit-level=high` : aucune vulnerabilite.
- Controle navigateur en 1440 x 1000 et 320 x 812 : contenu present,
  formulaire visible, aucun debordement horizontal et aucune erreur de page.

Cette revue ne valide ni les donnees reelles, ni la charge, ni les habilitations
nominatives, ni une bascule de production.
