# Accueil multilingue et resume francais

Date : 29 aout 2026
Perimetre : branche `codex/lycee-connect-prototype`, preview uniquement

## Parcours

1. La personne ecrit librement dans sa langue.
2. L'assistant repond dans cette langue lorsqu'elle est identifiable.
3. La conversation originale est conservee dans l'ordre dans le dossier.
4. La sortie structuree fournit le nom de la langue en francais et un resume
   interne en francais de 10 a 700 caracteres.
5. Le serveur repseudonymise ce resume et neutralise les balises reservees.
6. L'espace agent affiche la langue detectee et le resume avec la mention
   « automatique, a verifier avec le message original ».

## Protections

- Le resume francais n'est pas utilise par `routeSupportRequest`.
- Il ne confirme ni identite, ni urgence, ni autorisation, ni resultat.
- Il ne remplace jamais le message original.
- Il est accepte seulement avec une langue detectee ; une paire incomplete est
  refusee par l'API.
- Un repli sans IA et un formulaire classique modifie n'enregistrent pas de
  traduction pretendument automatique.
- Les mots de passe, codes, emails, telephones, identifiants et balises reservees
  sont masques avant l'analyse puis controles une seconde fois avant stockage.

## Preuves locales

```powershell
npm run test:support-agent
npm run test:support-multilingual
npm run test:support-conversation
npm run test:support-routing
npm run test:support-pseudonymizer
npm run test:assistant-policy
npm run build
```

Resultat : 51 controles cibles reussis et build TypeScript/Vite reussi.

Le scenario multilingue utilise une demande fictive en arabe concernant un acces
ENT. Il verifie la reponse arabe, la langue `arabe`, le resume francais, la
categorie `ent` et la preparation du dossier.

## Limites

- Ce lot traite l'accueil par l'assistant. La traduction assistee d'une reponse
  redigee ensuite par un agent humain reste un futur lot avec validation avant
  envoi.
- Aucune affirmation de comprehension parfaite n'est faite : une langue
  incertaine est declaree `indeterminee` et l'original reste la reference.
- Aucun service externe, donnee reelle ou environnement de production n'a ete
  modifie.
