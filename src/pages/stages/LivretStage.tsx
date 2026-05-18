import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardList,
  Printer,
  Save,
  UserRound,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";

const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"] as const;

type DayKey = (typeof DAYS)[number];

type DayEntry = {
  activites: string;
  apprentissages: string;
  questions: string;
};

type SuiviProf = {
  dateVisite: string;
  modeContact: string;
  observations: string;
  pointsVigilance: string;
  appreciation: string;
  prochaineAction: string;
};

type LivretData = {
  attentes: string;
  objectifs: string;
  questionsAvantStage: string;
  presentationEntreprise: string;
  metiersObserves: string;
  reglesSecurite: string;
  journal: Record<DayKey, DayEntry>;
  activitesPreferees: string;
  competencesDecouvertes: string;
  difficultes: string;
  bilanPersonnel: string;
  projetOrientation: string;
  soumisEleveAt: string;
  suiviProf: SuiviProf;
};

type StageMeta = {
  id: string;
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  classeNom: string | null;
  statut: string;
  entrepriseNom: string | null;
  entrepriseAdresse: string | null;
  entrepriseTelephone: string | null;
  entrepriseEmail: string | null;
  tuteurNomQualite: string | null;
  tuteurEmail: string | null;
  tuteurTelephone: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  professeurReferent: string | null;
};

type LivretResponse = {
  stage: StageMeta;
  livret: LivretData;
  canEditEleve: boolean;
  canEditSuivi: boolean;
};

const DAY_LABELS: Record<DayKey, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
};

const PRINT_STYLES = `
  @media print {
    @page {
      size: A4 portrait;
      margin: 12mm;
    }

    body.printing-livret * {
      visibility: hidden !important;
    }

    body.printing-livret aside,
    body.printing-livret header,
    body.printing-livret .no-print {
      display: none !important;
    }

    body.printing-livret main {
      padding: 0 !important;
      overflow: visible !important;
      background: white !important;
    }

    body.printing-livret .livret-print,
    body.printing-livret .livret-print * {
      visibility: visible !important;
    }

    body.printing-livret .livret-print {
      display: block !important;
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      color: #111827;
      background: white;
      font-family: Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.35;
    }

    body.printing-livret .print-section {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 10mm;
    }

    body.printing-livret .print-page-break {
      break-before: page;
      page-break-before: always;
    }
  }

  @media screen {
    .livret-print {
      display: none;
    }
  }
`;

function emptyDay(): DayEntry {
  return { activites: "", apprentissages: "", questions: "" };
}

function emptyLivret(): LivretData {
  return {
    attentes: "",
    objectifs: "",
    questionsAvantStage: "",
    presentationEntreprise: "",
    metiersObserves: "",
    reglesSecurite: "",
    journal: {
      lundi: emptyDay(),
      mardi: emptyDay(),
      mercredi: emptyDay(),
      jeudi: emptyDay(),
      vendredi: emptyDay(),
    },
    activitesPreferees: "",
    competencesDecouvertes: "",
    difficultes: "",
    bilanPersonnel: "",
    projetOrientation: "",
    soumisEleveAt: "",
    suiviProf: {
      dateVisite: "",
      modeContact: "",
      observations: "",
      pointsVigilance: "",
      appreciation: "",
      prochaineAction: "",
    },
  };
}

function textValue(value: string | null | undefined): string {
  return value?.trim() ? value : "-";
}

function TextAreaField({
  label,
  value,
  disabled,
  rows = 4,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <textarea
        value={value}
        rows={rows}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-500"
      />
    </div>
  );
}

