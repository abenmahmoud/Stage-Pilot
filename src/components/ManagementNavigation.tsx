import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Activity, BadgeCheck, BookOpen, BookOpenCheck, CalendarDays, Coins, IdCard, Inbox, LayoutDashboard, MessagesSquare, Newspaper, ShieldCheck, UsersRound, WandSparkles, Zap } from "lucide-react";
import type { UserRole } from "../lib/types";
import { apiFetch } from "../lib/api";
import { isValidFlashValidationScreenAccessPayload } from "../../shared/flash-payload-policy";
import { COMMUNICATIONS_UI_ENABLED, FLASH_INFO_UI_ENABLED, FLASH_VALIDATION_UI_ENABLED, NOMINATIVE_SEND_UI_ENABLED, WEEKLY_BRIEF_UI_ENABLED } from "../lib/feature-flags";

export function useManagementLinks(role: UserRole, userId: string) {
  const [validation, setValidation] = useState<{ userId: string; allowed: boolean } | null>(null);
  useEffect(() => {
    if (!FLASH_VALIDATION_UI_ENABLED) return;
    let active = true;
    apiFetch<unknown>("flash/validation/screen-access").then(value => {
      if (active) setValidation({ userId, allowed: isValidFlashValidationScreenAccessPayload(value) && value.allowed });
    }).catch(() => { if (active) setValidation({ userId, allowed: false }); });
    return () => { active = false; };
  }, [userId, role]);
  const support = ["superadmin", "administration", "agent", "proviseur"].includes(role);
  const editor = ["superadmin", "administration", "proviseur"].includes(role);
  const direction = ["superadmin", "proviseur"].includes(role);
  return [
    { to: "/gestion", label: "Vue d’ensemble", icon: LayoutDashboard, group: "Au quotidien", show: support },
    { to: "/gestion/demandes", label: "Demandes", icon: Inbox, group: "Au quotidien", show: support },
    { to: "/admin/validations-agent", label: "Validations des demandes", icon: BadgeCheck, group: "Au quotidien", show: support },
    { to: "/admin/contenus", label: "Contenus du site", icon: Newspaper, group: "Publications", show: editor },
    { to: "/admin/hebdo", label: "Préparer l’hebdo", icon: WandSparkles, group: "Publications", show: editor && WEEKLY_BRIEF_UI_ENABLED },
    { to: "/admin/informations-flash/proposer", label: "Information flash", icon: Zap, group: "Publications", show: FLASH_INFO_UI_ENABLED && ["superadmin", "administration", "proviseur", "professeur", "pp"].includes(role) },
    { to: "/admin/informations-flash/valider", label: "Valider les flashs", icon: ShieldCheck, group: "Publications", show: FLASH_VALIDATION_UI_ENABLED && validation?.userId === userId && validation.allowed },
    { to: "/admin/communications", label: "Communications", icon: MessagesSquare, group: "Publications", show: editor && COMMUNICATIONS_UI_ENABLED },
    { to: "/admin/envois-nominatifs", label: "Envois nominatifs", icon: MessagesSquare, group: "Publications", show: editor && NOMINATIVE_SEND_UI_ENABLED },
    { to: "/admin/services", label: "Équipes et services", icon: UsersRound, group: "Administration du lycée", show: direction },
    { to: "/admin/repertoire-identites", label: "Annuaire du lycée", icon: IdCard, group: "Administration du lycée", show: direction },
    { to: "/admin/emplois-du-temps", label: "Emplois du temps", icon: CalendarDays, group: "Administration du lycée", show: direction },
    { to: "/admin/connaissances-agent", label: "Connaissances de l’IA", icon: BookOpenCheck, group: "Administration du lycée", show: direction },
    { to: "/admin/sante-demandes", label: "Suivi du fonctionnement", icon: Activity, group: "Administration du lycée", show: direction },
    { to: "/gestion/budget-ia", label: "Coûts et budget IA", icon: Coins, group: "Superadministration", show: role === "superadmin" },
    { to: "/gestion/manuel", label: "Manuel d’utilisation", icon: BookOpen, group: "Superadministration", show: role === "superadmin" },
    { to: "/security", label: "Sécurité de mon compte", icon: ShieldCheck, group: "Mon compte", show: true },
  ].filter(item => item.show);
}

export default function ManagementNavigation({ role, userId }: { role: UserRole; userId: string }) {
  const links = useManagementLinks(role, userId);
  return <>{links.map((item, i) => <div key={item.to}>
    {links[i - 1]?.group !== item.group && <p className="px-4 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-wider text-white/50">{item.group}</p>}
    <NavLink to={item.to} end className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
      <item.icon className="h-4 w-4 shrink-0" /><span>{item.label}</span>
    </NavLink>
  </div>)}</>;
}
