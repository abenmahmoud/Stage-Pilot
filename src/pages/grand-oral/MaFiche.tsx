import { useEffect, useState } from "react";
import { apiFetch, openApiFile } from "../../lib/api";
import { SPECIALITES } from "../../lib/types";
import { GoStatusBadge } from "../../components/ui/StatusBadge";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import type { GOStatut } from "../../lib/types";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Mic2,
  Save,
  UserCheck,
} from "lucide-react";

interface FicheData {
  moduleActif?: boolean;
  id: string | null;
  statut: GOStatut;
  numeroCanditat: string | null;
  question1: string | null;
  specialitesQuestion1: string | null;
  question2: string | null;
  specialitesQuestion2: string | null;
  profSpe1Id: string | null;
  profSpe2Id: string | null;
  profSpe1: string | null;
  profSpe2: string | null;
  commentaireProf1: string | null;
  commentaireProf2: string | null;
  fichePdfUrl: string | null;
}

type EditableField =
  | "numeroCanditat"
  | "question1"
  | "question2"
  | "specialitesQuestion1"
  | "specialitesQuestion2";

const emptyFiche: Partial<FicheData> = {
  statut: "brouillon",
  numeroCanditat: "",
  question1: "",
  specialitesQuestion1: "",
  question2: "",
  specialitesQuestion2: "",
  profSpe1Id: null,
  profSpe2Id: null,
  profSpe1: null,
  profSpe2: null,
  fichePdfUrl: null,
};

