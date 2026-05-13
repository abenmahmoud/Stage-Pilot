import { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { ENTREPRISE_TYPES } from "../../lib/types";
import { StageStatusBadge } from "../../components/ui/StatusBadge";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import type { StageStatut } from "../../lib/types";
import {
  Building2,
  User,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
} from "lucide-react";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"] as const;

interface StageData {
  id: number;
  statut: StageStatut;
  entrepriseNom: string;
  entrepriseRepresentant: string;
  entrepriseQualite: string;
  entrepriseAdresse: string;
  entrepriseTelephone: string;
  entrepriseEmail: string;
  entrepriseType: string;
  tuteurNomQualite: string;
  tuteurEmail: string;
  tuteurTelephone: string;
  faitLe: string;
  horaires: Record<string, string>;
  [key: string]: unknown;
}

const EMPTY_STAGE: Partial<StageData> = {
  entrepriseNom: "",
  entrepriseRepresentant: "",
  entrepriseQualite: "",
  entrepriseAdresse: "",
  entrepriseTelephone: "",
  entrepriseEmail: "",
  entrepriseType: "",
  tuteurNomQualite: "",
  tuteurEmail: "",
  tuteurTelephone: "",
  faitLe: "",
  horaires: {},
};

export default function MonStage() {
  const [stage, setStage] = useState<Partial<StageData>>(EMPTY_STAGE);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<StageData>("stages/mine");
        setStage(data);
        if (
          data.statut &&
          !["a_completer", "en_cours_saisie"].includes(data.statut)
        ) {
          setStep(4);
        }
      } catch {
        // new stage
      }
      setLoading(false);
    })();
  }, []);

  function update(field: string, value: string) {
    setStage((prev) => ({ ...prev, [field]: value }));
  }

  function updateHoraire(jour: string, periode: string, bound: string, value: string) {
    setStage((prev) => ({
      ...prev,
      horaires: {
        ...(prev.horaires || {}),
        [`${jour}_${periode}_${bound}`]: value,
      },
    }));
  }

  async function save(submit = false) {
    setSaving(true);
    setError("");
    try {
      const body = { ...stage, submit };
      const res = await apiFetch<StageData>("stages/mine", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setStage(res);
      if (submit) setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde");
    }
    setSaving(false);
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );

  const steps = [
    { icon: Building2, label: "Entreprise" },
    { icon: User, label: "Tuteur" },
    { icon: Clock, label: "Horaires" },
    { icon: CheckCircle2, label: "Confirmation" },
  ];

  const isPostSubmission = stage.statut && !["a_completer", "en_cours_saisie"].includes(stage.statut);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-gray-900">
          Mon stage
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Stage d'observation — du 15 au 26 juin 2026
        </p>
      </div>

      {/* Stepper */}
      {!isPostSubmission && (
        <div className="flex items-center gap-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div key={i} className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => i <= step && setStep(i)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all w-full
                    ${active ? "bg-primary-500 text-white shadow-md" : done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < steps.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Entreprise */}
      {step === 0 && !isPostSubmission && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">L'entreprise</h2>
            <p className="text-sm text-gray-500">
              Informations sur l'organisme d'accueil
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de l'entreprise / organisme *
              </label>
              <input
                type="text"
                value={stage.entrepriseNom || ""}
                onChange={(e) => update("entrepriseNom", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="Ex: Mairie de Sevran"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de structure *
              </label>
              <select
                value={stage.entrepriseType || ""}
                onChange={(e) => update("entrepriseType", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
              >
                <option value="">Choisir…</option>
                {ENTREPRISE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse complète *
              </label>
              <input
                type="text"
                value={stage.entrepriseAdresse || ""}
                onChange={(e) => update("entrepriseAdresse", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="Rue, code postal, ville"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={stage.entrepriseTelephone || ""}
                  onChange={(e) => update("entrepriseTelephone", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={stage.entrepriseEmail || ""}
                  onChange={(e) => update("entrepriseEmail", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Représentant (M. / Mme) *
              </label>
              <input
                type="text"
                value={stage.entrepriseRepresentant || ""}
                onChange={(e) => update("entrepriseRepresentant", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="Nom du responsable"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qualité du représentant *
              </label>
              <input
                type="text"
                value={stage.entrepriseQualite || ""}
                onChange={(e) => update("entrepriseQualite", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="Ex: Chef d'entreprise, Directeur"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => { save(); setStep(1); }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-all"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Tuteur */}
      {step === 1 && !isPostSubmission && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">Le tuteur</h2>
            <p className="text-sm text-gray-500">
              Personne responsable au sein de l'organisme d'accueil
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom et qualité du tuteur *
              </label>
              <input
                type="text"
                value={stage.tuteurNomQualite || ""}
                onChange={(e) => update("tuteurNomQualite", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="Ex: M. Dupont, Ingénieur"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email du tuteur
              </label>
              <input
                type="email"
                value={stage.tuteurEmail || ""}
                onChange={(e) => update("tuteurEmail", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone du tuteur
              </label>
              <input
                type="tel"
                value={stage.tuteurTelephone || ""}
                onChange={(e) => update("tuteurTelephone", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(0)}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </button>
              <button
                onClick={() => { save(); setStep(2); }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-all"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Horaires */}
      {step === 2 && !isPostSubmission && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">Les horaires</h2>
            <p className="text-sm text-gray-500">
              Horaires de présence du lundi au vendredi
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 font-medium text-center">
              AUCUN STAGE LE WEEK-END
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs font-medium text-gray-500 uppercase">
                    <th className="py-2 px-2 text-left">Jour</th>
                    <th className="py-2 px-2" colSpan={2}>Matin</th>
                    <th className="py-2 px-2" colSpan={2}>Après-midi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {JOURS.map((jour) => (
                    <tr key={jour}>
                      <td className="py-2.5 px-2 font-medium text-gray-700">{jour}</td>
                      <td className="py-2 px-1">
                        <input
                          type="time"
                          value={(stage.horaires as Record<string, string>)?.[`${jour.toLowerCase()}_matin_debut`] || ""}
                          onChange={(e) => updateHoraire(jour.toLowerCase(), "matin", "debut", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-primary-500"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="time"
                          value={(stage.horaires as Record<string, string>)?.[`${jour.toLowerCase()}_matin_fin`] || ""}
                          onChange={(e) => updateHoraire(jour.toLowerCase(), "matin", "fin", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-primary-500"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="time"
                          value={(stage.horaires as Record<string, string>)?.[`${jour.toLowerCase()}_apm_debut`] || ""}
                          onChange={(e) => updateHoraire(jour.toLowerCase(), "apm", "debut", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-primary-500"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="time"
                          value={(stage.horaires as Record<string, string>)?.[`${jour.toLowerCase()}_apm_fin`] || ""}
                          onChange={(e) => updateHoraire(jour.toLowerCase(), "apm", "fin", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-primary-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </button>
              <button
                onClick={() => { save(); setStep(3); }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-all"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirmation */}
      {step === 3 && !isPostSubmission && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">Récapitulatif</h2>
            <p className="text-sm text-gray-500">
              Vérifiez vos informations avant de soumettre
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl bg-gray-50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Entreprise</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Nom :</span> {stage.entrepriseNom}</div>
                <div><span className="text-gray-500">Type :</span> {stage.entrepriseType}</div>
                <div className="col-span-2"><span className="text-gray-500">Adresse :</span> {stage.entrepriseAdresse}</div>
                <div><span className="text-gray-500">Représentant :</span> {stage.entrepriseRepresentant}</div>
                <div><span className="text-gray-500">Qualité :</span> {stage.entrepriseQualite}</div>
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Tuteur</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="col-span-2"><span className="text-gray-500">Nom/Qualité :</span> {stage.tuteurNomQualite}</div>
                <div><span className="text-gray-500">Email :</span> {stage.tuteurEmail}</div>
                <div><span className="text-gray-500">Tél :</span> {stage.tuteurTelephone}</div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fait le (date de signature souhaitée)
              </label>
              <input
                type="date"
                value={stage.faitLe || ""}
                onChange={(e) => update("faitLe", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </button>
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? "Envoi…" : "Soumettre ma saisie"}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Post-submission status */}
      {(step === 4 || isPostSubmission) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">Suivi de votre dossier</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">Statut actuel :</span>
              <StageStatusBadge status={(stage.statut as StageStatut) || "a_completer"} />
            </div>

            {/* Timeline */}
            <div className="flex items-center gap-0">
              {[
                { label: "Saisie", done: true },
                { label: "Convention générée", done: ["convention_generee", "convention_signee", "stage_en_cours", "stage_termine"].includes(stage.statut || "") },
                { label: "Convention signée", done: ["convention_signee", "stage_en_cours", "stage_termine"].includes(stage.statut || "") },
                { label: "Stage validé", done: ["stage_termine"].includes(stage.statut || "") },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-0 flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      t.done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"
                    }`}>
                      {t.done ? "✓" : i + 1}
                    </div>
                    <span className="text-[11px] text-gray-500 text-center">{t.label}</span>
                  </div>
                  {i < 3 && <div className={`h-0.5 flex-1 mt-[-18px] ${t.done ? "bg-green-500" : "bg-gray-200"}`} />}
                </div>
              ))}
            </div>

            {["convention_generee", "convention_signee", "stage_en_cours", "stage_termine"].includes(stage.statut || "") && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-3">
                <p className="text-sm text-blue-800 font-medium">
                  Votre convention est prête !
                </p>
                <p className="text-sm text-blue-700">
                  Imprimez cette convention en 4 exemplaires. Faites-la signer par l'entreprise, votre famille et remettez un exemplaire à votre professeur principal.
                </p>
                <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-all">
                  <Download className="w-4 h-4" />
                  Télécharger ma convention PDF
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
