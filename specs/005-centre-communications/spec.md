# Spécification - Centre de communication du lycée

**Statut** : proposition à valider avant implémentation
**Date** : 26 août 2026
**Dépendances** : `003-gestion-contenus-lycee` et Webmail du Lycée

## 1. Problème

Les informations de rentrée sont aujourd'hui envoyées dans le corps d'un email
ou dans une pièce jointe. Elles deviennent rapidement difficiles à retrouver,
les corrections créent plusieurs versions et certaines réponses repartent à
toute la liste. Les destinataires peuvent en outre voir des adresses qui ne
devraient pas être exposées.

Le lycée a besoin d'un point de publication unique, simple pour une équipe peu à
l'aise avec l'informatique, sans dépendre du référent numérique pour chaque mise
en forme.

## 2. Vision

Une information est saisie, déposée ou transférée une seule fois. Le système en
prépare une version claire, datée, classée et accessible. Une personne habilitée
la valide, puis le même contenu officiel alimente le site et les notifications
email. Le site reste la référence toujours à jour ; l'email signale la nouvelle
information et renvoie vers elle.

Le système ne publie et ne diffuse jamais seul une décision officielle.

## 3. Utilisateurs

- **Administration** : dépose un texte, un email, un PDF ou une image et corrige
  le brouillon proposé.
- **Direction** : valide la visibilité, les destinataires, la publication et la
  diffusion.
- **Référent numérique** : supervise les erreurs, les listes, les modèles et les
  intégrations sans devoir réécrire chaque communication.
- **Professeurs et personnels** : reçoivent un message individuel, consultent la
  version officielle et répondent sans exposer la liste.
- **Élèves et parents** : consultent uniquement les communications publiques qui
  les concernent.

## 4. Parcours principal

1. L'administration écrit quelques lignes, dépose une pièce jointe ou transfère
   un email à l'adresse de collecte autorisée.
2. Le système crée immédiatement un brouillon privé et conserve la source.
3. Il extrait les éléments lisibles et propose : titre, résumé, texte structuré,
   dates importantes, actions attendues, catégorie, public et date d'expiration.
4. Les informations incertaines ou manquantes sont signalées, jamais inventées.
5. La direction ou le référent relit un aperçu ordinateur, téléphone et email.
6. La validation précise séparément : publication sur le site, audience email,
   date d'envoi et caractère public ou interne.
7. La publication officielle est enregistrée avant la mise en file des envois.
8. Chaque destinataire reçoit un email individuel contenant l'essentiel et un
   lien vers la version à jour. La liste des destinataires n'est jamais visible.
9. Les livraisons, erreurs et réponses sont rattachées à la communication.
10. Une correction crée une nouvelle version ; le lien reste identique et la
    date de mise à jour est visible.

## 5. Visibilité

- **Public** : visible sur le site par tous.
- **Interne** : visible dans l'espace administratif et diffusé aux personnels
  autorisés ; jamais publié sur une page publique.
- **Ciblé** : envoyé seulement aux groupes choisis ; son accès web nécessite un
  lien individuel ou une authentification adaptée.

Tout élément entrant est `interne` et `brouillon` par défaut. Le classement
public doit être confirmé explicitement.

Un `Hebdo` destiné aux professeurs ou personnels est interne par défaut. Seules
les informations explicitement marquées publiques alimentent le site public.

## 6. Exigences fonctionnelles

- **FR-001** : accepter saisie directe, copier-coller, PDF, DOCX, image et email
  transféré comme sources d'un brouillon.
- **FR-002** : conserver la source, l'auteur déclaré, la date de réception et une
  empreinte empêchant un double import.
- **FR-003** : proposer une rédaction en français correct et simple sans ajouter
  de fait, contact, date ou consigne non présents dans la source.
- **FR-004** : extraire et afficher séparément les dates, horaires, lieux,
  documents et actions attendues pour faciliter la relecture.
- **FR-005** : offrir les modèles `Hebdo`, `Urgent`, `Rentrée`, `Document`,
  `Événement` et `Rappel` ; la direction peut les modifier.
- **FR-006** : exiger une validation humaine avant publication, programmation ou
  diffusion, avec aperçu des trois rendus.
- **FR-007** : publier automatiquement la version validée dans le flux du site,
  avec date, heure, auteur institutionnel, audience et date de mise à jour.
- **FR-008** : afficher sur le site un flux continu filtrable par audience,
  catégorie, période et mot-clé, avec informations épinglées et archives.
- **FR-009** : faire du lien web la référence et éviter les pièces jointes dans
  l'email lorsqu'un lien accessible suffit ; le document original reste proposé
  sur la page si sa conservation est utile.
