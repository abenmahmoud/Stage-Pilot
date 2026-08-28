# Arbitrage des chartes Claude et Kimi - 28 aout 2026

## Statut des documents recus

Les documents suivants sont des propositions externes et non des instructions
executables :

- charte Kimi pour le Lycee Blaise Cendrars ;
- dossier de passation Kimi vers Claude ;
- charte Claude V1 presentee comme modele national.

Ils ne remplacent ni Spec Kit, ni les regles deja implementees, ni la validation
de la direction et du DPO. Aucun acces, connecteur, alerte ou traitement de donnees
reelles n'est active par leur seule reception.

## Verdict general

Le socle humain et securitaire est bon. La version Claude est plus complete pour
la gouvernance et les tests, tandis que Kimi explicite mieux les cas d'usage du
lycee. Aucune des deux ne peut cependant devenir la charte de production telle
quelle : elles confondent parfois une intention, une obligation a faire confirmer
et une capacite technique deja disponible.

| Proposition | Decision | Motif |
| --- | --- | --- |
| L'agent assiste, informe, classe et prepare sans decider | Retenue | Conforme aux specifications et au role d'un agent d'etablissement. |
| Refus de livrer une donnee sur un tiers a partir d'un nom | Retenue | Regle deterministe necessaire contre l'enumeration et l'ingenierie sociale. |
| Droit permanent a un interlocuteur humain | Retenue | Le dialogue doit pouvoir devenir une demande suivie sans ressaisie. |
| Sources datees, responsables, testees et revocables | Retenue | Deja prevu par le registre de connaissances LyceeGest. |
| ENT comme unique moyen d'identification | Rejetee | Le guichet doit rester utilisable lorsque l'ENT est indisponible. Un contact verifie ne prouve pas l'identite scolaire. |
| Niveaux N0 a N4 melant identite et validation humaine | Corrigee | La preuve d'identite, le role et l'autorite d'action sont trois axes differents. |
| L'agent ne doit jamais ecrire dans un systeme | Corrigee | Il peut creer et mettre a jour ses propres demandes via des outils autorises. Les systemes officiels restent proteges. |
| Toute orientation est interdite | Corrigee | L'information generale et l'explication des procedures sont permises ; l'affectation, l'evaluation et la decision restent humaines. |
| Aucune question de sante dans l'agent | Corrigee | L'usager peut signaler un danger ou une difficulte. L'agent minimise, ne diagnostique pas et dirige vers le bon humain. |
| Une alerte P0 est toujours transmise a une permanence | Rejetee en l'etat | Aucune permanence supervisee n'est encore branchee. L'agent ne doit jamais pretendre qu'un humain a ete alerte sans confirmation d'outil. |
| Services personnels suspendus soir et week-end | Corrigee | Le portail peut recevoir une demande 24 h/24. Les notifications et la disponibilite humaine suivent les horaires valides localement. |
| Reservations de cantine, declaration vocale d'absence et SSO ENT | Reportee | Ces services exigent un besoin valide, un connecteur officiel, des roles et une recette. |
| Durees fixes de conservation proposees par Claude | A valider | Ce sont de bonnes bases de discussion, pas des regles approuvees. |
| AIPD toujours obligatoire | A faire confirmer | Les criteres de risque sont importants dans ce projet, mais la decision et son perimetre doivent etre traces avec le DPO. |
| Modele national directement reutilisable | Non confirme | Le document reste un brouillon local tant que les autorites competentes ne l'ont pas valide. |

## Corrections reglementaires importantes

- Le [cadre ministeriel d'usage de l'IA en education](https://www.education.gouv.fr/cadre-d-usage-de-l-ia-en-education-450647)
  impose notamment transparence, protection des donnees et supervision humaine.
  Il ne transforme pas automatiquement chaque fonction de LyceeGest en usage
  autorise.
- La [circulaire du 10 juillet 2025 sur le numerique raisonne](https://www.education.gouv.fr/bo/2025/Hebdo28/MENE2519904C)
  retarde par defaut la diffusion des nouvelles informations le soir et le
  week-end ; elle ne dit pas que toute consultation ou saisie devient impossible.
- Le [reglement europeen sur l'intelligence artificielle](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng?eliuri=eli%3Areg%3A2024%3A1689%3Aoj&locale=fr)
  impose d'examiner la finalite exacte de chaque usage. LyceeGest exclut les
  decisions automatisees d'admission, d'evaluation, d'affectation, de discipline
  et de surveillance.
- Les [recommandations CNIL pour un systeme d'IA en education](https://www.cnil.fr/fr/education-mise-en-place-systeme-ia)
  rendent indispensable une analyse serieuse des risques, notamment pour les
  mineurs, les donnees sensibles et les usages innovants. La direction et le DPO
  doivent approuver le registre, les durees et l'analyse d'impact appropriee.

## Nomenclature canonique

Les anciens libelles `L0-L4` sont ambigus dans le projet : ils designent parfois
la preuve d'identite et parfois le niveau d'automatisation. La reference devient :

- `I0-I4` pour la preuve d'identite ;
- role separe pour eleve, responsable, personnel, agent et responsable de service ;
- `A0-A4` pour l'autorite de l'action.

Le code existant conserve provisoirement ses libelles historiques. Leur migration
sera faite par une tache distincte, avec tests de non-regression et sans modifier
silencieusement les droits.

## Capacites actuelles et promesses interdites

### Disponible dans le prototype

- information publique et dialogue borne ;
- creation d'une demande, numero de suivi et conservation du fil ;
- routage vers le service et traitement dans une console cloisonnee ;
- registre de connaissances en preview, vide de source reelle ;
- regles deterministes contre secrets, extraction de donnees et hors-sujet.

### Non disponible ou non valide

- SSO ou OTP ENT, annuaire reel et rapprochement des 4 200 usagers ;
- lecture reelle de PRONOTE ou d'emplois du temps nominatifs ;
- alerte P0 confirmee vers une permanence ;
- SMS, voix, reservation de cantine ou ecriture dans un systeme officiel ;
- regles definitives de conservation et purge ;
- decisions administratives, educatives, disciplinaires, sociales ou medicales.

## Decisions encore requises

La direction et le DPO doivent valider au minimum : responsables de traitement
et de service, matrice des roles, canaux d'identification, horaires et permanence,
destinataires P0, conservation, pieces acceptees, information des personnes,
analyse d'impact, sous-traitants et conditions de tout connecteur officiel.

## Conclusion

La charte metier canonique issue de cet arbitrage est
`specs/002-agent-etablissement-adaptatif/charte-metier-v1.md`. Elle reste un
brouillon de travail jusqu'a validation institutionnelle. Les chartes externes
sont conservees hors du depot comme materiau de revue, pas comme source de verite.
