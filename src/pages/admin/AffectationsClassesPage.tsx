import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { ArrowLeft, CheckCircle2, Search, UsersRound } from "lucide-react";

interface ClasseRow {
  id: string;
  nom: string;
  niveau: string;
  ppAuthUserId: string | null;
  ppProfesseurId: string | null;
  ppNom: string | null;
  ppPrenom: string | null;
}

interface ProfOption {
  id: string;
  authUserId: string;
  nom: string;
  prenom: string;
  matieres: string | null;
}

interface AffectationsClassesResponse {
  classes: ClasseRow[];
  professeurs: ProfOption[];
}

export default function AffectationsClassesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AffectationsClassesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<AffectationsClassesResponse>(
          "admin/affectations-classes"
        );
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
      setLoading(false);
    })();
  }, []);

  const filteredClasses = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.classes;
    return data.classes.filter((classe) =>
      `${classe.nom} ${classe.niveau} ${classe.ppNom ?? ""} ${
        classe.ppPrenom ?? ""
      }`
        .toLowerCase()
        .includes(q)
    );
  }, [data, search]);

  async function updateAffectation(classeId: string, ppId: string) {
    setSavingId(classeId);
    setSavedId(null);
    setError("");
    try {
      await apiFetch("admin/affectations-classes", {
        method: "PUT",
        body: JSON.stringify({ classeId, ppId: ppId || null }),
      });

      setData((prev) => {
        if (!prev) return prev;
        const selectedProf =
          prev.professeurs.find((prof) => prof.id === ppId) ?? null;
        return {
          ...prev,
          classes: prev.classes.map((classe) =>
            classe.id === classeId
              ? {
                  ...classe,
                  ppAuthUserId: selectedProf?.authUserId ?? null,
                  ppProfesseurId: selectedProf?.id ?? null,
                  ppNom: selectedProf?.nom ?? null,
                  ppPrenom: selectedProf?.prenom ?? null,
                }
              : classe
          ),
        };
      });
      setSavedId(classeId);
      window.setTimeout(() => setSavedId(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    }
    setSavingId(null);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/admin")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold font-heading text-gray-900">
          Affectations PP par classe
        </h1>
        <p className="text-sm text-gray-500">
          Associe chaque classe à un professeur principal disposant déjà d'un compte.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une classe ou un PP…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
            <UsersRound className="w-4 h-4" />
            {data?.professeurs.length ?? 0} professeurs avec compte
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            </div>
          ) : filteredClasses.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-16">
              Aucune classe ne correspond à cette recherche.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b">
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="px-4 py-3">Classe</th>
                    <th className="px-4 py-3">Niveau</th>
                    <th className="px-4 py-3">Professeur principal</th>
                    <th className="px-4 py-3">PP actuel</th>
                    <th className="px-4 py-3 w-28">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredClasses.map((classe) => (
                    <tr key={classe.id}>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {classe.nom}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {classe.niveau}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={classe.ppProfesseurId ?? ""}
                          onChange={(e) =>
                            updateAffectation(classe.id, e.target.value)
                          }
                          disabled={savingId === classe.id}
                          className="w-full min-w-[260px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:opacity-60"
                        >
                          <option value="">— Aucun PP —</option>
                          {data?.professeurs.map((prof) => (
                            <option key={prof.id} value={prof.id}>
                              {prof.nom} {prof.prenom}
                              {prof.matieres ? ` — ${prof.matieres}` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {classe.ppNom && classe.ppPrenom
                          ? `${classe.ppNom} ${classe.ppPrenom}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {savingId === classe.id ? (
                          <span className="text-xs font-medium text-blue-600">
                            Enregistrement…
                          </span>
                        ) : savedId === classe.id ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Enregistré
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
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
