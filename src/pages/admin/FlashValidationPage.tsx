import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import {
  analyzeFlashVersionGap,
  type FlashImportance,
  type FlashVersionContent,
  type FlashVersionGapAnalysis,
} from "../../../shared/flash-version-diff";
import {
  resolveFlashAudienceTreatment,
  type FlashAudienceTreatment,
  type FlashNotificationChannel,
} from "../../../shared/flash-audience-correction";
import {
  assertLegalFlashVersionTransition,
  FlashTransitionError,
  type FlashVersionStatus,
} from "../../../shared/flash-transitions";
import { checkFlashProposalExpiration } from "../../../shared/flash-expiration";

// Meme jeu de groupes fictifs que FlashProposalPage.tsx (LOT 3), duplique
// deliberement plutot que factorise dans ce lot : voir le compte rendu du
// LOT 3, "Pour la suite", qui signale deja cette duplication a corriger dans
// un lot futur dedie, pas ici.
type FictitiousFlashGroup = { ref: string; label: string };

const FICTITIOUS_FLASH_GROUPS: readonly FictitiousFlashGroup[] = [
  { ref: "classe:2ndea", label: "Seconde A" },
  { ref: "classe:1stmga", label: "Première STMG A" },
  { ref: "niveau:terminale", label: "Tout le niveau terminale" },
  { ref: "personnel:enseignants", label: "Personnel enseignant" },
  { ref: "personnel:administratif", label: "Personnel administratif" },
  { ref: "parents:cantine", label: "Parents inscrits à la cantine" },
];

function groupLabel(ref: string): string {
  return FICTITIOUS_FLASH_GROUPS.find((group) => group.ref === ref)?.label ?? ref;
}

const IMPORTANCE_LABEL: Record<FlashImportance, string> = {
  normale: "Normale",
  importante: "Importante",
  urgente: "Urgente",
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function formatFlashAge(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / MINUTE_MS));
  if (minutes < 60) return minutes <= 1 ? "il y a 1 min" : `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours <= 1 ? "il y a 1 h" : `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "il y a 1 j" : `il y a ${days} j`;
}

type FictitiousPreviousVersion = {
  content: FlashVersionContent;
  audience: string[];
  /** Canaux ayant reellement notifie cette version precedente (jamais deduits de son importance declaree). */
  notifiedChannels: FlashNotificationChannel[];
};

type FictitiousFlashProposal = {
  id: string;
  authorLabel: string;
  proposedAt: Date;
  expiresAt: Date;
  previous: FictitiousPreviousVersion | null;
  next: {
    content: FlashVersionContent;
    audience: string[];
  };
};

/**
 * Jeu d'essai fictif : cinq propositions en attente illustrant les cas du plan
 * de nuit (nouvelle proposition, changement decisif a audience inchangee,
 * correction de forme, audience reduite, montee normale -> urgente). Aucune
 * donnee reelle, aucun nom d'eleve, de parent ou de personnel. Ce lot ne lit
 * rien depuis `flash_info_versions`/`flash_info_audiences` (LOT 1) : c'est
 * hors perimetre, voir le compte rendu du lot.
 */
