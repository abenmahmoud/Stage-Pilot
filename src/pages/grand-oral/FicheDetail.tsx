import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { GoStatusBadge } from "../../components/ui/StatusBadge";
import { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import type { GOStatut } from "../../lib/types";
import { ArrowLeft, CheckCircle2, Stamp, MessageSquare } from "lucide-react";

interface FicheDetail {
  id: number;
  eleveNom: string;
  elevePrenom: string;
  classeNom: string;
  numeroCanditat: string;
  statut: GOStatut;
  question1: string;
  specialitesQuestion1: string;
  question2: string;
  specialitesQuestion2: string;
  profSpe1: string;
  profSpe2: string;
  commentaireProf1: string | null;
  commentaireProf2: string | null;
  signeProf1At: string | null;
  signeProf2At: string | null;
  cachetApposeAt: string | null;
}

export default function FicheDetailPage() {
  const { ficheId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fiche, setFiche] = useState<FicheDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<FicheDetail>(`grand-oral/${ficheId}`);
        setFiche(data);
      } catch {}
      setLoading(false);
    })();
  }, [ficheId]);

  async function handleSign() {
    setSigning(true);
    try {
      const res = await apiFetch<FicheDetail>(`grand-oral/${ficheId}/sign`, {
        method: "POST",
        body: JSON.stringify({ comment }),
      });
      setFiche(res);
    } catch {}
    setSigning(false);
  }

  async function handleCachet() {
    setSigning(true);
    try {
      const res = await apiFetch<FicheDetail>(`grand-oral/${ficheId}/cachet`, {
        method: "POST",
      });
      setFiche(res);
    } catch {}
    setSigning(false);
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );

  if (!fiche)
    return (
      <div className="text-center py-24 text-gray-400">Fiche introuvable</div>
    );

  const canSign =
    user?.role === "professeur" &&
    (fiche.statut === "soumis_prof1" || fiche.statut === "soumis_prof2");
  const canCachet =
    user?.role === "proviseur" && fiche.statut === "soumis_proviseur";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/grand-oral")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au tableau de bord
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            {fiche.eleveNom} {fiche.elevePrenom}
          </h1>
          <p className="text-sm text-gray-500">
            {fiche.classeNom}
            {fiche.numeroCanditat && ` — N° ${fiche.numeroCanditat}`}
          </p>
        </div>
        <GoStatusBadge status={fiche.statut} />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-900">Question 1</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 mb-2">
              {fiche.question1 || "—"}
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
            <p className="text-sm text-gray-700 mb-2">
              {fiche.question2 || "—"}
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
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Prof spé 1 : {fiche.profSpe1 || "—"}</span>
            {fiche.signeProf1At ? (
              <span className="text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Signé
              </span>
            ) : (
              <span className="text-gray-400">En attente</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Prof spé 2 : {fiche.profSpe2 || "—"}</span>
            {fiche.signeProf2At ? (
              <span className="text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Signé
              </span>
            ) : (
              <span className="text-gray-400">En attente</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Chef d'établissement</span>
            {fiche.cachetApposeAt ? (
              <span className="text-green-600 font-medium flex items-center gap-1">
                <Stamp className="w-4 h-4" />
                Cachet apposé
              </span>
            ) : (
              <span className="text-gray-400">En attente</span>
            )}
          </div>
        </CardContent>
      </Card>

      {canSign && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-900">
              Signer cette fiche
            </h3>
            <p className="text-xs text-gray-500">
              Votre signature atteste que cette fiche est transmise selon le
              circuit administratif prévu.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
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
              disabled={signing}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {signing ? "Signature en cours…" : "Confirmer et signer"}
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
              {signing ? "Traitement…" : "Apposer le cachet et finaliser"}
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
