import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StageRow {
  id: string;
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  classeNom: string | null;
  statut: StageStatut;
  entrepriseNom: string | null;
  tuteurTelephone: string | null;
  professeurReferent: string | null;
}

interface StatsData {
  total: number;
  avecStage: number;
  sansStage: number;
  conventionsGenerees: number;
  conventionsSignees: number;
}

export default function StagesDashboard() {
  const navigate = useNavigate();
  const [stages, setStages] = useState<StageRow[]>([]);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ stages: StageRow[]; stats: StatsData }>(
        "stages"
      );
      setStages(data.stages);
      setStats(data.stats);
    } catch {
      setStages([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = stages.filter((s) => {
    const matchSearch =
      !search ||
      `${s.eleveNom} ${s.elevePrenom} ${s.entrepriseNom ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchStatut = filterStatut === "all" || s.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            Stages de seconde
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Séquences d'observation en milieu professionnel — Juin 2026
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total élèves"
          value={stats.total}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          label="Stage trouvé"
          value={`${stats.total > 0 ? Math.round((stats.avecStage / stats.total) * 100) : 0}%`}
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
          label="Conventions"
          value={stats.conventionsGenerees}
          icon={<FileText className="w-5 h-5" />}
          color="bg-indigo-50 text-indigo-600"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un élève ou une entreprise…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div className="relative">
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-10 text-sm outline-none focus:border-primary-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="a_completer">Rien saisi</option>
              <option value="en_cours_saisie">En cours</option>
              <option value="soumis">Soumis</option>
              <option value="convention_generee">PDF prêt</option>
              <option value="convention_signee">Dossier complet</option>
              <option value="dispense">Dispensé</option>
              <option value="accueil_lycee">Accueil lycée</option>
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
                  ? "Aucun stage enregistré. Importez les élèves via le module d'import."
                  : "Aucun résultat pour cette recherche."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Élève</th>
                    <th className="px-6 py-3">Classe</th>
                    <th className="px-6 py-3">Statut</th>
                    <th className="px-6 py-3">Entreprise</th>
                    <th className="px-6 py-3">Tél. tuteur</th>
                    <th className="px-6 py-3">Référent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-gray-50/70 cursor-pointer transition-colors"
                      onClick={() => navigate(`/stages/${s.eleveId}`)}
                    >
                      <td className="px-6 py-3.5 font-medium text-gray-900">
                        {s.eleveNom} {s.elevePrenom}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {s.classeNom ?? "—"}
                      </td>
                      <td className="px-6 py-3.5">
                        <StageStatusBadge status={s.statut} />
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {s.entrepriseNom || "—"}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {s.tuteurTelephone || "—"}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {s.professeurReferent || "—"}
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
