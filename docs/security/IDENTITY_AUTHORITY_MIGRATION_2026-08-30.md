# Migration identité, rôle et autorité

## Objectif

Les anciens niveaux `L0-L4` mélangeaient trois questions différentes : qui est
la personne, quel rôle elle possède et quelle action l'agent peut accomplir.
Depuis le 30 août 2026, le contrat canonique utilise :

- `I0-I4` pour la preuve d'identité ;
- un rôle d'établissement séparé ;
- `A0-A4` pour l'autorité de l'action.

## Contrat runtime

| Preuve | Origine minimale |
| --- | --- |
| `I0` | aucune session confirmée |
| `I1` | compte déclaré |
| `I2` | contact Supabase confirmé |
| `I3` | fiche scolaire ou adhésion active persistée |
| `I4` | adhésion active et session renforcée récente `aal2` |

Une adhésion détermine un rôle, jamais un niveau d'identité à elle seule. Une
source interne exige un rôle agent autorisé et I3. Une source personnelle exige
I3 et un outil contrôlé. Une source sensible exige I4, un rôle responsable, le
bon service et un outil contrôlé.

## Compatibilité

Le convertisseur `migrateLegacyActorLevel` accepte uniquement les six anciens
libellés runtime connus. Il les traduit vers le niveau et le rôle les plus
restrictifs compatibles. Il ne produit jamais I4, car un ancien libellé ne
prouve pas une session renforcée. Une valeur inconnue est refusée.

Cette compatibilité est réservée à la lecture d'anciennes valeurs. Les nouveaux
contrats, journaux et documents utilisent uniquement I0-I4 et A0-A4.

## Preuves

- `test:knowledge-actor` : résolution serveur, rôles, AAL2 et compatibilité ;
- `test:skill-registry` : accès public, interne, personnel et sensible ;
- `test:public-skill-context` : aucun contenu privé injecté au modèle ;
- `test:schedule-policy` : I3 minimum et relation autorisée ;
- `test:agent-tool-policy` : identité, rôle, service, relation, MFA et A4.
