import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { ROLE_LABELS } from "../lib/types";
import {
  GraduationCap,
  Briefcase,
  Mic2,
  Settings,
  Upload,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  ChevronRight,
  KeyRound,
  UsersRound,
  FolderOpen,
} from "lucide-react";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
    isActive
      ? "bg-white/15 text-white shadow-sm"
      : "text-white/70 hover:bg-white/10 hover:text-white"
  }`;

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const isAdmin = ["superadmin", "administration"].includes(user.role);
  const isProviseur = user.role === "proviseur";
  const isEleve = user.role === "eleve";

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const navContent = (
    <>
      <div className="px-4 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white font-heading">
              LycéeGest
            </p>
            <p className="text-[11px] text-white/50">Blaise Cendrars</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!isEleve && (
          <NavLink to="/stages" end className={navCls}>
            <Briefcase className="w-4 h-4" />
            Stages 2ndes
          </NavLink>
        )}
        {isEleve && (
          <NavLink to="/stages/mon-stage" className={navCls}>
            <Briefcase className="w-4 h-4" />
            Mon stage
          </NavLink>
        )}

        {!isEleve && (
          <NavLink to="/grand-oral" end className={navCls}>
            <Mic2 className="w-4 h-4" />
            Grand Oral
          </NavLink>
        )}
        {isEleve && (
          <NavLink to="/grand-oral/ma-fiche" className={navCls}>
            <Mic2 className="w-4 h-4" />
            Ma fiche GO
          </NavLink>
        )}

        {isAdmin && (
          <>
            <div className="pt-4 pb-2 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Administration
              </p>
            </div>
            <NavLink to="/admin" end className={navCls}>
              <LayoutDashboard className="w-4 h-4" />
              Tableau de bord
            </NavLink>
            <NavLink to="/admin/import" className={navCls}>
              <Upload className="w-4 h-4" />
              Import CSV / Excel
            </NavLink>
            <NavLink to="/admin/codes-acces" className={navCls}>
              <KeyRound className="w-4 h-4" />
              Codes élèves
            </NavLink>
            <NavLink to="/admin/codes-profs" className={navCls}>
              <KeyRound className="w-4 h-4" />
              Codes professeurs
            </NavLink>
            <NavLink to="/admin/affectations-classes" className={navCls}>
              <UsersRound className="w-4 h-4" />
              Affectations classes
            </NavLink>
            <NavLink to="/admin/affectations-eleves" className={navCls}>
              <UsersRound className="w-4 h-4" />
              Affectations élèves
            </NavLink>
            <NavLink to="/admin/documents-classes" className={navCls}>
              <FolderOpen className="w-4 h-4" />
              Documents PDF
            </NavLink>
            <NavLink to="/admin/parametres" className={navCls}>
              <Settings className="w-4 h-4" />
              Paramètres
            </NavLink>
          </>
        )}

        {isProviseur && (
          <NavLink to="/admin/parametres" className={navCls}>
            <Settings className="w-4 h-4" />
            Paramètres
          </NavLink>
        )}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-accent-400/20 flex items-center justify-center text-xs font-bold text-accent-400">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">
              {user.name}
            </p>
            <p className="text-[11px] text-white/50">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/10 py-2 text-sm text-white/70 hover:bg-white/15 hover:text-white transition-all"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="hidden lg:flex w-64 flex-col bg-primary-500 shrink-0">
        {navContent}
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-primary-500 transition-transform lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-white/70 hover:text-white"
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
        {navContent}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-gray-200 bg-white flex items-center gap-3 px-4 lg:px-6 shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <span className="font-medium text-gray-900">LycéeGest</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>2025-2026</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
