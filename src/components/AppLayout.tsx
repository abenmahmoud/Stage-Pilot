import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth-context";
import { ROLE_LABELS } from "../lib/types";
import {
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
  ShieldCheck,
} from "lucide-react";
import ManagementNavigation from "./ManagementNavigation";
import { isStageWorkspace } from "../../shared/management-navigation";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
    isActive
      ? "bg-white/15 text-white shadow-sm"
      : "text-white/70 hover:bg-white/10 hover:text-white"
  }`;

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const stageWorkspace = isStageWorkspace(location.pathname);
  const [open, setOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavigationRef = useRef<HTMLElement>(null);

  function closeMobileMenu(focusTarget: "button" | "main" = "button") {
    setOpen(false);
    requestAnimationFrame(() => {
      if (focusTarget === "main") document.getElementById("main-content")?.focus();
      else mobileMenuButtonRef.current?.focus();
    });
  }

  useEffect(() => {
    if (!open) return;
    mobileCloseButtonRef.current?.focus();
    function handleMenuKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMobileMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        mobileNavigationRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleMenuKeyboard);
    return () => document.removeEventListener("keydown", handleMenuKeyboard);
  }, [open]);

  if (!user) return null;

  const isAdmin = ["superadmin", "administration"].includes(user.role);
  const isProviseur = user.role === "proviseur";
  const isEleve = user.role === "eleve";


  async function handleLogout() {
    await logout();
    navigate(stageWorkspace ? "/login" : "/login?mode=staff&returnTo=%2Fgestion", { replace: true });
  }

  const navContent = (
    <>
      <div className="px-4 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/blaise-cendrars-portrait.webp" alt="" className="h-12 w-10 rounded-lg object-cover grayscale" />
          <div>
            <p className="text-sm font-bold text-white font-heading">
              Blaise Cendrars
            </p>
            <p className="text-xs text-white/75">{stageWorkspace ? "Stages et Grand Oral" : "Gestion du lycée"}</p>
          </div>
        </div>
      </div>

      <nav
        aria-label="Navigation principale"
        className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) closeMobileMenu("main");
        }}
      >
        {stageWorkspace ? <>
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

        <NavLink to="/security" className={navCls}><ShieldCheck className="w-4 h-4" />Sécurité du compte</NavLink>
        </> : <ManagementNavigation role={user.role} userId={user.id} />}
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
      <a
        href="#main-content"
        className="sr-only z-[80] rounded-md bg-white px-4 py-3 font-semibold text-slate-950 shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Aller au contenu principal
      </a>
      <aside className="hidden lg:flex w-64 flex-col bg-primary-500 shrink-0">
        {navContent}
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => closeMobileMenu()}
        />
      )}
      <aside
        ref={mobileNavigationRef}
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-primary-500 transition-transform lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          ref={mobileCloseButtonRef}
          onClick={() => closeMobileMenu()}
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
            ref={mobileMenuButtonRef}
            onClick={() => setOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
            aria-label="Ouvrir le menu"
            aria-expanded={open}
            aria-controls="mobile-navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <span className="font-medium text-gray-900">Blaise Cendrars</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>{stageWorkspace ? "Stages et Grand Oral" : "Gestion du lycée"}</span>
            <a href="/" className="ml-3 text-xs text-emerald-700 hover:underline">Voir le site</a>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
