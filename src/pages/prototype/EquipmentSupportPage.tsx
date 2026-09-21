import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  MapPin,
  MonitorCog,
  RefreshCw,
  ShieldCheck,
  TicketCheck,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPortalShell } from "../../components/PublicPortalShell";
import { apiFetch } from "../../lib/api";
import { rememberSupportRequests } from "../../lib/support-device-memory";
import {
  EQUIPMENT_IMPACT_LABELS,
  EQUIPMENT_TYPE_LABELS,
  isPublicEquipmentVisitsPayload,
  type EquipmentImpact,
  type EquipmentType,
  type PublicEquipmentVisit,
} from "../../../shared/equipment-support";
import { isValidSupportPublicListPayload } from "../../../shared/support-public-list-payload-policy";
import "./equipment-support.css";

type RequestSummary = {
  publicCode: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
};

type CreatedRequest = {
  request: { publicCode: string; status: string; createdAt: string };
  duplicate: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  nouveau: "Reçu",
  a_qualifier: "À préciser",
  assigne: "Pris en charge",
  en_cours: "En cours",
  attente_demandeur: "Votre réponse est attendue",
  attente_interne: "Préparé pour intervention",
  resolu: "Résolu",
  clos: "Clos",
  indesirable: "Classé",
};

function formatVisit(visit: PublicEquipmentVisit): string {
  const start = new Date(visit.startsAt);
  const end = new Date(visit.endsAt);
  const day = start.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const from = start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const to = end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${day}, de ${from} à ${to}`;
}

export default function EquipmentSupportPage() {
  const [visits, setVisits] = useState<PublicEquipmentVisit[]>([]);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedRequest | null>(null);
  const idempotencyRef = useRef(crypto.randomUUID());

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredChannel, setPreferredChannel] = useState<"email" | "phone">("email");
  const [equipmentType, setEquipmentType] = useState<EquipmentType>("desktop");
  const [roomCode, setRoomCode] = useState("");
  const [inventoryNumber, setInventoryNumber] = useState("");
  const [symptomSummary, setSymptomSummary] = useState("");
  const [impact, setImpact] = useState<EquipmentImpact>("single_user");
  const [safetyRisk, setSafetyRisk] = useState(false);
  const [availability, setAvailability] = useState("");
  const [preferredVisitId, setPreferredVisitId] = useState("");

  useEffect(() => {
    document.title = "Matériel du lycée et passages SPIE · Lycée Blaise Cendrars";
  }, []);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiFetch<unknown>("equipment/visits"),
      apiFetch<unknown>("support/requests"),
    ]).then(([visitResult, requestResult]) => {
      if (!active) return;
      if (visitResult.status === "fulfilled" && isPublicEquipmentVisitsPayload(visitResult.value)) {
        setVisits(visitResult.value.visits);
      }
      if (requestResult.status === "fulfilled" && isValidSupportPublicListPayload(requestResult.value)) {
        const payload = requestResult.value as { requests: RequestSummary[] };
        setRequests(payload.requests.filter(request => request.category === "ordinateur"));
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const nextVisit = visits[0] ?? null;
  const equipmentLabel = EQUIPMENT_TYPE_LABELS[equipmentType];
  const subject = roomCode.trim() ? `${equipmentLabel} · ${roomCode.trim()}` : equipmentLabel;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (preferredChannel === "email" && !email.trim()) {
      setError("Indiquez votre email professionnel, ou choisissez le téléphone.");
      return;
    }
    if (preferredChannel === "phone" && !phone.trim()) {
      setError("Indiquez votre téléphone, ou choisissez l’email.");
      return;
    }
    setSaving(true);
    const description = [
      `Matériel : ${EQUIPMENT_TYPE_LABELS[equipmentType]}.`,
      `Lieu : ${roomCode.trim()}.`,
      inventoryNumber.trim() ? `Inventaire : ${inventoryNumber.trim()}.` : "",
      `Constat : ${symptomSummary.trim()}`,
      `Impact : ${EQUIPMENT_IMPACT_LABELS[impact]}.`,
      safetyRisk ? "Risque matériel signalé : appareil mis à l’écart si cela pouvait être fait sans danger." : "Aucun risque matériel visible signalé.",
      availability.trim() ? `Disponibilités : ${availability.trim()}.` : "",
    ].filter(Boolean).join("\n");
    try {
      const payload = await apiFetch<CreatedRequest>("support/requests", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyRef.current },
        body: JSON.stringify({
          requesterType: "professeur",
          beneficiaryType: "self",
          requesterFirstName: firstName,
          requesterLastName: lastName,
          email,
          phone,
          preferredChannel,
          fallbackAllowed: true,
          communicationSupport: false,
          category: "ordinateur",
          subcategory: "materiel_lycee",
          subject,
          description,
          conversation: [{ role: "requester", content: description }],
          equipmentReportVersion: "1",
          equipmentType,
          roomCode,
          inventoryNumber,
          symptomSummary,
          impact,
          safetyRisk: safetyRisk ? "yes" : "no",
          availability,
          preferredVisitId,
          website: "",
        }),
      });
      setCreated(payload);
      const remembered = {
        publicCode: payload.request.publicCode,
        subject,
        category: "ordinateur",
        status: payload.request.status,
        priority: safetyRisk ? "p1" : "p3",
        createdAt: payload.request.createdAt,
        updatedAt: payload.request.createdAt,
      };
      await rememberSupportRequests([remembered]);
      setRequests(current => [remembered, ...current.filter(item => item.publicCode !== remembered.publicCode)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le signalement n’a pas pu être enregistré.");
    } finally {
      setSaving(false);
    }
  }

  return <PublicPortalShell view="services" className="equipment-support-portal">
    <main className="equipment-page">
      <Link className="equipment-back" to="/?view=services"><ArrowLeft aria-hidden="true" /> Mes services</Link>

      <header className="equipment-hero">
        <div>
          <p className="equipment-eyebrow">Matériel du lycée · personnels</p>
          <h1>Signaler. Suivre. Préparer le passage SPIE.</h1>
          <p>Un seul dossier pour décrire le problème, joindre ensuite une photo, recevoir les réponses et suivre l’intervention.</p>
          <div className="equipment-hero-actions">
            <a href="#signaler">Signaler un problème <ArrowRight aria-hidden="true" /></a>
            <Link to="/?view=requests">Suivre mes demandes <TicketCheck aria-hidden="true" /></Link>
          </div>
        </div>
        <div className="equipment-next-visit">
          <span><CalendarDays aria-hidden="true" /> Prochain passage publié</span>
          {loading ? <p><RefreshCw className="equipment-spin" aria-hidden="true" /> Chargement…</p> : nextVisit ? <>
            <strong>{formatVisit(nextVisit)}</strong>
            {nextVisit.location && <small><MapPin aria-hidden="true" /> {nextVisit.location}</small>}
            {nextVisit.publicNote && <p>{nextVisit.publicNote}</p>}
          </> : <><strong>Date en attente de confirmation</strong><p>Le créneau apparaîtra ici dès qu’il sera confirmé par le lycée.</p></>}
        </div>
      </header>

      <section className="equipment-roles" aria-labelledby="equipment-roles-title">
        <p className="equipment-eyebrow">Un circuit sans confusion</p>
        <h2 id="equipment-roles-title">Qui fait quoi ?</h2>
        <div>
          <article><span>01</span><strong>Le professeur signale</strong><p>Il indique la salle, le matériel, le symptôme et l’impact sur le cours.</p></article>
          <article><span>02</span><strong>Le référent prépare</strong><p>Il vérifie les informations, regroupe les incidents et transmet au bon intervenant. Il n’est pas chargé de réparer le matériel.</p></article>
          <article><span>03</span><strong>SPIE intervient</strong><p>Le technicien diagnostique, répare ou organise la suite lors de son passage.</p></article>
        </div>
      </section>

      <div className="equipment-layout">
        <section id="signaler" className="equipment-form-card" aria-labelledby="equipment-form-title">
          {created ? <div className="equipment-success" role="status">
            <CheckCircle2 aria-hidden="true" />
            <p className="equipment-eyebrow">Signalement enregistré</p>
            <h2 id="equipment-form-title">Dossier {created.request.publicCode}</h2>
            <p>{created.duplicate ? "Un dossier récent correspondant existe déjà ; il a été conservé pour éviter un doublon." : "La coordination numérique peut maintenant le qualifier et le préparer pour SPIE."}</p>
            <div><Link to="/?view=requests">Ouvrir le dossier et joindre une photo</Link><button type="button" onClick={() => { setCreated(null); idempotencyRef.current = crypto.randomUUID(); setSymptomSummary(""); setInventoryNumber(""); }}>Signaler un autre matériel</button></div>
          </div> : <>
            <div className="equipment-form-heading"><span><MonitorCog aria-hidden="true" /></span><div><p className="equipment-eyebrow">Dossier guidé</p><h2 id="equipment-form-title">Quel matériel pose problème ?</h2><p>Les champs utiles au technicien sont réunis ici. Comptez environ deux minutes.</p></div></div>
            <form onSubmit={submit}>
              <fieldset><legend>1. Localiser et identifier</legend>
                <div className="equipment-grid-two">
                  <label>Type de matériel<select value={equipmentType} onChange={event => setEquipmentType(event.target.value as EquipmentType)}>{Object.entries(EQUIPMENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label>Salle ou lieu<input value={roomCode} onChange={event => setRoomCode(event.target.value)} required maxLength={120} placeholder="Ex. B204, CDI, salle des professeurs" /></label>
                </div>
                <label>Numéro d’inventaire <span>(si visible)</span><input value={inventoryNumber} onChange={event => setInventoryNumber(event.target.value)} maxLength={120} placeholder="Étiquette du matériel" /></label>
              </fieldset>
              <fieldset><legend>2. Décrire ce qui se passe</legend>
                <label>Problème constaté<textarea value={symptomSummary} onChange={event => setSymptomSummary(event.target.value)} required minLength={8} maxLength={700} rows={4} placeholder="Ce que vous voyez, depuis quand, et ce que vous avez déjà essayé sans démonter l’appareil." /></label>
                <label>Impact sur le travail<select value={impact} onChange={event => setImpact(event.target.value as EquipmentImpact)}>{Object.entries(EQUIPMENT_IMPACT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="equipment-risk"><input type="checkbox" checked={safetyRisk} onChange={event => setSafetyRisk(event.target.checked)} /><span><strong>Fumée, étincelles, forte surchauffe, liquide ou odeur de brûlé</strong><small>Si oui : ne démontez rien. Éteignez et débranchez uniquement si cela peut être fait sans danger, puis avertissez immédiatement l’accueil du lycée.</small></span></label>
              </fieldset>
              <fieldset><legend>3. Faciliter l’intervention</legend>
                <label>Quand le matériel est-il accessible ? <span>(facultatif)</span><input value={availability} onChange={event => setAvailability(event.target.value)} maxLength={300} placeholder="Ex. lundi avant 10 h, clés à l’accueil" /></label>
                {visits.length > 0 && <label>Passage souhaité <span>(indicatif)</span><select value={preferredVisitId} onChange={event => setPreferredVisitId(event.target.value)}><option value="">Aucune préférence</option>{visits.map(visit => <option key={visit.id} value={visit.id}>{formatVisit(visit)}</option>)}</select></label>}
              </fieldset>
              <fieldset><legend>4. Vos coordonnées professionnelles</legend>
                <div className="equipment-grid-two"><label>Prénom<input autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} required maxLength={100} /></label><label>Nom<input autoComplete="family-name" value={lastName} onChange={event => setLastName(event.target.value)} required maxLength={100} /></label></div>
                <div className="equipment-grid-two"><label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} placeholder="prenom.nom@ac-creteil.fr" /></label><label>Téléphone<input type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} maxLength={30} /></label></div>
                <div className="equipment-channel" role="group" aria-label="Recevoir les réponses par"><span>Recevoir les réponses par</span><label><input type="radio" name="channel" checked={preferredChannel === "email"} onChange={() => setPreferredChannel("email")} /> Email</label><label><input type="radio" name="channel" checked={preferredChannel === "phone"} onChange={() => setPreferredChannel("phone")} /> Téléphone</label></div>
              </fieldset>
              {error && <p className="equipment-error" role="alert"><AlertTriangle aria-hidden="true" />{error}</p>}
              <button className="equipment-submit" type="submit" disabled={saving}>{saving ? <><RefreshCw className="equipment-spin" aria-hidden="true" /> Enregistrement…</> : <>Créer le dossier <ArrowRight aria-hidden="true" /></>}</button>
              <p className="equipment-form-note"><ShieldCheck aria-hidden="true" /> Aucun mot de passe ni code de connexion ne doit être écrit dans ce dossier.</p>
            </form>
          </>}
        </section>

        <aside className="equipment-side">
          <section><div className="equipment-side-title"><TicketCheck aria-hidden="true" /><div><p className="equipment-eyebrow">Suivi</p><h2>Mes incidents matériels</h2></div></div>{requests.length > 0 ? <div className="equipment-request-list">{requests.slice(0, 4).map(request => <Link key={request.publicCode} to={`/?view=requests&request=${encodeURIComponent(request.publicCode)}`}><span><strong>{request.subject}</strong><small>{request.publicCode}</small></span><em>{STATUS_LABELS[request.status] ?? request.status}</em></Link>)}</div> : <p>Vos signalements créés sur cet appareil apparaîtront ici. Les réponses et les pièces jointes restent dans « Mes demandes ».</p>}<Link className="equipment-side-link" to="/?view=requests">Voir toutes mes demandes <ArrowRight aria-hidden="true" /></Link></section>
          <section><div className="equipment-side-title"><Camera aria-hidden="true" /><div><p className="equipment-eyebrow">Après l’envoi</p><h2>Ajouter une photo</h2></div></div><p>Ouvrez le dossier dans « Mes demandes », puis joignez une photo de l’équipement ou du message d’erreur. Évitez les visages, listes d’élèves et mots de passe.</p></section>
          <section><div className="equipment-side-title"><ClipboardCheck aria-hidden="true" /><div><p className="equipment-eyebrow">Préparation SPIE</p><h2>Un dossier exploitable</h2></div></div><p>Le numéro de salle, l’étiquette d’inventaire, le symptôme et les disponibilités permettent de préparer le passage sans échange inutile.</p><p className="equipment-delay"><Clock3 aria-hidden="true" /> La date de passage ne garantit pas une réparation immédiate : le diagnostic du technicien détermine la suite.</p></section>
        </aside>
      </div>
    </main>
  </PublicPortalShell>;
}
