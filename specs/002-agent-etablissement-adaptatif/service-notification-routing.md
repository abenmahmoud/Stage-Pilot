# Routage des alertes internes

## But

Prévenir le bon service lorsqu'une demande ou un nouveau message arrive, sans
révéler les adresses internes aux demandeurs et sans perdre une alerte pendant
la mise en place progressive des comptes agents.

## Règle

1. Le service affecté au dossier détermine le destinataire interne.
2. Secrétariat, administration et intendance partagent d'abord la même boîte
   fonctionnelle.
3. Si l'adresse du service est absente ou invalide, la boîte générale du
   superadministrateur reçoit l'alerte.
4. Si aucune adresse sûre n'est configurée, le travail échoue et reste dans la
   file durable pour être repris ; aucun autre destinataire n'est inventé.
5. Les adresses et secrets restent uniquement dans les variables serveur.

## Variables attendues

- `SUPPORT_AGENT_EMAIL` : repli général et superadministration ;
- `SUPPORT_AGENT_EMAIL_DDFPT` : DDFPT ;
- `SUPPORT_AGENT_EMAIL_ADMINISTRATION` : secrétariat, administration, intendance ;
- `SUPPORT_AGENT_EMAIL_VIE_SCOLAIRE` : vie scolaire ;
- `SUPPORT_AGENT_EMAIL_NUMERIQUE` : référent numérique ;
- `SUPPORT_AGENT_EMAIL_DIRECTION` : direction.

Aucune valeur réelle n'est enregistrée dans Git. La configuration de preview ou
de production exige les adresses fonctionnelles validées par le lycée.
