import { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { SPECIALITES } from "../../lib/types";
import { GoStatusBadge } from "../../components/ui/StatusBadge";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import type { GOStatut } from "../../lib/types";
import {
  Mic2,
  BookOpen,
  Users,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
} from "lucide-react";

interface FicheData {
  id: number;
  statut: GOStatut;
  numeroCanditat: string;
  question1: string;
  specialitesQuestion1: string;
  question2: string;
  specialitesQuestion2: string;
  profSpe1Id: number | null;
  profSpe2Id: number | null;
  commentaireProf1: string | null;
  commentaireProf2: string | null;
  [key: string]: unknown;
}

interface ProfOption {
  id: number;
  nom: string;
  prenom: string;
  matieres: string;
}

export default function MaFiche() {
  const [fiche, setFiche] = useState<Partial<FicheData>>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [spe1, setSpe1] = useState("");
  const [spe2, setSpe2] = useState("");
  const [profs, setProfs] = useState<ProfOption[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<FicheData>("grand-oral/mine");
        setFiche(data);
        if (data.statut && data.statut !== "brouillon") {
          setStep(4);
        }
      } catch {}
      try {
        const p = await apiFetch<ProfOption[]>("professeurs");
        setProfs(p);
      } catch {}
      setLoading(false);
    })();
  }, []);

  function update(field: string, value: string | number | null) {
    setFiche((prev) => ({ ...prev, [field]: value }));
  }

  async function save(submit = false) {
    setSaving(true);
    setError("");
    try {
      const body = { ...fiche, spe1, spe2, submit };
      const res = await apiFetch<FicheData>("grand-oral/mine", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setFiche(res);
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
    { icon: BookOpen, label: "Spécialités" },
    { icon: Mic2, label: "Questions" },
    { icon: Users, label: "Enseignants" },
    { icon: CheckCircle2, label: "Confirmation" },
  ];

  const isPostSubmission = fiche.statut && fiche.statut !== "brouillon";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-gray-900">
          Ma fiche Grand Oral
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Baccalauréat Général — Session 2026
        </p>
      </div>

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

      {/* Step 1: Spécialités */}
      {step === 0 && !isPostSubmission && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">Mes spécialités</h2>
            <p className="text-sm text-gray-500">
              Choisissez vos deux enseignements de spécialité
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spécialité 1 *
              </label>
              <select
                value={spe1}
                onChange={(e) => setSpe1(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
              >
                <option value="">Choisir…</option>
                {SPECIALITES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spécialité 2 *
              </label>
              <select
                value={spe2}
                onChange={(e) => setSpe2(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
              >
                <option value="">Choisir…</option>
                {SPECIALITES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(1)}
                disabled={!spe1 || !spe2}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-all disabled:opacity-50"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Questions */}
      {step === 1 && !isPostSubmission && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">Mes deux questions</h2>
            <p className="text-sm text-gray-500">
              Formulez une question problématisée en lien avec votre programme de
              Terminale
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
              Les questions portent sur les deux enseignements de spécialité soit
              pris isolément, soit abordés de manière transversale (Note de
              service du 27-07-2021).
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question 1 *
              </label>
              <textarea
                value={fiche.question1 || ""}
                onChange={(e) => update("question1", e.target.value)}
                maxLength={300}
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 resize-none"
                placeholder="Formulez votre première question…"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {(fiche.question1 || "").length}/300
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spécialité(s) concernée(s) pour Q1 *
              </label>
              <input
                type="text"
                value={fiche.specialitesQuestion1 || ""}
                onChange={(e) => update("specialitesQuestion1", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder={`Ex: ${spe1}` || "Spécialité(s)"}
              />
            </div>
            <hr className="border-gray-200" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question 2 *
              </label>
              <textarea
                value={fiche.question2 || ""}
                onChange={(e) => update("question2", e.target.value)}
                maxLength={300}
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 resize-none"
                placeholder="Formulez votre deuxième question…"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {(fiche.question2 || "").length}/300
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spécialité(s) concernée(s) pour Q2 *
              </label>
              <input
                type="text"
                value={fiche.specialitesQuestion2 || ""}
                onChange={(e) => update("specialitesQuestion2", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder={`Ex: ${spe2}` || "Spécialité(s)"}
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

      {/* Step 3: Enseignants */}
      {step === 2 && !isPostSubmission && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">
              Mes enseignants de spécialité
            </h2>
            <p className="text-sm text-gray-500">
              Sélectionnez les professeurs qui valideront votre fiche
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Professeur de spécialité 1 ({spe1 || "—"}) *
              </label>
              <select
                value={fiche.profSpe1Id ?? ""}
                onChange={(e) =>
                  update("profSpe1Id", e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
              >
                <option value="">Choisir…</option>
                {profs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} {p.prenom} — {p.matieres}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Professeur de spécialité 2 ({spe2 || "—"}) *
              </label>
              <select
                value={fiche.profSpe2Id ?? ""}
                onChange={(e) =>
                  update("profSpe2Id", e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
              >
                <option value="">Choisir…</option>
                {profs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} {p.prenom} — {p.matieres}
                  </option>
                ))}
              </select>
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
              Vérifiez vos informations avant soumission
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl bg-gray-50 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Question 1
              </h3>
              <p className="text-sm text-gray-700">
                {fiche.question1 || "—"}
              </p>
              <p className="text-xs text-gray-500">
                Spécialités : {fiche.specialitesQuestion1 || "—"}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Question 2
              </h3>
              <p className="text-sm text-gray-700">
                {fiche.question2 || "—"}
              </p>
              <p className="text-xs text-gray-500">
                Spécialités : {fiche.specialitesQuestion2 || "—"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numéro de candidat (optionnel)
              </label>
              <input
                type="text"
                value={fiche.numeroCanditat || ""}
                onChange={(e) => update("numeroCanditat", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="Saisissez votre numéro de candidat"
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
                {saving
                  ? "Envoi…"
                  : "Soumettre à mes enseignants de spécialité"}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post-submission timeline */}
      {(step === 4 || isPostSubmission) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold font-heading">
              Suivi de votre fiche
            </h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">
                Statut actuel :
              </span>
              <GoStatusBadge
                status={(fiche.statut as GOStatut) || "brouillon"}
              />
            </div>

            <div className="flex items-center gap-0">
              {[
                {
                  label: "Saisie élève",
                  done: true,
                },
                {
                  label: "Prof spé 1",
                  done: [
                    "valide_prof1",
                    "soumis_prof2",
                    "valide_prof2",
                    "soumis_proviseur",
                    "valide_proviseur",
                    "finalise",
                  ].includes(fiche.statut || ""),
                },
                {
                  label: "Prof spé 2",
                  done: [
                    "valide_prof2",
                    "soumis_proviseur",
                    "valide_proviseur",
                    "finalise",
                  ].includes(fiche.statut || ""),
                },
                {
                  label: "Chef d'établissement",
                  done: ["valide_proviseur", "finalise"].includes(
                    fiche.statut || ""
                  ),
                },
                {
                  label: "Finalisé",
                  done: fiche.statut === "finalise",
                },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-0 flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        t.done
                          ? "bg-green-500 text-white"
                          : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      {t.done ? "✓" : i + 1}
                    </div>
                    <span className="text-[10px] text-gray-500 text-center leading-tight">
                      {t.label}
                    </span>
                  </div>
                  {i < 4 && (
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
                  Remarque de votre enseignant (spé 1)
                </p>
                <p className="text-sm text-amber-800">{fiche.commentaireProf1}</p>
              </div>
            )}

            {fiche.commentaireProf2 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">
                  Remarque de votre enseignant (spé 2)
                </p>
                <p className="text-sm text-amber-800">{fiche.commentaireProf2}</p>
              </div>
            )}

            {fiche.statut === "finalise" && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-3">
                <p className="text-sm text-green-800 font-medium">
                  Votre fiche Grand Oral est finalisée !
                </p>
                <p className="text-sm text-green-700">
                  Imprimez cette fiche et présentez-la le jour de votre Grand
                  Oral.
                </p>
                <button className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-all">
                  <Download className="w-4 h-4" />
                  Télécharger ma fiche PDF
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
