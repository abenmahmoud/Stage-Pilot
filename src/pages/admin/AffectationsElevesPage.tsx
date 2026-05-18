import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  Save,
} from "lucide-react";

interface EleveAffectation {
  id: string;
  nom: string;
  prenom: string;
  classeId: string | null;
  classeNom: string | null;
  classeNiveau: string | null;
  professeurReferentId: string | null;
  profSpe1Id: string | null;
  profSpe2Id: string | null;
  stageActif: boolean;
  grandOralActif: boolean;
}

interface ClasseOption {
  id: string;
  nom: string;
  niveau: string;
}

interface ProfOption {
  id: string;
  nom: string;
  prenom: string;
  matieres: string | null;
}

interface AffectationsElevesResponse {
  eleves: EleveAffectation[];
  classes: ClasseOption[];
  professeurs: ProfOption[];
}

interface DraftAffectation {
  professeurReferentId: string;
  profSpe1Id: string;
  profSpe2Id: string;
  stageActif: boolean;
  grandOralActif: boolean;
}

const PAGE_SIZE = 50;

function draftFromEleve(eleve: EleveAffectation): DraftAffectation {
  return {
    professeurReferentId: eleve.professeurReferentId ?? "",
    profSpe1Id: eleve.profSpe1Id ?? "",
    profSpe2Id: eleve.profSpe2Id ?? "",
    stageActif: eleve.stageActif,
    grandOralActif: eleve.grandOralActif,
  };
}

function buildDrafts(eleves: EleveAffectation[]): Record<string, DraftAffectation> {
  return Object.fromEntries(eleves.map((eleve) => [eleve.id, draftFromEleve(eleve)]));
}

