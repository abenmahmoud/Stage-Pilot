import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { StageStatusBadge } from "../../components/ui/StatusBadge";
import { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import {
  ENTREPRISE_TYPES,
  STAGE_STATUS,
  type StageStatut,
} from "../../lib/types";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  FileText,
  Mail,
  Save,
  UserPlus,
  UserRound,
} from "lucide-react";

interface ProfesseurOption {
  id: string;
  nom: string;
  prenom: string;
  matieres: string | null;
}

interface StageForm {
  statut: StageStatut;
  professeurReferentId: string;
  entrepriseNom: string;
  entrepriseAdresse: string;
  entrepriseTelephone: string;
  entrepriseEmail: string;
  entrepriseRepresentant: string;
  entrepriseQualite: string;
  entrepriseType: string;
  tuteurNomQualite: string;
  tuteurEmail: string;
  tuteurTelephone: string;
  faitLe: string;
}

interface StageDetail extends StageForm {
  id: string;
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  classeNom: string | null;
  professeurReferent: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  canManage: boolean;
  professeurs: ProfesseurOption[];
}

const EMPTY_FORM: StageForm = {
  statut: "a_completer",
  professeurReferentId: "",
  entrepriseNom: "",
  entrepriseAdresse: "",
  entrepriseTelephone: "",
  entrepriseEmail: "",
  entrepriseRepresentant: "",
  entrepriseQualite: "",
  entrepriseType: "",
  tuteurNomQualite: "",
  tuteurEmail: "",
  tuteurTelephone: "",
  faitLe: "",
};

function valueOrEmpty(value: string | null | undefined): string {
  return value ?? "";
}

function toForm(stage: StageDetail): StageForm {
  return {
    statut: stage.statut,
    professeurReferentId: valueOrEmpty(stage.professeurReferentId),
    entrepriseNom: valueOrEmpty(stage.entrepriseNom),
    entrepriseAdresse: valueOrEmpty(stage.entrepriseAdresse),
    entrepriseTelephone: valueOrEmpty(stage.entrepriseTelephone),
    entrepriseEmail: valueOrEmpty(stage.entrepriseEmail),
    entrepriseRepresentant: valueOrEmpty(stage.entrepriseRepresentant),
    entrepriseQualite: valueOrEmpty(stage.entrepriseQualite),
    entrepriseType: valueOrEmpty(stage.entrepriseType),
    tuteurNomQualite: valueOrEmpty(stage.tuteurNomQualite),
    tuteurEmail: valueOrEmpty(stage.tuteurEmail),
    tuteurTelephone: valueOrEmpty(stage.tuteurTelephone),
    faitLe: valueOrEmpty(stage.faitLe),
  };
}

function profLabel(prof: ProfesseurOption): string {
  return `${prof.nom} ${prof.prenom}${prof.matieres ? ` - ${prof.matieres}` : ""}`;
}

