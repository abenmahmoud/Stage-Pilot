# Acces personnel sans mot de passe

## But

Permettre a un eleve, un responsable ou un personnel de prouver simplement son
lien avec le lycee par une adresse email deja connue, puis de conserver cette
preuve sur son appareil pendant une duree limitee. Le numero et le code d'une
demande restent un mecanisme de suivi de dossier distinct.

## Parcours cible

1. La personne demande une information personnelle, par exemple son emploi du
   temps.
2. Le portail propose de verifier une adresse email deja connue du lycee, sans
   indiquer si cette adresse existe dans le repertoire.
3. Le serveur transmet la recherche chiffree au worker prive. Le worker refuse
   les versions inactives, les absences, les doublons et les adresses partagees.
4. En cas de correspondance unique et active, un code a six chiffres est envoye
   a cette adresse. Le code expire apres dix minutes et accepte cinq essais.
5. La consommation atomique du code ouvre une session d'identite opaque,
   `HttpOnly`, `Secure`, `SameSite=Lax`, rotative et revocable. Aucun contact ni
   identifiant scolaire n'est place dans le cookie.
6. Sur un appareil personnel, la session peut durer sept jours d'inactivite au
   maximum. Sur un appareil partage, elle se termine avec le navigateur. Le
   bouton `Oublier mon identite` la revoque immediatement.
7. Le serveur relit a chaque service la version active, la fiche de la personne,
   la relation eventuelle et la fraicheur de la source. Le navigateur ne decide
   jamais du role ou du perimetre.

## Regles de service

| Besoin | Sans identite | Identite `I3` active |
|---|---|---|
| Information ou document general | Reponse immediate | Reponse immediate |
| Propre emploi du temps | Demande suivie | Reponse immediate, source datee |
| Emploi du temps d'un enfant | Demande suivie | Reponse immediate seulement avec lien `guardian_of` actif |
| Donnee scolaire personnelle a faible risque | Demande suivie | Reponse dans le perimetre propre |
| Document personnel, code d'acces ou modification officielle | Attente humaine | File express, validation humaine obligatoire |
| Donnee d'un tiers sans relation | Refus sans confirmer son existence | Refus sans confirmer son existence |

Le mode express ne donne jamais a l'IA le droit de modifier l'ENT, PRONOTE ou un
autre systeme officiel. Il reduit seulement la ressaisie et l'attente lorsque le
service et la preuve autorisent la lecture.

## Fichiers

Tout fichier est depose dans un stockage prive avec nom neutralise, taille et
signature controlees. Il reste inaccessible pendant les etats
`awaiting_upload`, `quarantined` et `scanning`. Seul l'etat antivirus `clean`
autorise sa consultation. Les etats `infected` et `rejected` bloquent le fichier
et produisent un evenement technique sans exposer son contenu a l'IA.

## Vie privee et echec

- La reponse a la demande de code reste identique pour une adresse connue,
  inconnue, partagee ou indisponible.
- Les limites combinent appareil, empreinte HMAC du contact et garde-fou global.
- Le portail ne conserve ni code, ni adresse, ni reference de personne dans le
  navigateur.
- Une panne du worker, de l'email ou de l'annuaire laisse toujours disponible le
  formulaire classique et le suivi de la demande.
- L'agent ne recoit qu'un niveau d'identite, un type de personne et un perimetre
  autorise ; il ne recoit jamais le repertoire complet.

## Activation

Le lot peut etre developpe et teste avec des identites fictives. L'activation
reelle exige une version approuvee du repertoire, le worker prive, la livraison
email configuree, les mentions de protection des donnees, la duree de session
validee et une recette de revocation. Aucun import reel ne doit etre necessaire
pour verifier le code ou l'interface en preview.