export default function AffectationsElevesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AffectationsElevesResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftAffectation>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterClasse, setFilterClasse] = useState("all");
  const [filterNiveau, setFilterNiveau] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<AffectationsElevesResponse>(
          "admin/affectations-eleves"
        );
        setData(res);
        setDrafts(buildDrafts(res.eleves));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filterClasse, filterNiveau, search]);

  const filteredEleves = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();

    return data.eleves.filter((eleve) => {
      if (filterClasse !== "all" && eleve.classeId !== filterClasse) return false;
      if (filterNiveau !== "all" && eleve.classeNiveau !== filterNiveau) {
        return false;
      }
      if (
        q &&
        !`${eleve.nom} ${eleve.prenom} ${eleve.classeNom ?? ""}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data, filterClasse, filterNiveau, search]);

  const pageCount = Math.max(1, Math.ceil(filteredEleves.length / PAGE_SIZE));
  const pageEleves = filteredEleves.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateDraft(
    eleve: EleveAffectation,
    field: keyof DraftAffectation,
    value: string | boolean
  ) {
    setDrafts((prev) => ({
      ...prev,
      [eleve.id]: {
        ...(prev[eleve.id] ?? draftFromEleve(eleve)),
        [field]: value,
      },
    }));
  }

  async function saveEleve(eleve: EleveAffectation) {
    const draft = drafts[eleve.id] ?? draftFromEleve(eleve);
    setSavingId(eleve.id);
    setSavedId(null);
    setError("");
    try {
      await apiFetch("admin/affectations-eleves", {
        method: "PUT",
        body: JSON.stringify({
          eleveId: eleve.id,
          professeurReferentId: draft.professeurReferentId || null,
          profSpe1Id: draft.profSpe1Id || null,
          profSpe2Id: draft.profSpe2Id || null,
          stageActif: draft.stageActif,
          grandOralActif: draft.grandOralActif,
        }),
      });

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          eleves: prev.eleves.map((item) =>
            item.id === eleve.id
              ? {
                  ...item,
                  professeurReferentId: draft.professeurReferentId || null,
                  profSpe1Id: draft.profSpe1Id || null,
                  profSpe2Id: draft.profSpe2Id || null,
                  stageActif: draft.stageActif,
                  grandOralActif: draft.grandOralActif,
                }
              : item
          ),
        };
      });
      setSavedId(eleve.id);
      window.setTimeout(() => setSavedId(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    }
    setSavingId(null);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/admin")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold font-heading text-gray-900">
          Affectations profs par élève
        </h1>
        <p className="text-sm text-gray-500">
          Affecte le référent de stage et les deux professeurs de spécialité Grand Oral.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un élève…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-500"
              />
            </div>
            <select
              value={filterNiveau}
              onChange={(e) => setFilterNiveau(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary-500"
            >
              <option value="all">Tous niveaux</option>
              <option value="seconde">Seconde</option>
              <option value="premiere">Première</option>
              <option value="terminale">Terminale</option>
              <option value="autre">Autre</option>
            </select>
            <select
              value={filterClasse}
              onChange={(e) => setFilterClasse(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary-500"
            >
              <option value="all">Toutes classes</option>
              {data?.classes.map((classe) => (
                <option key={classe.id} value={classe.id}>
                  {classe.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-500">
            <span>
              {filteredEleves.length} élève(s) affiché(s) sur{" "}
              {data?.eleves.length ?? 0}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>
              <span>
                Page {page} / {pageCount}
              </span>
              <button
                onClick={() =>
                  setPage((current) => Math.min(pageCount, current + 1))
                }
                disabled={page >= pageCount}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            </div>
          ) : pageEleves.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-16">
              Aucun élève ne correspond à ces filtres.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[680px]">
              <table className="w-full min-w-[1320px] text-sm">
                <thead className="sticky top-0 bg-white border-b">
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="px-4 py-3">Élève</th>
                    <th className="px-4 py-3">Classe</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Grand Oral</th>
                    <th className="px-4 py-3">Référent stage</th>
                    <th className="px-4 py-3">Prof spé 1 GO</th>
                    <th className="px-4 py-3">Prof spé 2 GO</th>
                    <th className="px-4 py-3 w-36">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pageEleves.map((eleve) => {
                    const draft = drafts[eleve.id] ?? draftFromEleve(eleve);
                    return (
                      <tr key={eleve.id}>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {eleve.nom} {eleve.prenom}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {eleve.classeNom ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={draft.stageActif}
                              onChange={(e) =>
                                updateDraft(eleve, "stageActif", e.target.checked)
                              }
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            Actif
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={draft.grandOralActif}
                              onChange={(e) =>
                                updateDraft(
                                  eleve,
                                  "grandOralActif",
                                  e.target.checked
                                )
                              }
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            Actif
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={draft.professeurReferentId}
                            onChange={(e) =>
                              updateDraft(
                                eleve,
                                "professeurReferentId",
                                e.target.value
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
                          >
                            <option value="">— Aucun —</option>
                            {data?.professeurs.map((prof) => (
                              <option key={prof.id} value={prof.id}>
                                {prof.nom} {prof.prenom}
                                {prof.matieres ? ` — ${prof.matieres}` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={draft.profSpe1Id}
                            onChange={(e) =>
                              updateDraft(eleve, "profSpe1Id", e.target.value)
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
                          >
                            <option value="">— Aucun —</option>
                            {data?.professeurs.map((prof) => (
                              <option key={prof.id} value={prof.id}>
                                {prof.nom} {prof.prenom}
                                {prof.matieres ? ` — ${prof.matieres}` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={draft.profSpe2Id}
                            onChange={(e) =>
                              updateDraft(eleve, "profSpe2Id", e.target.value)
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
                          >
                            <option value="">— Aucun —</option>
                            {data?.professeurs.map((prof) => (
                              <option key={prof.id} value={prof.id}>
                                {prof.nom} {prof.prenom}
                                {prof.matieres ? ` — ${prof.matieres}` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => saveEleve(eleve)}
                            disabled={savingId === eleve.id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 transition-all disabled:opacity-50"
                          >
                            {savedId === eleve.id ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            {savingId === eleve.id
                              ? "..."
                              : savedId === eleve.id
                                ? "OK"
                                : "Enregistrer"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
