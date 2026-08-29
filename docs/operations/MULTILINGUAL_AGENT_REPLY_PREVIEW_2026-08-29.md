# Reponse agent multilingue controlee

Date : 29 aout 2026
Perimetre : branche `codex/lycee-connect-prototype`, preview uniquement

## Parcours

1. L'agent redige ou choisit une reponse en francais.
2. La langue cible provient de la langue detectee dans le dossier ; elle n'est
   pas saisie librement par le navigateur.
3. Les donnees connues sont masquees avant l'appel IA et `store` reste a `false`.
4. Le service retourne une traduction, une retrotraduction francaise et les
   eventuelles ambiguites.
5. L'agent compare les deux textes et coche une validation explicite.
6. Le serveur accepte l'envoi seulement si le recu signe correspond au dossier,
   a l'agent, au texte francais, a la traduction exacte et a la langue.

## Protections

- Le recu expire apres quinze minutes.
- Toute modification de la traduction, changement d'agent ou reutilisation dans
  un autre dossier invalide le recu.
- Une limite de 60 preparations par agent et par dossier sur 24 heures protege le
  cout et les abus.
- La traduction n'ajoute aucun droit et ne confirme aucune identite.
- Avant confirmation d'identite pour ENT ou messagerie academique, seul le
  message securise de verification peut etre traduit.
- L'evenement d'envoi conserve la langue et la validation humaine, pas le prompt
  ni une copie supplementaire des donnees personnelles.

## Preuves locales

```powershell
npm run test:support-translation
npm run test:support-access-security
npm run test:support-agent-access
npm run test:support-email-safety
npm run test:support-concurrency
npm run test:support-multilingual
npm run test:assistant-policy
npm run test:support-agent
npm run build
```

Resultat : 59 controles cibles reussis et build TypeScript/Vite reussi.

Le scenario de traduction utilise uniquement des donnees fictives. Il verifie le
masquage d'un prenom et d'un email, la preservation des marqueurs, l'expiration,
la modification du texte, le changement d'agent et la validation humaine.

## Limites

- La traduction reste une aide a la communication, pas une traduction certifiee.
- Un agent doit demander une aide humaine s'il ne peut pas comparer le sens ou si
  une ambiguite importante est signalee.
- Aucun envoi, contact reel, production, DNS, VPS, Webmail, ENT ou PRONOTE n'a
  ete modifie pendant ce lot.
