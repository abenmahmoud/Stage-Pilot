import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { StageStatusBadge } from "../../components/ui/StatusBadge";
import { StatCard } from "../../components/ui/StatCard";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import type { StageStatut } from "../../lib/types";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Download,
  ChevronDown,
  UserPlus,
  PencilLine,
  BookOpen,
} from "lucide-react";

interface ProfesseurOption {
  id: string;
  nom: string;
  prenom: string;
  matieres: string | null;
}

interface StageRow {
  id: string;
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  classeNom: string | null;
  statut: StageStatut;
  entrepriseNom: string | null;
  tuteurTelephone: string | null;
  professeurReferentId: string | null;
  professeurReferent: string | null;
  canManage: boolean;
}

interface StatsData {
  total: number;
  avecStage: number;
  sansStage: number;
  conventionsGenerees: number;
  conventionsSignees: number;
}

interface StagesResponse {
  stages: StageRow[];
  professeurs: ProfesseurOption[];
  stats: StatsData;
}

function csvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function profLabel(prof: ProfesseurOption): string {
  return `${prof.nom} ${prof.prenom}${prof.matieres ? ` - ${prof.matieres}` : ""}`;
}

export default function StagesDashboard() {
  const navigate = useNavigate();
  const [stages, setStages] = useState<StageRow[]>([]);
  const [professeurs, setProfesseurs] = useState<ProfesseurOption[]>([]);
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    avecStage: 0,
    sansStage: 0,
    conventionsGenerees: 0,
    conventionsSignees: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [savingReferentId, setSavingReferentId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<StagesResponse>("stages");
      setStages(data.stages);
      setProfesseurs(data.professeurs);
      setStats(data.stats);
    } catch (e) {
      setStages([]);
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const professeursById = useMemo(() => {
    return new Map(professeurs.map((prof) => [prof.id, prof]));
  }, [professeurs]);

  const filtered = stages.filter((stage) => {
    const matchSearch =
      !search ||
      `${stage.eleveNom} ${stage.elevePrenom} ${stage.classeNom ?? ""} ${
        stage.entrepriseNom ?? ""
      } ${stage.professeurReferent ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchStatut =
      filterStatut === "all" || stage.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const referentsManquants = stages.filter(
    (stage) => !stage.professeurReferentId
  ).length;
  const aVerifier = stages.filter((stage) => stage.statut === "soumis").length;

  async function updateReferent(stage: StageRow, professeurReferentId: string) {
    setSavingReferentId(stage.id);
    setError("");
    try {
      await apiFetch(`stages/${stage.eleveId}`, {
        method: "PUT",
        body: JSON.stringify({
          professeurReferentId: professeurReferentId || null,
        }),
      });
      const prof = professeurReferentId
        ? professeursById.get(professeurReferentId)
        : null;
      setStages((current) =>
        current.map((item) =>
          item.id === stage.id
            ? {
                ...item,
                professeurReferentId: professeurReferentId || null,
                professeurReferent: prof ? `${prof.nom} ${prof.prenom}` : null,
              }
            : item
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde");
    }
    setSavingReferentId(null);
  }

  function downloadCSV() {
    const csv = [
      ["Eleve", "Classe", "Statut", "Entreprise", "Telephone tuteur", "Referent"].join(";"),
      ...filtered.map((stage) =>
        [
          csvCell(`${stage.eleveNom} ${stage.elevePrenom}`),
          csvCell(stage.classeNom),
          csvCell(stage.statut),
          csvCell(stage.entrepriseNom),
          csvCell(stage.tuteurTelephone),
          csvCell(stage.professeurReferent),
        ].join(";")
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stages-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            Stages de seconde
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Suivi PP et administration - saisie entreprise, verification,
            affectation du professeur referent
          </p>
        </div>
        <button
          onClick={downloadCSV}
          disabled={!filtered.length}
          className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total eleves"
          value={stats.total}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          label="Stage trouve"
          value={`${
            stats.total > 0 ? Math.round((stats.avecStage / stats.total) * 100) : 0
          }%`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="Sans stage"
          value={stats.sansStage}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="bg-red-50 text-red-600"
        />
        <StatCard
          label="A verifier"
          value={aVerifier}
          icon={<PencilLine className="w-5 h-5" />}
          color="bg-yellow-50 text-yellow-600"
        />
        <StatCard
          label="Referents manquants"
          value={referentsManquants}
          icon={<UserPlus className="w-5 h-5" />}
          color="bg-indigo-50 text-indigo-600"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un eleve, une entreprise, une classe ou un referent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div className="relative">
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-10 text-sm outline-none focus:border-primary-500 min-w-[190px]"
            >
              <option value="all">Tous les statuts</option>
              <option value="a_completer">Rien saisi</option>
              <option value="en_cours_saisie">En cours</option>
              <option value="soumis">Soumis</option>
              <option value="convention_generee">PDF pret</option>
              <option value="convention_signee">Dossier complet</option>
              <option value="stage_en_cours">Stage en cours</option>
              <option value="stage_termine">Stage termine</option>
              <option value="dispense">Dispense</option>
              <option value="accueil_lycee">Accueil lycee</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {stages.length === 0
                  ? "Aucun stage actif trouve."
                  : "Aucun resultat pour cette recherche."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Eleve</th>
                    <th className="px-6 py-3">Classe</th>
                    <th className="px-6 py-3">Statut</th>
                    <th className="px-6 py-3">Entreprise</th>
                    <th className="px-6 py-3">Tel. tuteur</th>
                    <th className="px-6 py-3 min-w-[260px]">Referent</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((stage) => (
                    <tr
                      key={stage.id}
                      className="hover:bg-gray-50/70 cursor-pointer transition-colors"
                      onClick={() => navigate(`/stages/${stage.eleveId}`)}
                    >
                      <td className="px-6 py-3.5 font-medium text-gray-900">
                        {stage.eleveNom} {stage.elevePrenom}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {stage.classeNom ?? "-"}
                      </td>
                      <td className="px-6 py-3.5">
                        <StageStatusBadge status={stage.statut} />
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {stage.entrepriseNom || "-"}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {stage.tuteurTelephone || "-"}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {stage.canManage ? (
                          <select
                            value={stage.professeurReferentId ?? ""}
                            disabled={savingReferentId === stage.id}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              updateReferent(stage, event.target.value)
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:opacity-50"
                          >
                            <option value="">Affecter un professeur</option>
                            {professeurs.map((prof) => (
                              <option key={prof.id} value={prof.id}>
                                {profLabel(prof)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          stage.professeurReferent || "-"
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/stages/${stage.eleveId}/livret`);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Livret
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/stages/${stage.eleveId}`);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <PencilLine className="w-3.5 h-3.5" />
                            Ouvrir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