- **FR-010** : envoyer un message séparé à chaque destinataire ou utiliser un
  mécanisme équivalent ne révélant aucune autre adresse.
- **FR-011** : enregistrer pour chaque destinataire l'état `préparé`, `envoyé`,
  `livré`, `différé`, `rejeté`, `désinscrit` ou `erreur`, sans dupliquer son
  adresse dans les journaux techniques.
- **FR-012** : diriger une réponse email vers une adresse propre à la
  communication et l'ajouter à une boîte de traitement, sans `Répondre à tous`.
- **FR-013** : reconnaître les demandes courantes comme retrait de liste,
  adresse erronée ou question, puis proposer l'action à un agent.
- **FR-014** : permettre correction, nouvelle version, expiration, archivage et
  annulation d'un envoi programmé avec journal d'audit.
- **FR-015** : produire automatiquement un récapitulatif hebdomadaire à partir
  des communications déjà validées, sans recréer l'information.
- **FR-016** : garder le Webmail du Lycée comme application de diffusion séparée
  et l'utiliser par une interface serveur documentée, sans mélanger ses fichiers
  ni ses contacts avec le dépôt LyceeGest.
- **FR-017** : conserver une voie manuelle si l'IA, Brevo ou la collecte email
  est indisponible.
- **FR-018** : cibler uniquement les contacts actifs et validés pour ce canal ;
  un retrait ou une désactivation les exclut des futures diffusions.

## 7. Règles IA

- L'IA prépare, résume, corrige et classe ; elle ne publie ni n'envoie.
- Les documents sont d'abord extraits et filtrés côté serveur. Aucun document
  brut ni liste de destinataires n'est transmis au modèle externe.
- Les données personnelles détectées sont masquées avant l'aide à la rédaction.
- Les dates et consignes extraites sont présentées comme éléments à confirmer.
- Une faible confiance laisse le brouillon intact et demande une relecture.

## 8. Fiabilité et sécurité

- La publication validée et le travail d'envoi sont enregistrés dans une même
  transaction avant tout appel externe.
- Les travaux utilisent une file durable, des clés d'idempotence, des reprises
  automatiques et une boîte d'échec visible par le référent.
- Les webhooks entrants et de délivrabilité sont authentifiés, rejouables sans
  doublon et limités en débit.
- Les pièces restent privées jusqu'à validation. Les liens publics ou ciblés sont
  temporaires ou limités selon la visibilité.
- Les destinataires proviennent du registre de contacts validé du Webmail ; une
  copie nominative complète n'est pas créée dans LyceeGest.
- Les comptes de publication sont nominatifs avec MFA. Chaque validation,
  correction, envoi, export et consultation sensible est auditée.

## 9. Première version indispensable

- écran unique `Communications` dans l'espace administratif ;
- dépôt d'un texte ou document et création d'un brouillon ;
- aide à la rédaction, modèles et aperçu ;
- distinction public/interne et choix des groupes ;
- publication datée dans `À la une` ;
- notification email individuelle avec lien ;
- suivi des livraisons et boîte de réponses ;
- versions, expiration, recherche et archivage ;
- procédure simple de retrait ou correction d'un contact.

## 10. Utile ensuite

- transfert automatique depuis une adresse email dédiée ;
- récapitulatif hebdomadaire automatique ;
- notification PWA ;
- traduction assistée puis validée ;
- statistiques anonymes de consultation ;
- circuit de validation différent par service.

## 11. Exclu pour le pilote

- publication ou envoi autonome par l'IA ;
- mise en ligne publique automatique de toute pièce reçue par email ;
- remplacement de Gmail, de la messagerie académique ou de PRONOTE ;
- groupe email exposant les destinataires ;
- apprentissage du modèle sur les messages ou les contacts du lycée.

## 12. Critères de réussite

1. Une administration peut préparer un Hebdo à partir d'un PDF en moins de cinq
   minutes et sans ressaisir les informations principales.
2. Aucun email collectif de test n'expose l'adresse d'un autre destinataire.
3. Une information publiée apparaît immédiatement dans le flux du site avec sa
   date et son heure, sans redéploiement.
4. Une correction conserve l'historique et met à jour le même lien.
5. Un envoi rejoué ne crée pas de second message pour le même destinataire.
6. Une panne d'envoi laisse la communication publiée et les destinataires en
   attente de reprise.
7. Une réponse arrive dans la bonne boîte sans être distribuée à la liste.
8. Un contenu interne ne peut pas être obtenu depuis l'API publique.
9. Le parcours complet est utilisable à 320 px et au clavier.
10. Toutes les actions officielles possèdent un validateur et une trace datée.
11. Un contact désactivé ne peut pas être ajouté à un nouvel envoi.