function buildFictitiousPendingProposals(now: Date): FictitiousFlashProposal[] {
  const t = now.getTime();
  return [
    {
      id: "flash-001",
      authorLabel: "Mme Diarra (professeure, compte fictif)",
      proposedAt: new Date(t - 18 * MINUTE_MS),
      expiresAt: new Date(t + 3 * HOUR_MS),
      previous: null,
      next: {
        content: {
          title: "Sortie pédagogique de la classe de Seconde A confirmée",
          bodyMarkdown: "Départ à 8h30 devant le hall principal, retour prévu à 17h.",
          importance: "normale",
        },
        audience: ["classe:2ndea"],
      },
    },
    {
      id: "flash-002",
      authorLabel: "M. Konaté (professeur principal, compte fictif)",
      proposedAt: new Date(t - 2 * HOUR_MS - 10 * MINUTE_MS),
      expiresAt: new Date(t + 1 * HOUR_MS),
      previous: {
        content: {
          title: "Réunion parents-professeurs du niveau terminale à 18h, salle polyvalente",
          bodyMarkdown: "Présence conseillée pour le choix des spécialités.",
          importance: "importante",
        },
        audience: ["niveau:terminale"],
        notifiedChannels: ["push"],
      },
      next: {
        content: {
          title: "Réunion parents-professeurs du niveau terminale à 19h30, salle B204",
          bodyMarkdown: "Présence conseillée pour le choix des spécialités.",
          importance: "importante",
        },
        audience: ["niveau:terminale"],
      },
    },
    {
      id: "flash-003",
      authorLabel: "Mme Traoré (administration, compte fictif)",
      proposedAt: new Date(t - 45 * MINUTE_MS),
      expiresAt: new Date(t + 5 * HOUR_MS),
      previous: {
        content: {
          title: "Menu de cantine modifié pour jeudi : alternative végétarienne au poisson",
          bodyMarkdown: "Le plat de poisson est remplacé par une alternative végétarienne.",
          importance: "importante",
        },
        audience: ["parents:cantine"],
        notifiedChannels: ["push"],
      },
      next: {
        content: {
          // Reformulation ponctuation/casse sans changement de sens : cas "forme".
          title: "Menu de cantine modifié pour jeudi : alternative végétarienne au poisson.",
          bodyMarkdown: "le plat de poisson est remplacé par une alternative végétarienne",
          importance: "importante",
        },
        audience: ["parents:cantine"],
      },
    },
    {
      id: "flash-004",
      authorLabel: "M. Camara (DDFPT, compte fictif)",
      proposedAt: new Date(t - 3 * HOUR_MS),
      expiresAt: new Date(t + 2 * HOUR_MS),
      previous: {
        content: {
          title: "Changement de salle pour les épreuves du bac blanc de terminale",
          bodyMarkdown: "Les épreuves se déroulent en salle C102 au lieu du gymnase.",
          importance: "urgente",
        },
        audience: ["niveau:terminale", "personnel:enseignants"],
        notifiedChannels: ["push", "email"],
      },
      next: {
        content: {
          title: "Changement de salle pour les épreuves du bac blanc de terminale",
          bodyMarkdown: "Les épreuves se déroulent en salle C102 au lieu du gymnase.",
          importance: "urgente",
        },
        // Personnel enseignant retire : il n'est plus concerne par ce message.
        audience: ["niveau:terminale"],
      },
    },
    {
      id: "flash-005",
      authorLabel: "Mme Diarra (professeure, compte fictif)",
      proposedAt: new Date(t - 12 * MINUTE_MS),
      expiresAt: new Date(t + 4 * HOUR_MS),
      previous: {
        content: {
          title: "Menu de cantine de la semaine disponible sur le site",
          bodyMarkdown: "Consultez le menu complet sur la page cantine.",
          importance: "normale",
        },
        audience: ["parents:cantine", "personnel:administratif"],
        notifiedChannels: [],
      },
      next: {
        content: {
          title: "Incident cuisine : la cantine est fermée exceptionnellement ce midi",
          bodyMarkdown: "Un panier-repas froid est distribué à la place du service habituel.",
          importance: "urgente",
        },
        audience: ["parents:cantine", "personnel:administratif"],
      },
    },
  ];
}

