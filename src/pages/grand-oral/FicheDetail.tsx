import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { GoStatusBadge } from "../../components/ui/StatusBadge";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import type { GOStatut } from "../../lib/types";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
  Stamp,
  UserCheck,
} from "lucide-react";

type CurrentUserGoRole = "prof_spe1" | "prof_spe2" | null;

interface FicheDetail {
  id: string;
  eleveNom: string;
  elevePrenom: string;
  classeNom: string | null;
  numeroCanditat: string | null;
  statut: GOStatut;
  question1: string | null;
  specialitesQuestion1: string | null;
  question2: string | null;
  specialitesQuestion2: string | null;
  profSpe1: string | null;
  profSpe2: string | null;
  commentaireProf1: string | null;
  commentaireProf2: string | null;
  signeProf1At: string | null;
  signeProf2At: string | null;
  cachetApposeAt: string | null;
  currentUserGoRole: CurrentUserGoRole;
  canSign: boolean;
  actionMessage: string | null;
}

function roleLabel(role: CurrentUserGoRole): string {
  if (role === "prof_spe1") return "Professeur de spécialité 1";
  if (role === "prof_spe2") return "Professeur de spécialité 2";
  return "";
}

function hasQuestions(fiche: FicheDetail): boolean {
  return Boolean(fiche.question1?.trim() && fiche.question2?.trim());
}

export default function FicheDetailPage() {
  const { ficheId } = useParams<{ ficheId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fiche, setFiche] = useState<FicheDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");

  const loadFiche = useCallback(async () => {
    if (!ficheId) return;
    const data = await apiFetch<FicheDetail>(`grand-oral/${ficheId}`);
    setFiche(data);
  }, [ficheId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        await loadFiche();
      } catch {
        setFiche(null);
      }
      setLoading(false);
    })();
  }, [loadFiche]);

  async function handleSign() {
    if (!ficheId) return;
    setSigning(true);
    setError("");
    try {
      await apiFetch(`grand-oral/${ficheId}/sign`, {
        method: "POST",
        body: JSON.stringify({ comment }),
      });
      setComment("");
      await loadFiche();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de validation");
    }
    setSigning(false);
  }

  async function handleCachet() {
    if (!ficheId) return;
    setSigning(true);
    setError("");
    try {
      await apiFetch(`grand-oral/${ficheId}/cachet`, { method: "POST" });
      await loadFiche();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de validation");
    }
    setSigning(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!fiche) {
    return (
      <div className="text-center py-24 text-gray-400">Fiche introuvable</div>
    );
  }

  const canCachet =
    user?.role === "proviseur" && fiche.statut === "soumis_proviseur";
  const canValidate = fiche.canSign && hasQuestions(fiche);
  const assignedRole = roleLabel(fiche.currentUserGoRole);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/grand-oral")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au tableau de bord
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            {fiche.eleveNom} {fiche.elevePrenom}
          </h1>
          <p className="text-sm text-gray-500">
            {fiche.classeNom ?? "—"}
            {fiche.numeroCanditat && ` - N° ${fiche.numeroCanditat}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {assignedRole && (
            <span className="inline-flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700">
              <UserCheck className="w-4 h-4" />
              {assignedRole}
            </span>
          )}
          <GoStatusBadge status={fiche.statut} />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {fiche.actionMessage && (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            fiche.canSign
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <div className="flex items-start gap-3">
            {fiche.canSign ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <span className="font-medium">{fiche.actionMessage}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-900">Question 1</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 mb-3">
              {fiche.question1 || "Question non saisie"}
            </p>
            <p className="text-xs text-gray-500">
              Spécialité(s) : {fiche.specialitesQuestion1 || "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-900">Question 2</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 mb-3">
              {fiche.question2 || "Question non saisie"}
            </p>
            <p className="text-xs text-gray-500">
              Spécialité(s) : {fiche.specialitesQuestion2 || "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-900">
            Circuit de validation
          </h3>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="font-medium text-gray-700">Prof spé 1</span>
              <p className="text-gray-500">
                {fiche.profSpe1 || "Aucun professeur affecté"}
                {fiche.currentUserGoRole === "prof_spe1" && (
                  <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                    vous
                  </span>
                )}
              </p>
            </div>
            {fiche.signeProf1At ? (
              <span className="inline-flex items-center gap-1 font-medium text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Validé
              </span>
            ) : (
              <span className="text-gray-400">En attente</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="font-medium text-gray-700">Prof spé 2</span>
              <p className="text-gray-500">
                {fiche.profSpe2 || "Aucun professeur affecté"}
                {fiche.currentUserGoRole === "prof_spe2" && (
                  <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                    vous
                  </span>
                )}
              </p>
            </div>
            {fiche.signeProf2At ? (
              <span className="inline-flex items-center gap-1 font-medium text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Validé
              </span>
            ) : (
              <span className="text-gray-400">En attente</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="font-medium text-gray-700">
                Chef d'établissement
              </span>
              <p className="text-gray-500">Cachet final</p>
            </div>
            {fiche.cachetApposeAt ? (
              <span className="inline-flex items-center gap-1 font-medium text-green-600">
                <Stamp className="w-4 h-4" />
                Cachet apposé
              </span>
            ) : (
              <span className="text-gray-400">En attente</span>
            )}
          </div>
        </CardContent>
      </Card>

      {fiche.canSign && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-900">
              Valider les questions
            </h3>
            <p className="text-xs text-gray-500">
              Cette validation confirme que les questions peuvent poursuivre le
              circuit Grand Oral.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasQuestions(fiche) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Les deux questions ne sont pas encore saisies. La validation est
                bloquée tant que la fiche est incomplète.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MessageSquare className="w-4 h-4 inline mr-1" />
                Commentaire (optionnel)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 resize-none"
                placeholder="Remarque visible par l'élève et les autres signataires"
              />
            </div>
            <button
              onClick={handleSign}
              disabled={signing || !canValidate}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {signing ? "Validation en cours..." : "Valider les questions"}
            </button>
          </CardContent>
        </Card>
      )}

      {canCachet && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-900">
              Apposer le cachet
            </h3>
            <p className="text-xs text-gray-500">
              Validation du chef d'établissement
            </p>
          </CardHeader>
          <CardContent>
            <button
              onClick={handleCachet}
              disabled={signing}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-all disabled:opacity-50"
            >
              <Stamp className="w-4 h-4" />
              {signing ? "Traitement..." : "Apposer le cachet et finaliser"}
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
