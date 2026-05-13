import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import { GoStatusBadge } from "../../components/ui/StatusBadge";
import { StatCard } from "../../components/ui/StatCard";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import type { GOStatut } from "../../lib/types";
import {
  Mic2,
  CheckCircle2,
  Clock,
  Stamp,
  Search,
  Download,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FicheRow {
  id: number;
  eleveId: number;
  eleveNom: string;
  elevePrenom: string;
  classeNom: string;
  statut: GOStatut;
  question1: string | null;
  specialites: string | null;
  profSpe1: string | null;
  profSpe2: string | null;
  soumisAt: string | null;
}

interface StatsData {
  total: number;
  brouillons: number;
  enAttente: number;
  finalises: number;
}

export default function GrandOralDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fiches, setFiches] = useState<FicheRow[]>([]);
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    brouillons: 0,
    enAttente: 0,
    finalises: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ fiches: FicheRow[]; stats: StatsData }>(
        "grand-oral"
      );
      setFiches(data.fiches);
      setStats(data.stats);
    } catch {
      setFiches([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isProfView = user?.role === "professeur" || user?.role === "pp";
  const isProviseurView = user?.role === "proviseur";

  const filtered = fiches.filter((f) => {
    const matchSearch =
      !search ||
      `${f.eleveNom} ${f.elevePrenom} ${f.question1 ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchStatut = filterStatut === "all" || f.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            Grand Oral
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Fiches de l'épreuve terminale — Baccalauréat Général — Session 2026
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total fiches"
          value={stats.total}
          icon={<Mic2 className="w-5 h-5" />}
        />
        <StatCard
          label="Brouillons"
          value={stats.brouillons}
          icon={<Clock className="w-5 h-5" />}
          color="bg-gray-100 text-gray-600"
        />
        <StatCard
          label="En attente"
          value={stats.enAttente}
          icon={<Stamp className="w-5 h-5" />}
          color="bg-yellow-50 text-yellow-600"
        />
        <StatCard
          label="Finalisées"
          value={stats.finalises}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="bg-green-50 text-green-600"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un élève ou une question…"
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
              <option value="brouillon">Brouillon</option>
              <option value="soumis_prof1">Attente prof spé 1</option>
              <option value="valide_prof1">Prof spé 1 ✓</option>
              <option value="soumis_prof2">Attente prof spé 2</option>
              <option value="valide_prof2">Prof spé 2 ✓</option>
              <option value="soumis_proviseur">Attente cachet</option>
              <option value="finalise">Finalisé</option>
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
              <Mic2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {fiches.length === 0
                  ? "Aucune fiche Grand Oral enregistrée."
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
                    <th className="px-6 py-3">Question 1 (aperçu)</th>
                    <th className="px-6 py-3">Prof spé 1</th>
                    <th className="px-6 py-3">Prof spé 2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((f) => (
                    <tr
                      key={f.id}
                      className="hover:bg-gray-50/70 cursor-pointer transition-colors"
                      onClick={() => navigate(`/grand-oral/${f.id}`)}
                    >
                      <td className="px-6 py-3.5 font-medium text-gray-900">
                        {f.eleveNom} {f.elevePrenom}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {f.classeNom}
                      </td>
                      <td className="px-6 py-3.5">
                        <GoStatusBadge status={f.statut} />
                      </td>
                      <td className="px-6 py-3.5 text-gray-600 max-w-xs truncate">
                        {f.question1 || "—"}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {f.profSpe1 || "—"}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {f.profSpe2 || "—"}
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