export default function StageDetailPage() {
  const { eleveId } = useParams<{ eleveId: string }>();
  const navigate = useNavigate();
  const [stage, setStage] = useState<StageDetail | null>(null);
  const [form, setForm] = useState<StageForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (!eleveId) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch<StageDetail>(`stages/${eleveId}`);
        setStage(data);
        setForm(toForm(data));
      } catch (e) {
        setStage(null);
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
      setLoading(false);
    })();
  }, [eleveId]);

  function update(field: keyof StageForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSavedMessage("");
  }

  async function save() {
    if (!eleveId) return;
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      const updated = await apiFetch<StageDetail>(`stages/${eleveId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          professeurReferentId: form.professeurReferentId || null,
        }),
      });
      setStage(updated);
      setForm(toForm(updated));
      setSavedMessage("Dossier stage mis a jour.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde");
    }
    setSaving(false);
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
      <div className="max-w-3xl mx-auto space-y-4 py-24 text-center">
        <p className="text-gray-400">Stage introuvable</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const canManage = stage.canManage;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/stages")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au tableau de bord
      </button>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            {stage.eleveNom} {stage.elevePrenom}
          </h1>
          <p className="text-sm text-gray-500">
            {stage.classeNom ?? "-"} - Stage du {stage.dateDebut ?? "-"} au{" "}
            {stage.dateFin ?? "-"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StageStatusBadge status={form.statut} />
          {canManage && (
            <button
              onClick={save}
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

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Entreprise
                </h2>
                <p className="text-sm text-gray-500">
                  Informations verifiees pour la convention
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom de l'entreprise / organisme
                  </label>
                  <input
                    type="text"
                    value={form.entrepriseNom}
                    disabled={!canManage}
                    onChange={(event) => update("entrepriseNom", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type de structure
                  </label>
                  <select
                    value={form.entrepriseType}
                    disabled={!canManage}
                    onChange={(event) => update("entrepriseType", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="">Choisir</option>
                    {ENTREPRISE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse complete
                </label>
                <input
                  type="text"
                  value={form.entrepriseAdresse}
                  disabled={!canManage}
                  onChange={(event) => update("entrepriseAdresse", event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telephone entreprise
                  </label>
                  <input
                    type="tel"
                    value={form.entrepriseTelephone}
                    disabled={!canManage}
                    onChange={(event) =>
                      update("entrepriseTelephone", event.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email entreprise
                  </label>
                  <input
                    type="email"
                    value={form.entrepriseEmail}
                    disabled={!canManage}
                    onChange={(event) => update("entrepriseEmail", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Representant
                  </label>
                  <input
                    type="text"
                    value={form.entrepriseRepresentant}
                    disabled={!canManage}
                    onChange={(event) =>
                      update("entrepriseRepresentant", event.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qualite du representant
                  </label>
                  <input
                    type="text"
                    value={form.entrepriseQualite}
                    disabled={!canManage}
                    onChange={(event) => update("entrepriseQualite", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Tuteur entreprise
                </h2>
                <p className="text-sm text-gray-500">
                  Contact dans la structure d'accueil
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom et qualite du tuteur
                </label>
                <input
                  type="text"
                  value={form.tuteurNomQualite}
                  disabled={!canManage}
                  onChange={(event) => update("tuteurNomQualite", event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email tuteur
                  </label>
                  <input
                    type="email"
                    value={form.tuteurEmail}
                    disabled={!canManage}
                    onChange={(event) => update("tuteurEmail", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telephone tuteur
                  </label>
                  <input
                    type="tel"
                    value={form.tuteurTelephone}
                    disabled={!canManage}
                    onChange={(event) => update("tuteurTelephone", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Suivi stage
                </h2>
                <p className="text-sm text-gray-500">Referent et statut</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Professeur referent
                </label>
                <select
                  value={form.professeurReferentId}
                  disabled={!canManage}
                  onChange={(event) =>
                    update("professeurReferentId", event.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                >
                  <option value="">Affecter un professeur</option>
                  {stage.professeurs.map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {profLabel(prof)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut du dossier
                </label>
                <select
                  value={form.statut}
                  disabled={!canManage}
                  onChange={(event) =>
                    update("statut", event.target.value as StageStatut)
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                >
                  {Object.entries(STAGE_STATUS)
                    .filter(([value]) => value !== "module_desactive")
                    .map(([value, info]) => (
                      <option key={value} value={value}>
                        {info.label}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fait le
                </label>
                <input
                  type="date"
                  value={form.faitLe}
                  disabled={!canManage}
                  onChange={(event) => update("faitLe", event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              {canManage && (
                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Sauvegarde..." : "Enregistrer les modifications"}
                </button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">
                Documents et relances
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.statut === "soumis" && (
                <button className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-all">
                  <FileText className="w-4 h-4" />
                  Generer la convention PDF
                </button>
              )}
              {form.statut === "a_completer" && (
                <button className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition-all">
                  <Mail className="w-4 h-4" />
                  Envoyer un rappel
                </button>
              )}
              {!["a_completer", "soumis"].includes(form.statut) && (
                <p className="text-sm text-gray-500">
                  Le dossier est en cours de suivi. Les actions PDF seront
                  disponibles selon le statut du stage.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
