import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { StatCard } from "../../components/ui/StatCard";
import { Card, CardContent } from "../../components/ui/Card";
import {
  Users,
  Briefcase,
  Mic2,
  AlertTriangle,
  FileText,
  Upload,
  Settings,
  KeyRound,
  UsersRound,
} from "lucide-react";

interface DashboardStats {
  totalEleves: number;
  totalProfs: number;
  totalClasses: number;
  stagesComplete: number;
  stagesSansStage: number;
  goFinalise: number;
  goEnAttente: number;
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="flex items-center gap-4 py-6">
        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
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
      } catch {
        // Le dashboard reste utilisable même si les statistiques échouent.
      }
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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <ActionCard
              title="Import CSV / Excel"
              description="Importer les listes d'élèves et de professeurs"
              icon={<Upload className="w-6 h-6 text-blue-600" />}
              onClick={() => navigate("/admin/import")}
            />
            <ActionCard
              title="Codes élèves"
              description="Imprimer les étiquettes pour les élèves"
              icon={<KeyRound className="w-6 h-6 text-indigo-600" />}
              onClick={() => navigate("/admin/codes-acces")}
            />
            <ActionCard
              title="Codes professeurs"
              description="Imprimer les codes d'accès enseignants"
              icon={<KeyRound className="w-6 h-6 text-cyan-600" />}
              onClick={() => navigate("/admin/codes-profs")}
            />
            <ActionCard
              title="Affectations classes"
              description="Associer les professeurs principaux"
              icon={<UsersRound className="w-6 h-6 text-emerald-600" />}
              onClick={() => navigate("/admin/affectations-classes")}
            />
            <ActionCard
              title="Affectations élèves"
              description="Affecter référents stage et professeurs GO"
              icon={<UsersRound className="w-6 h-6 text-orange-600" />}
              onClick={() => navigate("/admin/affectations-eleves")}
            />
            <ActionCard
              title="Paramètres"
              description="Configuration de l'établissement"
              icon={<Settings className="w-6 h-6 text-gray-600" />}
              onClick={() => navigate("/admin/parametres")}
            />
          </div>
        </>
      )}
    </div>
  );
}
