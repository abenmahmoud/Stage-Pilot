import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, UsersRound } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { SUPPORT_SERVICES } from "../../../shared/support-agent-access";

type ServiceCode = typeof SUPPORT_SERVICES[number];
type Account = {
  id: string;
  email: string | null;
  appRole: "superadmin" | "proviseur" | "administration" | "agent";
  membershipRole: "admin" | "service_manager" | "agent";
  serviceCodes: ServiceCode[];
  globalAccess: boolean;
};
type Overview = {
  services: { code: ServiceCode; label: string; activeAccounts: number }[];
  accounts: Account[];
  passwordOnlyUntil: string | null;
};

const ROLE_LABELS: Record<Account["appRole"], string> = {
  superadmin: "Superadministrateur",
  proviseur: "Direction",
  administration: "Administration",
  agent: "Agent de service",
};

function isAccount(value: unknown): value is Account {
  if (!value || typeof value !== "object") return false;
  const account = value as Partial<Account>;
  return typeof account.id === "string"
    && (account.email === null || typeof account.email === "string")
    && typeof account.appRole === "string" && account.appRole in ROLE_LABELS
    && ["admin", "service_manager", "agent"].includes(account.membershipRole ?? "")
    && Array.isArray(account.serviceCodes)
    && account.serviceCodes.every(code => SUPPORT_SERVICES.includes(code))
    && typeof account.globalAccess === "boolean";
}

export default function ServiceAccessPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void apiFetch<Overview>("admin/service-access").then(value => {
      if (!value || !Array.isArray(value.services) || value.services.length !== SUPPORT_SERVICES.length
        || value.services.some(item => !SUPPORT_SERVICES.includes(item.code) || typeof item.label !== "string" || !Number.isSafeInteger(item.activeAccounts) || item.activeAccounts < 0)
        || !Array.isArray(value.accounts) || !value.accounts.every(isAccount)) {
        throw new Error("invalid");
      }
      if (active) setOverview(value);
    }).catch(() => {
      if (active) setError("La liste des accès n’a pas pu être chargée. Actualisez la page.");
    });
    return () => { active = false; };
  }, []);

  return <div className="mx-auto max-w-5xl space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Les services du lycée</h1>
      <p className="mt-2 text-slate-600">Chaque équipe retrouve ses demandes. Les messages, les documents et l’historique sont regroupés dans chaque dossier.</p>
    </div>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p> : null}
    {overview?.passwordOnlyUntil ? <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">Pendant les essais, les comptes des agents et de l’administration peuvent se connecter avec leur email et leur mot de passe, sans double authentification obligatoire, jusqu’au {new Date(overview.passwordOnlyUntil).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}. Les droits d’accès de chaque compte restent inchangés.</p> : null}
    {!overview && !error ? <p role="status">Chargement des services…</p> : null}
    {overview ? <p className="text-sm text-slate-600">{overview.accounts.length} compte{overview.accounts.length > 1 ? "s" : ""} actif{overview.accounts.length > 1 ? "s" : ""} au total. Un même compte peut être habilité pour plusieurs services ; les compteurs ci-dessous ne représentent pas forcément des personnes différentes.</p> : null}

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{overview?.services.map(service => <article key={service.code} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <UsersRound className="mb-4 h-6 w-6 text-blue-600" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-slate-900">{service.label}</h2>
      <p className="my-3 text-sm text-slate-600">{service.activeAccounts > 0 ? `${service.activeAccounts} compte${service.activeAccounts > 1 ? "s" : ""} habilité${service.activeAccounts > 1 ? "s" : ""}` : "Aucun compte affecté pour le moment"}</p>
      <Link className="inline-flex min-h-11 items-center gap-2 font-semibold text-blue-700" to={`/?view=agent&service=${service.code}`}>Ouvrir les demandes<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
    </article>)}</div>

    {overview ? <section aria-labelledby="active-accounts-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="active-accounts-heading" className="text-lg font-bold text-slate-950">Comptes et périmètres réellement actifs</h2>
      <p className="mt-1 text-sm text-slate-600">Cette liste permet de vérifier qui peut traiter les dossiers du lycée. Elle n’affiche aucun mot de passe ni code d’accès.</p>
      <div className="mt-5 divide-y divide-slate-100">
        {overview.accounts.map(account => <div key={account.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-semibold text-slate-950">{account.email ?? "Adresse de connexion indisponible"}</span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{ROLE_LABELS[account.appRole]}</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{account.globalAccess ? "Accès global aux demandes du lycée" : account.membershipRole === "service_manager" ? "Responsable des services attribués" : "Accès aux services attribués"}</p>
          {!account.globalAccess ? <div className="mt-2 flex flex-wrap gap-2">{account.serviceCodes.map(code => <span key={code} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">{overview.services.find(service => service.code === code)?.label ?? code}</span>)}</div> : null}
        </div>)}
      </div>
    </section> : null}

    <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
      <h2 className="mb-2 font-semibold text-slate-900">Préparer l’arrivée d’un collègue</h2>
      <p>Pour associer un compte individuel, il faut son nom, son email professionnel et les services autorisés. Un rôle n’est jamais déduit de l’adresse email. Le collègue ouvre ensuite son espace, prend une demande et répond dans le dossier. Il peut activer « Me prévenir » sur son téléphone.</p>
    </div>
  </div>;
}
