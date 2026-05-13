import { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { StatCard } from "../../components/ui/StatCard";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import {
  Users,
  Briefcase,
  Mic2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Upload,
  Settings,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DashboardStats {
  totalEleves: number;
  totalProfs: number;
  totalClasses: number;
  stagesComplete: number;
  stagesSansStage: number;
  goFinalise: number;
  goEnAttente: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalEleves: 0,
    totalProfs: 0,
    totalClasses: 0,
    stagesComplete: 0,
    stagesSansStage: 0,
    goFinalise: 0,
    goEnAttente: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<DashboardStats>("admin/stats");
        setStats(data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-gray-900">
          Administration
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Vue d'ensemble — Année scolaire 2025-2026
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Élèves"
              value={stats.totalEleves}
              icon={<Users className="w-5 h-5" />}
            />
            <StatCard
              label="Professeurs"
              value={stats.totalProfs}
              icon={<Users className="w-5 h-5" />}
              color="bg-indigo-50 text-indigo-600"
            />
            <StatCard
              label="Classes"
              value={stats.totalClasses}
              icon={<FileText className="w-5 h-5" />}
              color="bg-purple-50 text-purple-600"
            />
            <StatCard
              label="Sans stage"
              value={stats.stagesSansStage}
              icon={<AlertTriangle className="w-5 h-5" />}
              color="bg-red-50 text-red-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label="Stages complets"
              value={stats.stagesComplete}
              icon={<Briefcase className="w-5 h-5" />}
              color="bg-green-50 text-green-600"
            />
            <StatCard
              label="GO finalisées"
              value={stats.goFinalise}
              icon={<Mic2 className="w-5 h-5" />}
              color="bg-green-50 text-green-600"
            />
            <StatCard
              label="GO en attente"
              value={stats.goEnAttente}
              icon={<Mic2 className="w-5 h-5" />}
              color="bg-yellow-50 text-yellow-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate("/admin/import")}
            >
              <CardContent className="flex items-center gap-4 py-6">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Import CSV
                  </h3>
                  <p className="text-sm text-gray-500">
                    Importer les listes d'élèves et de professeurs
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate("/admin/parametres")}
            >
              <CardContent className="flex items-center gap-4 py-6">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Paramètres
                  </h3>
                  <p className="text-sm text-gray-500">
                    Configuration de l'établissement
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