/** Deux propositions deja hors delai (T071D), jamais fermees en silence. */
function buildFictitiousExpiredProposals(now: Date): FictitiousFlashProposal[] {
  const t = now.getTime();
  return [
    {
      id: "flash-101",
      authorLabel: "M. Konaté (professeur principal, compte fictif)",
      proposedAt: new Date(t - 30 * HOUR_MS),
      expiresAt: new Date(t - 6 * HOUR_MS),
      previous: null,
      next: {
        content: {
          title: "Report du contrôle de mathématiques de la classe de Première STMG A",
          bodyMarkdown: "Le contrôle initialement prévu vendredi est reporté à la semaine suivante.",
          importance: "importante",
        },
        audience: ["classe:1stmga"],
      },
    },
    {
      id: "flash-102",
      authorLabel: "Mme Traoré (administration, compte fictif)",
      proposedAt: new Date(t - 50 * HOUR_MS),
      expiresAt: new Date(t - 26 * HOUR_MS),
      previous: null,
      next: {
        content: {
          title: "Fermeture anticipée de la demi-pension le dernier jour avant les vacances",
          bodyMarkdown: "Service de restauration terminé à 12h30 ce jour-là.",
          importance: "normale",
        },
        audience: ["parents:cantine"],
      },
    },
  ];
}

type ProposalAnalysis = {
  gap: FlashVersionGapAnalysis | null;
  audienceChanged: boolean;
  isDecisive: boolean;
  audienceTreatment: FlashAudienceTreatment | null;
};

/**
 * §13 : le decisif couvre date/heure/lieu/annulation/public/importance.
 * `analyzeFlashVersionGap` (LOT 2) ne voit que texte+importance (le public
 * est une table a part) : ce module ajoute donc la comparaison d'audience en
 * plus du gap texte, pour que le "decisif" affiche ici corresponde a la
 * liste complete de §13, pas seulement au texte.
 */
function analyzeProposal(proposal: FictitiousFlashProposal): ProposalAnalysis {
  if (!proposal.previous) {
    return { gap: null, audienceChanged: false, isDecisive: false, audienceTreatment: null };
  }
  const gap = analyzeFlashVersionGap(proposal.previous.content, proposal.next.content);
  const previousAudienceSorted = [...proposal.previous.audience].sort();
  const nextAudienceSorted = [...proposal.next.audience].sort();
  const audienceChanged =
    previousAudienceSorted.length !== nextAudienceSorted.length ||
    previousAudienceSorted.some((ref, index) => ref !== nextAudienceSorted[index]);
  const audienceTreatment = resolveFlashAudienceTreatment({
    previousAudience: proposal.previous.audience,
    nextAudience: proposal.next.audience,
    previousNotifiedChannels: proposal.previous.notifiedChannels,
    nextImportance: proposal.next.content.importance,
  });
  return {
    gap,
    audienceChanged,
    isDecisive: gap.kind === "decisif" || audienceChanged,
    audienceTreatment,
  };
}

type ConfirmedSets = Record<"maintained" | "removed" | "added", boolean>;

function defaultConfirmed(value?: ConfirmedSets): ConfirmedSets {
  return value ?? { maintained: false, removed: false, added: false };
}

interface ProposalCardProps {
  proposal: FictitiousFlashProposal;
  now: Date;
  status: FlashVersionStatus;
  transitionError: string | null;
  forcedCorrection: boolean;
  confirmedSets: ConfirmedSets;
  outcome: "prepared" | "refused" | null;
  onDecide: (target: "validee" | "refusee") => void;
  onToggleForce: () => void;
  onToggleSet: (key: "maintained" | "removed" | "added") => void;
  onPrepare: () => void;
  onRefuse: () => void;
}

