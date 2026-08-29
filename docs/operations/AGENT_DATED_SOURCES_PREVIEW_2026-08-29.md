# Agent - recherche usager et sources datees

Date : 29 aout 2026
Perimetre : branche `codex/lycee-connect-prototype`, preview uniquement

## Comportement livre

- Un vocabulaire partage relie des formulations simples aux domaines ENT,
  messagerie academique, equipement, documents de scolarite, emploi du temps,
  restauration, inscription et vie scolaire.
- La recherche s'execute apres les controles d'etablissement, d'identite, de
  service, de classification, de publication, de validite et de revision.
- Seuls les extraits pertinents, au plus six et 4 000 caracteres, entrent dans le
  contexte du modele.
- Apres une reponse IA reussie, le serveur joint uniquement le titre et la date
  de mise a jour des sources selectionnees. Le schema demande au modele ne
  contient pas ce champ.
- Le navigateur n'affiche jamais l'identifiant interne, le chemin du fichier,
  l'empreinte, le proprietaire ou le texte integral de la source.
- Le journal d'usage recoit seulement les identifiants opaques deja prevus.

## Preuves locales

Commandes executees :

```powershell
npm run test:knowledge-excerpts
npm run test:public-skill-context
npm run test:support-agent
npm run test:agent-source-references-ui
npm run build
```

Resultat : 39 controles cibles reussis et build Vite/TypeScript reussi.

Scenarios verifies :

- « J'ai perdu mon mot de passe EduConnect » retrouve la procedure ENT validee.
- « Mon PC ne demarre plus » retrouve la procedure ordinateur.
- « Je veux modifier mon code postal » ne charge pas une procedure ENT.
- Une source privee, expiree, revoquee, hors etablissement ou hors service reste
  exclue.
- Une reponse IA echouee ou de repli n'affiche aucune reference.
- La liste publique est attachee par le serveur et absente du schema de sortie du
  modele.

## Limites maintenues

- Aucun document reel ni donnee nominative n'a ete ajoute.
- Aucune publication de competence reelle n'est implicite.
- Aucun changement de production, DNS, Hostinger, VPS, Webmail, ENT ou PRONOTE.
- La recette utilisateur complete reste volontairement reportee jusqu'a ce que
  le registre contienne assez de competences fictives puis validees.
