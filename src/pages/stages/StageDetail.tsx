import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { StageStatusBadge } from "../../components/ui/StatusBadge";
import { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import type { StageStatut } from "../../lib/types";
import { ArrowLeft, FileText, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StageDetail {
  id: number;
  eleveNom: string;
  elevePrenom: string;
  classeNom: string;
  statut: StageStatut;
  entrepriseNom: string;
  entrepriseAdresse: string;
  entrepriseTelephone: string;
  entrepriseRepresentant: string;
  entrepriseQualite: string;
  entrepriseType: string;
  tuteurNomQualite: string;
  tuteurEmail: string;
  tuteurTelephone: string;
  professeurReferent: string;
  dateDebut: string;
  dateFin: string;
}

export default function StageDetailPage() {
  const { eleveId } = useParams();
  const navigate = useNavigate();
  const [stage, setStage] = useState<StageDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<StageDetail>(`stages/${eleveId}`);
        setStage(data);
      } catch {}
      setLoading(false);
    })();
  }, [eleveId]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );

  if (!stage)
    return (
      <div className="text-center py-24 text-gray-400">
        Stage introuvable
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/stages")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au tableau de bord
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            {stage.eleveNom} {stage.elevePrenom}
          </h1>
          <p className="text-sm text-gray-500">{stage.classeNom}</p>
        </div>
        <StageStatusBadge status={stage.statut} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-900">Entreprise</h3>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-gray-500">Nom :</span> {stage.entrepriseNom || "—"}</p>
            <p><span className="text-gray-500">Type :</span> {stage.entrepriseType || "—"}</p>
            <p><span className="text-gray-500">Adresse :</span> {stage.entrepriseAdresse || "—"}</p>
            <p><span className="text-gray-500">Tél :</span> {stage.entrepriseTelephone || "—"}</p>
            <p><span className="text-gray-500">Représentant :</span> {stage.entrepriseRepresentant || "—"}</p>
            <p><span className="text-gray-500">Qualité :</span> {stage.entrepriseQualite || "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-900">Tuteur</h3>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-gray-500">Nom/Qualité :</span> {stage.tuteurNomQualite || "—"}</p>
            <p><span className="text-gray-500">Email :</span> {stage.tuteurEmail || "—"}</p>
            <p><span className="text-gray-500">Tél :</span> {stage.tuteurTelephone || "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        {stage.statut === "soumis" && (
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-all">
            <FileText className="w-4 h-4" />
            Générer la convention PDF
          </button>
        )}
        {stage.statut === "a_completer" && (
          <button className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition-all">
            <Mail className="w-4 h-4" />
            Envoyer un rappel
          </button>
        )}
      </div>
    </div>
  );
}