function FlashValidationProposalCard({
  proposal,
  now,
  status,
  transitionError,
  forcedCorrection,
  confirmedSets,
  outcome,
  onDecide,
  onToggleForce,
  onToggleSet,
  onPrepare,
  onRefuse,
}: ProposalCardProps) {
  const analysis = analyzeProposal(proposal);
  const showCorrection = !!proposal.previous && (analysis.isDecisive || forcedCorrection);
  const treatment = analysis.audienceTreatment;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-900">{proposal.next.content.title}</h2>
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {IMPORTANCE_LABEL[proposal.next.content.importance]}
          </span>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Proposée par {proposal.authorLabel} · {formatFlashAge(now.getTime() - proposal.proposedAt.getTime())} ·
          expire le {proposal.expiresAt.toLocaleString("fr-FR")}
        </p>
        <p className="text-xs font-medium text-gray-500">
          {proposal.previous ? "Modification d'une information déjà publiée" : "Nouvelle proposition"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {proposal.previous && (
          <div className="space-y-2 rounded-xl border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-600">Comparaison des deux versions</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 rounded-lg bg-gray-50 p-2 text-xs">
                <p className="font-medium text-gray-500">Avant</p>
                <p className={proposal.previous.content.title !== proposal.next.content.title ? "rounded bg-amber-100 px-1" : ""}>
                  {proposal.previous.content.title}
                </p>
                <p className="text-gray-600">{proposal.previous.content.bodyMarkdown}</p>
                <p className="text-gray-500">Importance : {IMPORTANCE_LABEL[proposal.previous.content.importance]}</p>
                <p className="text-gray-500">Public : {proposal.previous.audience.map(groupLabel).join(", ")}</p>
              </div>
              <div className="space-y-1 rounded-lg bg-gray-50 p-2 text-xs">
                <p className="font-medium text-gray-500">Après</p>
                <p className={proposal.previous.content.title !== proposal.next.content.title ? "rounded bg-amber-100 px-1" : ""}>
                  {proposal.next.content.title}
                </p>
                <p className="text-gray-600">{proposal.next.content.bodyMarkdown}</p>
                <p className="text-gray-500">Importance : {IMPORTANCE_LABEL[proposal.next.content.importance]}</p>
                <p className="text-gray-500">Public : {proposal.next.audience.map(groupLabel).join(", ")}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Écart :{" "}
              <span className="font-medium text-gray-800">
                {analysis.gap?.kind === "decisif" ? "décisif" : "de forme"}
              </span>
              {analysis.audienceChanged && " · public modifié (décisif)"}
            </p>
          </div>
        )}

        {proposal.previous && !analysis.isDecisive && !forcedCorrection && (
          <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p>Correction de forme : aucune proposition de correction par défaut.</p>
              <button
                type="button"
                onClick={onToggleForce}
                className="min-h-[40px] font-medium text-primary-700 underline underline-offset-2"
              >
                Demander quand même une correction
              </button>
            </div>
          </div>
        )}

        {showCorrection && treatment && (
          <div className="space-y-3 rounded-xl border border-primary-100 bg-primary-50/40 p-3">
            <div className="flex items-start gap-2 text-xs text-primary-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {analysis.isDecisive
                  ? "Écart décisif : une proposition de correction est disponible."
                  : "Correction de forme demandée malgré tout."}{" "}
                Rien n'est envoyé sans confirmation du référent numérique ou de la DDFPT.
              </p>
            </div>

            {!treatment.correctionPossible && proposal.next.content.importance === "normale" && (
              <p className="text-xs text-gray-600">
                La nouvelle version reste normale : seul le site est mis à jour, aucun envoi n'est possible.
              </p>
            )}

            {!treatment.correctionPossible && proposal.next.content.importance !== "normale" && (
              <div className="space-y-2 text-xs text-gray-700">
                <p>
                  Aucun canal n'a réellement notifié la version précédente : ceci n'est pas une correction,
                  c'est une information neuve pour tout le public visé ({treatment.added.length} groupe(s)).
                </p>
                <p className="rounded-lg bg-white p-2">{proposal.next.content.title}</p>
              </div>
            )}

            {treatment.correctionPossible && (
              <div className="space-y-2">
                {(["maintained", "removed", "added"] as const).map((key) => {
                  const refs = treatment[key];
                  const setLabel = key === "maintained" ? "Maintenus" : key === "removed" ? "Retirés" : "Ajoutés";
                  const SetIcon = key === "maintained" ? Users : key === "removed" ? UserMinus : UserPlus;
                  const text =
                    key === "maintained"
                      ? `Information corrigée : ${proposal.next.content.title}`
                      : key === "removed"
                        ? "Cette information ne vous concerne plus."
                        : `Nouvelle information (pas une correction) : ${proposal.next.content.title}`;
                  return (
                    <div key={key} className="rounded-lg border border-gray-200 bg-white p-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-medium text-gray-800">
                          <SetIcon className="h-3.5 w-3.5 shrink-0" /> {setLabel} ({refs.length})
                        </span>
                        <label className="flex min-h-[40px] items-center gap-1.5 text-gray-600">
                          <input
                            type="checkbox"
                            checked={confirmedSets[key]}
                            onChange={() => onToggleSet(key)}
                            disabled={refs.length === 0}
                            className="h-4 w-4"
                          />
                          Confirmer
                        </label>
                      </div>
                      {refs.length > 0 && (
                        <>
                          <p className="mt-1 text-gray-500">{refs.map(groupLabel).join(", ")}</p>
                          <p className="mt-1 rounded bg-gray-50 p-1.5 text-gray-700">{text}</p>
                        </>
                      )}
                    </div>
                  );
                })}
                <p className="text-xs text-gray-500">
                  Canaux réellement notifiés réutilisables : {treatment.eligibleChannels.join(", ") || "aucun"}
                </p>
              </div>
            )}

            {outcome === "prepared" && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                Correction préparée (simulation) : rien n'a été envoyé.
              </div>
            )}
            {outcome === "refused" && (
              <div className="flex items-start gap-2 rounded-lg border border-gray-300 bg-gray-100 p-2 text-xs text-gray-700">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Correction refusée (simulation) : seule la nouvelle version est enregistrée, aucun message
                n'est envoyé.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onPrepare}
                disabled={
                  treatment.correctionPossible &&
                  (["maintained", "removed", "added"] as const).some(
                    (key) => treatment[key].length > 0 && !confirmedSets[key]
                  )
                }
                className="min-h-[40px] rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
              >
                Préparer la notification de correction (simulation)
              </button>
              <button
                type="button"
                onClick={onRefuse}
                className="min-h-[40px] rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700"
              >
                Refuser la correction
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          {status === "proposee" && (
            <>
              <button
                type="button"
                onClick={() => onDecide("validee")}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white"
              >
                <ShieldCheck className="h-4 w-4" /> Valider (simulation)
              </button>
              <button
                type="button"
                onClick={() => onDecide("refusee")}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700"
              >
                <ShieldX className="h-4 w-4" /> Refuser (simulation)
              </button>
            </>
          )}
          {status === "validee" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Validée (simulation) — rien n'a été envoyé
            </span>
          )}
          {status === "refusee" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <XCircle className="h-4 w-4" /> Refusée (simulation)
            </span>
          )}
          {transitionError && (
            <span className="text-xs text-red-600">Transition refusée : {transitionError}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function FlashValidationPage() {
  const navigate = useNavigate();
  const [now] = useState(() => new Date());
  const pendingProposals = useMemo(() => buildFictitiousPendingProposals(now), [now]);
  const expiredProposals = useMemo(() => buildFictitiousExpiredProposals(now), [now]);

  const [decisions, setDecisions] = useState<Record<string, { status: FlashVersionStatus; error: string | null }>>(
    {}
  );
  const [forcedCorrections, setForcedCorrections] = useState<Record<string, boolean>>({});
  const [confirmedSets, setConfirmedSets] = useState<Record<string, ConfirmedSets>>({});
  const [correctionOutcomes, setCorrectionOutcomes] = useState<Record<string, "prepared" | "refused">>({});

  function currentStatus(id: string): FlashVersionStatus {
    return decisions[id]?.status ?? "proposee";
  }

  function decide(id: string, target: "validee" | "refusee") {
    const from = currentStatus(id);
    try {
      assertLegalFlashVersionTransition(from, target);
      setDecisions((previous) => ({ ...previous, [id]: { status: target, error: null } }));
    } catch (caught) {
      const reason = caught instanceof FlashTransitionError ? caught.reason : "erreur_inconnue";
      setDecisions((previous) => ({ ...previous, [id]: { status: from, error: reason } }));
    }
  }

  function toggleForcedCorrection(id: string) {
    setForcedCorrections((previous) => ({ ...previous, [id]: !previous[id] }));
    setCorrectionOutcomes((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }

  function toggleSetConfirmed(id: string, key: "maintained" | "removed" | "added") {
    setConfirmedSets((previous) => {
      const current = defaultConfirmed(previous[id]);
      return { ...previous, [id]: { ...current, [key]: !current[key] } };
    });
  }

  function prepareCorrection(id: string) {
    setCorrectionOutcomes((previous) => ({ ...previous, [id]: "prepared" }));
  }

  function refuseCorrection(id: string) {
    setCorrectionOutcomes((previous) => ({ ...previous, [id]: "refused" }));
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-3 sm:px-0">
      <button
        onClick={() => navigate("/admin")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-bold text-gray-900 sm:text-2xl">
          Valider et modifier les informations flash
        </h1>
        <p className="text-sm text-gray-500">
          Réservé au référent numérique ou à la DDFPT. Simulation avec des propositions fictives :
          rien n'est lu depuis la base, rien n'est publié, rien n'est envoyé depuis cet écran.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Mode simulation : chaque bouton ci-dessous prépare et affiche un aperçu local. Aucune
          requête serveur, aucune notification, aucun appel à un fournisseur n'est déclenché.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Propositions en attente ({pendingProposals.length})</h2>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {pendingProposals.map((proposal) => (
              <li
                key={proposal.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0"
              >
                <span className="min-w-0 truncate text-gray-800">{proposal.next.content.title}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3.5 w-3.5" />
                  {formatFlashAge(now.getTime() - proposal.proposedAt.getTime())}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {pendingProposals.map((proposal) => (
        <FlashValidationProposalCard
          key={proposal.id}
          proposal={proposal}
          now={now}
          status={currentStatus(proposal.id)}
          transitionError={decisions[proposal.id]?.error ?? null}
          forcedCorrection={!!forcedCorrections[proposal.id]}
          confirmedSets={defaultConfirmed(confirmedSets[proposal.id])}
          outcome={correctionOutcomes[proposal.id] ?? null}
          onDecide={(target) => decide(proposal.id, target)}
          onToggleForce={() => toggleForcedCorrection(proposal.id)}
          onToggleSet={(key) => toggleSetConfirmed(proposal.id, key)}
          onPrepare={() => prepareCorrection(proposal.id)}
          onRefuse={() => refuseCorrection(proposal.id)}
        />
      ))}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">
            Propositions expirées sans validation ({expiredProposals.length})
          </h2>
          <p className="text-xs text-gray-500">
            Échecs comptés et consultables, pour ajuster ensuite les délais ou le nombre de valideurs.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {expiredProposals.map((proposal) => {
            const check = checkFlashProposalExpiration({
              status: "proposee",
              expiresAt: proposal.expiresAt,
              now,
            });
            return (
              <div key={proposal.id} className="space-y-1 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs">
                <p className="font-medium text-gray-800">{proposal.next.content.title}</p>
                <p className="text-gray-500">
                  Proposée par {proposal.authorLabel} · {formatFlashAge(now.getTime() - proposal.proposedAt.getTime())}
                </p>
                <p className="flex items-start gap-1.5 text-gray-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  Message à l'auteur (simulation) : cette proposition n'a pas été publiée, faute de
                  validation à temps, et personne n'a été informé.
                </p>
                <p className="text-gray-400">
                  Détection : {check.isExpiredWithoutValidation ? "expirée sans validation" : check.reason}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