export default function LivretStagePage() {
  const { eleveId } = useParams<{ eleveId?: string }>();
  const navigate = useNavigate();
  const [stage, setStage] = useState<StageMeta | null>(null);
  const [livret, setLivret] = useState<LivretData>(() => emptyLivret());
  const [canEditEleve, setCanEditEleve] = useState(false);
  const [canEditSuivi, setCanEditSuivi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const apiPath = eleveId
    ? `stages/livret?eleveId=${encodeURIComponent(eleveId)}`
    : "stages/livret";

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch<LivretResponse>(apiPath);
        setStage(data.stage);
        setLivret(data.livret);
        setCanEditEleve(data.canEditEleve);
        setCanEditSuivi(data.canEditSuivi);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
      setLoading(false);
    })();
  }, [apiPath]);

  function updateLivret(field: keyof LivretData, value: string) {
    setLivret((current) => ({ ...current, [field]: value }));
    setSavedMessage("");
  }

  function updateDay(day: DayKey, field: keyof DayEntry, value: string) {
    setLivret((current) => ({
      ...current,
      journal: {
        ...current.journal,
        [day]: {
          ...current.journal[day],
          [field]: value,
        },
      },
    }));
    setSavedMessage("");
  }

  function updateSuivi(field: keyof SuiviProf, value: string) {
    setLivret((current) => ({
      ...current,
      suiviProf: {
        ...current.suiviProf,
        [field]: value,
      },
    }));
    setSavedMessage("");
  }

  async function save(submitEleve = false) {
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      const data = await apiFetch<LivretResponse>(apiPath, {
        method: "PUT",
        body: JSON.stringify({ livret, submitEleve }),
      });
      setLivret(data.livret);
      setStage(data.stage);
      setCanEditEleve(data.canEditEleve);
      setCanEditSuivi(data.canEditSuivi);
      setSavedMessage(
        submitEleve ? "Livret transmis pour suivi." : "Livret sauvegarde."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde");
    }
    setSaving(false);
  }

  function handlePrint() {
    document.body.classList.add("printing-livret");
    const cleanup = () => {
      document.body.classList.remove("printing-livret");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 500);
    }, 100);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!stage) {
    return (
      <div className="max-w-3xl mx-auto py-24 text-center">
        <p className="text-gray-400">Livret introuvable</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const eleveDisabled = !canEditEleve;
  const suiviDisabled = !canEditSuivi;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <style>{PRINT_STYLES}</style>

      <div className="no-print space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-gray-900">
              Livret de suivi de stage
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {stage.eleveNom} {stage.elevePrenom} - {stage.classeNom ?? "-"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
            >
              <Printer className="w-4 h-4" />
              Imprimer / PDF
            </button>
            {(canEditEleve || canEditSuivi) && (
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Sauvegarde..." : "Enregistrer"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {savedMessage && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
            {savedMessage}
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Dossier numerique
              </h2>
              <p className="text-sm text-gray-500">
                Convention officielle conservee separement, livret de suivi
                rempli ici et imprimable en PDF.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
            <p>
              <span className="text-gray-500">Entreprise :</span>{" "}
              {textValue(stage.entrepriseNom)}
            </p>
            <p>
              <span className="text-gray-500">Tuteur :</span>{" "}
              {textValue(stage.tuteurNomQualite)}
            </p>
            <p>
              <span className="text-gray-500">Referent lycee :</span>{" "}
              {textValue(stage.professeurReferent)}
            </p>
            <p>
              <span className="text-gray-500">Periode :</span>{" "}
              {textValue(stage.dateDebut)} au {textValue(stage.dateFin)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Avant le stage
              </h2>
              <p className="text-sm text-gray-500">
                Attentes, objectifs et questions a preparer.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextAreaField
              label="Ce que j'attends de ce stage"
              value={livret.attentes}
              disabled={eleveDisabled}
              onChange={(value) => updateLivret("attentes", value)}
            />
            <TextAreaField
              label="Mes objectifs personnels"
              value={livret.objectifs}
              disabled={eleveDisabled}
              onChange={(value) => updateLivret("objectifs", value)}
            />
            <TextAreaField
              label="Questions que je souhaite poser"
              value={livret.questionsAvantStage}
              disabled={eleveDisabled}
              onChange={(value) => updateLivret("questionsAvantStage", value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Decouverte de l'entreprise
              </h2>
              <p className="text-sm text-gray-500">
                Comprendre le lieu d'accueil et les metiers observes.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextAreaField
              label="Presentation de l'entreprise ou du service"
              value={livret.presentationEntreprise}
              disabled={eleveDisabled}
              rows={5}
              onChange={(value) => updateLivret("presentationEntreprise", value)}
            />
            <TextAreaField
              label="Metiers observes"
              value={livret.metiersObserves}
              disabled={eleveDisabled}
              onChange={(value) => updateLivret("metiersObserves", value)}
            />
            <TextAreaField
              label="Regles de securite, horaires, tenue, comportement attendu"
              value={livret.reglesSecurite}
              disabled={eleveDisabled}
              onChange={(value) => updateLivret("reglesSecurite", value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">
              Journal de bord
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              A completer chaque jour de stage.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {DAYS.map((day) => (
              <div key={day} className="rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  {DAY_LABELS[day]}
                </h3>
                <div className="grid gap-4 lg:grid-cols-3">
                  <TextAreaField
                    label="Activites observees ou realisees"
                    value={livret.journal[day].activites}
                    disabled={eleveDisabled}
                    rows={3}
                    onChange={(value) => updateDay(day, "activites", value)}
                  />
                  <TextAreaField
                    label="Ce que j'ai appris"
                    value={livret.journal[day].apprentissages}
                    disabled={eleveDisabled}
                    rows={3}
                    onChange={(value) => updateDay(day, "apprentissages", value)}
                  />
                  <TextAreaField
                    label="Questions ou mots nouveaux"
                    value={livret.journal[day].questions}
                    disabled={eleveDisabled}
                    rows={3}
                    onChange={(value) => updateDay(day, "questions", value)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Bilan de l'eleve
              </h2>
              <p className="text-sm text-gray-500">
                Ce que le stage apporte au projet d'orientation.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextAreaField
              label="Activites que j'ai preferees"
              value={livret.activitesPreferees}
              disabled={eleveDisabled}
              onChange={(value) => updateLivret("activitesPreferees", value)}
            />
            <TextAreaField
              label="Competences ou qualites decouvertes"
              value={livret.competencesDecouvertes}
              disabled={eleveDisabled}
              onChange={(value) => updateLivret("competencesDecouvertes", value)}
            />
            <TextAreaField
              label="Difficultes rencontrees"
              value={livret.difficultes}
              disabled={eleveDisabled}
              onChange={(value) => updateLivret("difficultes", value)}
            />
            <TextAreaField
              label="Bilan personnel"
              value={livret.bilanPersonnel}
              disabled={eleveDisabled}
              rows={5}
              onChange={(value) => updateLivret("bilanPersonnel", value)}
            />
            <TextAreaField
              label="Lien avec mon projet d'orientation"
              value={livret.projetOrientation}
              disabled={eleveDisabled}
              onChange={(value) => updateLivret("projetOrientation", value)}
            />
            {canEditEleve && (
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  onClick={() => save(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Enregistrer
                </button>
                <button
                  onClick={() => save(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Transmettre le livret
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <UserRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Suivi professeur
              </h2>
              <p className="text-sm text-gray-500">
                Partie reservee au PP, a l'administration ou au professeur
                referent.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de contact ou visite
                </label>
                <input
                  type="date"
                  value={livret.suiviProf.dateVisite}
                  disabled={suiviDisabled}
                  onChange={(event) => updateSuivi("dateVisite", event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mode de suivi
                </label>
                <input
                  type="text"
                  value={livret.suiviProf.modeContact}
                  disabled={suiviDisabled}
                  placeholder="Visite, telephone, mail..."
                  onChange={(event) => updateSuivi("modeContact", event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>
            <TextAreaField
              label="Observations du suivi"
              value={livret.suiviProf.observations}
              disabled={suiviDisabled}
              rows={5}
              onChange={(value) => updateSuivi("observations", value)}
            />
            <TextAreaField
              label="Points de vigilance"
              value={livret.suiviProf.pointsVigilance}
              disabled={suiviDisabled}
              onChange={(value) => updateSuivi("pointsVigilance", value)}
            />
            <TextAreaField
              label="Appreciation / bilan du professeur referent"
              value={livret.suiviProf.appreciation}
              disabled={suiviDisabled}
              rows={5}
              onChange={(value) => updateSuivi("appreciation", value)}
            />
            <TextAreaField
              label="Prochaine action"
              value={livret.suiviProf.prochaineAction}
              disabled={suiviDisabled}
              onChange={(value) => updateSuivi("prochaineAction", value)}
            />
            {canEditSuivi && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => save(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Enregistrer le suivi
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PrintableLivret stage={stage} livret={livret} />
    </div>
  );
}

function PrintableLivret({
  stage,
  livret,
}: {
  stage: StageMeta;
  livret: LivretData;
}) {
  return (
    <div className="livret-print">
      <section className="print-section">
        <h1 style={{ fontSize: "20pt", margin: "0 0 4mm" }}>
          Livret de suivi - Stage d'observation 2nde GT
        </h1>
        <p style={{ margin: "0 0 8mm", color: "#4b5563" }}>
          Lycee Blaise Cendrars - Sevran - Annee scolaire 2025-2026
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <PrintRow label="Eleve" value={`${stage.eleveNom} ${stage.elevePrenom}`} />
            <PrintRow label="Classe" value={textValue(stage.classeNom)} />
            <PrintRow label="Periode" value={`${textValue(stage.dateDebut)} au ${textValue(stage.dateFin)}`} />
            <PrintRow label="Entreprise" value={textValue(stage.entrepriseNom)} />
            <PrintRow label="Adresse" value={textValue(stage.entrepriseAdresse)} />
            <PrintRow label="Tuteur" value={textValue(stage.tuteurNomQualite)} />
            <PrintRow label="Professeur referent" value={textValue(stage.professeurReferent)} />
          </tbody>
        </table>
      </section>

      <PrintTextSection title="Avant le stage" items={[
        ["Attentes", livret.attentes],
        ["Objectifs personnels", livret.objectifs],
        ["Questions a poser", livret.questionsAvantStage],
      ]} />

      <PrintTextSection title="Decouverte de l'entreprise" items={[
        ["Presentation", livret.presentationEntreprise],
        ["Metiers observes", livret.metiersObserves],
        ["Regles et securite", livret.reglesSecurite],
      ]} />

      <section className="print-section print-page-break">
        <h2 style={{ fontSize: "15pt", margin: "0 0 4mm" }}>Journal de bord</h2>
        {DAYS.map((day) => (
          <div key={day} style={{ marginBottom: "6mm" }}>
            <h3 style={{ fontSize: "12pt", margin: "0 0 2mm" }}>
              {DAY_LABELS[day]}
            </h3>
            <p><strong>Activites :</strong> {textValue(livret.journal[day].activites)}</p>
            <p><strong>Apprentissages :</strong> {textValue(livret.journal[day].apprentissages)}</p>
            <p><strong>Questions :</strong> {textValue(livret.journal[day].questions)}</p>
          </div>
        ))}
      </section>

      <PrintTextSection title="Bilan de l'eleve" items={[
        ["Activites preferees", livret.activitesPreferees],
        ["Competences decouvertes", livret.competencesDecouvertes],
        ["Difficultes", livret.difficultes],
        ["Bilan personnel", livret.bilanPersonnel],
        ["Projet d'orientation", livret.projetOrientation],
      ]} />

      <PrintTextSection title="Suivi professeur" items={[
        ["Date de contact ou visite", livret.suiviProf.dateVisite],
        ["Mode de suivi", livret.suiviProf.modeContact],
        ["Observations", livret.suiviProf.observations],
        ["Points de vigilance", livret.suiviProf.pointsVigilance],
        ["Appreciation", livret.suiviProf.appreciation],
        ["Prochaine action", livret.suiviProf.prochaineAction],
      ]} />
    </div>
  );
}

function PrintRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ width: "35%", border: "1px solid #d1d5db", padding: "6px", fontWeight: 700 }}>
        {label}
      </td>
      <td style={{ border: "1px solid #d1d5db", padding: "6px" }}>{value}</td>
    </tr>
  );
}

function PrintTextSection({
  title,
  items,
}: {
  title: string;
  items: Array<[string, string]>;
}) {
  return (
    <section className="print-section">
      <h2 style={{ fontSize: "15pt", margin: "0 0 4mm" }}>{title}</h2>
      {items.map(([label, value]) => (
        <div key={label} style={{ marginBottom: "4mm" }}>
          <p style={{ fontWeight: 700, margin: "0 0 1mm" }}>{label}</p>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{textValue(value)}</p>
        </div>
      ))}
    </section>
  );
}