function textValue(value: string | null | undefined): string {
  return value ?? "";
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function isPostSubmission(statut: GOStatut | undefined): boolean {
  return Boolean(statut && statut !== "brouillon" && statut !== "module_desactive");
}

function initialStepFor(fiche: Partial<FicheData>): number {
  if (isPostSubmission(fiche.statut)) return 3;
  if (
    hasText(fiche.question1) &&
    hasText(fiche.question2) &&
    hasText(fiche.specialitesQuestion1) &&
    hasText(fiche.specialitesQuestion2)
  ) {
    return 2;
  }
  if (hasText(fiche.specialitesQuestion1) && hasText(fiche.specialitesQuestion2)) {
    return 1;
  }
  return 0;
}

function specialiteOptions(current: string): string[] {
  if (!current || SPECIALITES.includes(current)) return SPECIALITES;
  return [current, ...SPECIALITES];
}

export default function MaFiche() {
  const [fiche, setFiche] = useState<Partial<FicheData>>(emptyFiche);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch<FicheData>("grand-oral/mine");
        const nextFiche = { ...emptyFiche, ...data };
        setFiche(nextFiche);
        setStep(initialStepFor(nextFiche));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
      setLoading(false);
    })();
  }, []);

  function update(field: EditableField, value: string) {
    setSuccess("");
    setFiche((prev) => ({ ...prev, [field]: value }));
  }

  async function save(submit = false): Promise<boolean> {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch<FicheData>("grand-oral/mine", {
        method: "POST",
        body: JSON.stringify({
          question1: textValue(fiche.question1),
          specialitesQuestion1: textValue(fiche.specialitesQuestion1),
          question2: textValue(fiche.question2),
          specialitesQuestion2: textValue(fiche.specialitesQuestion2),
          numeroCanditat: textValue(fiche.numeroCanditat),
          submit,
        }),
      });
      setFiche({ ...emptyFiche, ...res });
      setSuccess(submit ? "Fiche soumise aux enseignants." : "Brouillon enregistre.");
      if (submit) setStep(3);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndGo(nextStep: number) {
    const ok = await save(false);
    if (ok) setStep(nextStep);
  }

  async function openPdf() {
    if (!fiche.fichePdfUrl) {
      setError("Le PDF final n'est pas encore disponible.");
      return;
    }
    try {
      await openApiFile(fiche.fichePdfUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'ouverture du PDF");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const submitted = isPostSubmission(fiche.statut);
  const specialitesReady =
    hasText(fiche.specialitesQuestion1) && hasText(fiche.specialitesQuestion2);
  const questionsReady = hasText(fiche.question1) && hasText(fiche.question2);
  const canSubmit = specialitesReady && questionsReady && Boolean(fiche.profSpe1Id);

  const steps = [
    { icon: BookOpen, label: "Specialites" },
    { icon: Mic2, label: "Questions" },
    { icon: CheckCircle2, label: "Confirmation" },
  ];

  if (fiche.moduleActif === false) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            Ma fiche Grand Oral
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Baccalaureat General - Session 2026
          </p>
        </div>
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-gray-400 mx-auto" />
            <h2 className="text-lg font-bold font-heading text-gray-900">
              Module Grand Oral desactive
            </h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Ce module n'est pas ouvert pour ton compte. L'administration peut
              l'activer individuellement si necessaire.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-gray-900">
          Ma fiche Grand Oral
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Baccalaureat General - Session 2026
        </p>
      </div>

      {!submitted && (
        <div className="flex items-center gap-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div key={s.label} className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => i <= step && setStep(i)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all w-full ${
                    active
                      ? "bg-primary-500 text-white shadow-md"
                      : done
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-400"
                  }`}
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

      {success && !submitted && (
        <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {step === 0 && !submitted && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">Mes specialites</h2>
            <p className="text-sm text-gray-500">
              Ces choix sont enregistres avant de passer aux questions.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specialite question 1 *
              </label>
              <select
                value={textValue(fiche.specialitesQuestion1)}
                onChange={(e) => update("specialitesQuestion1", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
              >
                <option value="">Choisir...</option>
                {specialiteOptions(textValue(fiche.specialitesQuestion1)).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specialite question 2 *
              </label>
              <select
                value={textValue(fiche.specialitesQuestion2)}
                onChange={(e) => update("specialitesQuestion2", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
              >
                <option value="">Choisir...</option>
                {specialiteOptions(textValue(fiche.specialitesQuestion2)).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => saveAndGo(1)}
                disabled={!specialitesReady || saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Save className="w-4 h-4" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    Suivant
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && !submitted && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">Mes deux questions</h2>
            <p className="text-sm text-gray-500">
              La saisie est sauvegardee avant la confirmation.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
              Les questions doivent etre problematisees et en lien avec vos
              enseignements de specialite.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question 1 *
              </label>
              <textarea
                value={textValue(fiche.question1)}
                onChange={(e) => update("question1", e.target.value)}
                maxLength={300}
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 resize-none"
                placeholder="Formulez votre premiere question..."
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {textValue(fiche.question1).length}/300
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question 2 *
              </label>
              <textarea
                value={textValue(fiche.question2)}
                onChange={(e) => update("question2", e.target.value)}
                maxLength={300}
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 resize-none"
                placeholder="Formulez votre deuxieme question..."
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {textValue(fiche.question2).length}/300
              </p>
            </div>
            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </button>
              <button
                type="button"
                onClick={() => saveAndGo(2)}
                disabled={!questionsReady || saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Save className="w-4 h-4" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    Suivant
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && !submitted && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">Confirmation</h2>
            <p className="text-sm text-gray-500">
              Les enseignants sont affectes par l'administration.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl bg-gray-50 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Question 1</h3>
                <p className="mt-2 text-sm text-gray-700">
                  {fiche.question1 || "-"}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Specialite : {fiche.specialitesQuestion1 || "-"}
                </p>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900">Question 2</h3>
                <p className="mt-2 text-sm text-gray-700">
                  {fiche.question2 || "-"}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Specialite : {fiche.specialitesQuestion2 || "-"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <UserCheck className="w-4 h-4 text-primary-600" />
                Enseignants affectes
              </div>
              <div className="grid gap-2 text-sm text-gray-600">
                <p>
                  <span className="font-medium text-gray-700">Prof spe 1 : </span>
                  {fiche.profSpe1 || "En attente d'affectation"}
                </p>
                <p>
                  <span className="font-medium text-gray-700">Prof spe 2 : </span>
                  {fiche.profSpe2 || "En attente d'affectation"}
                </p>
              </div>
              {!fiche.profSpe1Id && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Tu peux enregistrer ton brouillon. La soumission sera possible
                  quand l'administration aura affecte le professeur de specialite.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numero de candidat (optionnel)
              </label>
              <input
                type="text"
                value={textValue(fiche.numeroCanditat)}
                onChange={(e) => update("numeroCanditat", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="Saisissez votre numero de candidat"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </button>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => save(false)}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={() => save(true)}
                  disabled={saving || !canSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {saving ? "Envoi..." : "Soumettre"}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(step === 3 || submitted) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">Suivi de votre fiche</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">
                Statut actuel :
              </span>
              <GoStatusBadge status={(fiche.statut as GOStatut) || "brouillon"} />
            </div>

            <div className="rounded-xl border border-gray-200 p-4 space-y-3 text-sm">
              <p>
                <span className="font-medium text-gray-700">Prof spe 1 : </span>
                {fiche.profSpe1 || "En attente d'affectation"}
              </p>
              <p>
                <span className="font-medium text-gray-700">Prof spe 2 : </span>
                {fiche.profSpe2 || "En attente d'affectation"}
              </p>
            </div>

            <div className="flex items-center gap-0">
              {[
                { label: "Saisie eleve", done: submitted || fiche.statut === "finalise" },
                {
                  label: "Prof spe 1",
                  done: ["soumis_prof2", "soumis_proviseur", "finalise"].includes(
                    (fiche.statut as string) || ""
                  ),
                },
                {
                  label: "Prof spe 2",
                  done:
                    !fiche.profSpe2Id ||
                    ["soumis_proviseur", "finalise"].includes(
                      (fiche.statut as string) || ""
                    ),
                },
                {
                  label: "Chef etablissement",
                  done: fiche.statut === "finalise",
                },
              ].map((t, i, items) => (
                <div key={t.label} className="flex items-center gap-0 flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        t.done
                          ? "bg-green-500 text-white"
                          : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      {t.done ? "OK" : i + 1}
                    </div>
                    <span className="text-[10px] text-gray-500 text-center leading-tight">
                      {t.label}
                    </span>
                  </div>
                  {i < items.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mt-[-18px] ${
                        t.done ? "bg-green-500" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {fiche.commentaireProf1 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">
                  Remarque de votre enseignant spe 1
                </p>
                <p className="text-sm text-amber-800">{fiche.commentaireProf1}</p>
              </div>
            )}

            {fiche.commentaireProf2 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">
                  Remarque de votre enseignant spe 2
                </p>
                <p className="text-sm text-amber-800">{fiche.commentaireProf2}</p>
              </div>
            )}

            {fiche.statut === "finalise" && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-3">
                <p className="text-sm text-green-800 font-medium">
                  Votre fiche Grand Oral est finalisee.
                </p>
                <p className="text-sm text-green-700">
                  Le PDF officiel est disponible apres cachet du chef
                  d'etablissement.
                </p>
                <button
                  type="button"
                  onClick={openPdf}
                  disabled={!fiche.fichePdfUrl}
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-all disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Telecharger ma fiche PDF
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
