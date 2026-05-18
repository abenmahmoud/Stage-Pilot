import { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { ArrowLeft, Save, School } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EtablissementData {
  id: string;
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
  uai: string;
  nomProviseur: string;
  civiliteProviseur: string;
  anneeScolaire: string;
  dateStageDebut: string;
  dateStageFin: string;
  dateLimiteConvention: string;
  dateGoDebut: string;
  dateGoFin: string;
}

export default function ParametresPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Partial<EtablissementData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<EtablissementData>("etablissement");
        setData(res);
      } catch {}
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("etablissement", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }

  function update(field: string, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/admin")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            Paramètres
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configuration de l'établissement
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all ${
            saved
              ? "bg-green-600"
              : "bg-primary-500 hover:bg-primary-600"
          } disabled:opacity-50`}
        >
          {saved ? (
            <>
              <Save className="w-4 h-4" />
              Enregistré
            </>
          ) : saving ? (
            "Enregistrement…"
          ) : (
            <>
              <Save className="w-4 h-4" />
              Enregistrer
            </>
          )}
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <School className="w-5 h-5 text-primary-500" />
            </div>
            <h2 className="text-lg font-bold font-heading">Établissement</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom
              </label>
              <input
                type="text"
                value={data.nom || ""}
                onChange={(e) => update("nom", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse
              </label>
              <input
                type="text"
                value={data.adresse || ""}
                onChange={(e) => update("adresse", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code postal
              </label>
              <input
                type="text"
                value={data.codePostal || ""}
                onChange={(e) => update("codePostal", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ville
              </label>
              <input
                type="text"
                value={data.ville || ""}
                onChange={(e) => update("ville", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone
              </label>
              <input
                type="text"
                value={data.telephone || ""}
                onChange={(e) => update("telephone", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={data.email || ""}
                onChange={(e) => update("email", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code UAI
              </label>
              <input
                type="text"
                value={data.uai || ""}
                onChange={(e) => update("uai", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Année scolaire
              </label>
              <input
                type="text"
                value={data.anneeScolaire || ""}
                onChange={(e) => update("anneeScolaire", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold font-heading">Chef d'établissement</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Civilité
              </label>
              <select
                value={data.civiliteProviseur || ""}
                onChange={(e) => update("civiliteProviseur", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
              >
                <option value="Mme">Mme</option>
                <option value="M.">M.</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom
              </label>
              <input
                type="text"
                value={data.nomProviseur || ""}
                onChange={(e) => update("nomProviseur", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold font-heading">Dates importantes</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Début stage
              </label>
              <input
                type="date"
                value={data.dateStageDebut || ""}
                onChange={(e) => update("dateStageDebut", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fin stage
              </label>
              <input
                type="date"
                value={data.dateStageFin || ""}
                onChange={(e) => update("dateStageFin", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Limite convention
              </label>
              <input
                type="date"
                value={data.dateLimiteConvention || ""}
                onChange={(e) => update("dateLimiteConvention", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Début Grand Oral
              </label>
              <input
                type="date"
                value={data.dateGoDebut || ""}
                onChange={(e) => update("dateGoDebut", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fin Grand Oral
              </label>
              <input
                type="date"
                value={data.dateGoFin || ""}
                onChange={(e) => update("dateGoFin", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
