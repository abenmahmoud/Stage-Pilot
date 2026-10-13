import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, ClipboardList, Copy, PencilLine, Printer, RefreshCw, Search, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { isActionBoardPayload, BOARD_SERVICES, BOARD_STATUSES, TEAM_INSTRUCTION_PREFIX, type ActionBoardPayload, type ActionBoardRow } from '../../../shared/support-action-board';
import { verifySupportInternalNoteConfirmation } from '../../../shared/support-internal-note-confirmation';
import './team-action-board.css';

const date = (value: string) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(value));

export default function TeamActionBoard() {
  const [params, setParams] = useSearchParams();
  const service = params.get('service') || '';
  const equipment = params.get('scope') === 'equipment';
  const state = ['active', 'waiting', 'completed'].includes(params.get('etat') || '') ? params.get('etat')! : 'open';
  const page = Math.max(1, Math.min(10000, Number(params.get('page')) || 1));
  const query = (params.get('q') || '').slice(0, 80);
  const [search, setSearch] = useState(query);
  const [payload, setPayload] = useState<ActionBoardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [printNames, setPrintNames] = useState(false);
  const operations = useRef(new Map<string, { note: string; key: string }>());
  const currentLoad = useRef(0);

  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
    setEditing(null);
    setNotice('');
  }

  useEffect(() => { setSearch(query); }, [query]);
  useEffect(() => {
    const id = ++currentLoad.current;
    const controller = new AbortController();
    setLoading(true); setPayload(null); setError('');
    const request = new URLSearchParams({ view: 'actions', page: String(page), pageSize: '50', state: state === 'completed' ? 'completed' : state === 'active' ? 'active' : 'open' });
    if (state === 'waiting') request.set('status', 'attente_demandeur');
    if (service) request.set('service', service);
    if (equipment) request.set('scope', 'equipment');
    if (query) request.set('q', query);
    apiFetch<unknown>(`support/agent/requests?${request}`, { signal: controller.signal }).then(value => {
      if (id !== currentLoad.current || controller.signal.aborted) return;
      if (!isActionBoardPayload(value)) throw new Error('Le tableau reçu est incomplet. Actualisez pour reprendre.');
      setPayload(value);
    }).catch(reason => {
      if (id === currentLoad.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Chargement impossible.');
    }).finally(() => { if (id === currentLoad.current && !controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [service, equipment, state, page, query, refresh]);

  async function save(row: ActionBoardRow) {
    const text = (drafts[row.publicCode] ?? '').trim();
    if (!text || text.length > 1000 || saving) return;
    const note = TEAM_INSTRUCTION_PREFIX + text;
    let operation = operations.current.get(row.publicCode);
    if (!operation || operation.note !== note) {
      operation = { note, key: crypto.randomUUID() };
      operations.current.set(row.publicCode, operation);
    }
    setSaving(row.publicCode); setError(''); setNotice('');
    try {
      const result = await apiFetch<{ confirmation: unknown }>(`support/agent/requests/${row.publicCode}/notes`, {
        method: 'POST', headers: { 'Idempotency-Key': operation.key }, body: JSON.stringify({ note }),
      });
      if (!verifySupportInternalNoteConfirmation({ expectedPublicCode: row.publicCode, confirmation: result.confirmation })) throw new Error('La confirmation manque. Réessayez pour vérifier le même enregistrement.');
      setNotice(`Consigne enregistrée pour ${row.publicCode}. L’équipe la retrouve dans ce tableau.`);
      operations.current.delete(row.publicCode); setEditing(null); setRefresh(v => v + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.'); }
    finally { setSaving(null); }
  }

  async function copyLink() {
    const link = new URL('/gestion/actions', window.location.origin);
    if (service) link.searchParams.set('service', service);
    if (equipment) link.searchParams.set('scope', 'equipment');
    if (state !== 'open') link.searchParams.set('etat', state);
    try {
      await navigator.clipboard.writeText(link.toString());
      setNotice('Lien copié. Chaque collègue se connecte avec son compte et voit uniquement les demandes autorisées.');
    } catch { setError('La copie est indisponible. Utilisez l’adresse de cette page pour partager le tableau.'); }
  }

  const services = payload?.access.canViewAll ? Object.keys(BOARD_SERVICES) : payload?.access.serviceCodes || [];
  const rows = payload?.rows || [];
  const total = payload?.pagination.total ?? 0;
  return <section className="team-action-board" data-print-names={printNames} aria-labelledby="team-board-title" aria-busy={loading}>
    <header className="team-board-header">
      <div><p className="team-board-eyebrow"><ClipboardList size={18} aria-hidden="true" /> Le suivi, simplement</p><h1 id="team-board-title">Tableau des actions</h1><p>Date, problème et prochaine étape : l’essentiel pour agir ensemble.</p></div>
      <div className="team-board-tools">
        <button type="button" onClick={copyLink} disabled={!payload}><Copy size={17} aria-hidden="true" />Partager le lien</button>
        <button type="button" onClick={() => window.print()} disabled={loading || !rows.length || Boolean(error)}><Printer size={17} aria-hidden="true" />Imprimer / PDF</button>
        <button type="button" onClick={() => setRefresh(v => v + 1)} disabled={loading} aria-label="Actualiser le tableau"><RefreshCw size={17} aria-hidden="true" className={loading ? 'animate-spin' : ''} /></button>
      </div>
    </header>
    <nav className="team-board-scopes" aria-label="Type de demandes">
      <button type="button" aria-pressed={!equipment} onClick={() => filter('scope', '')}>Demandes des usagers</button>
      <button type="button" aria-pressed={equipment} onClick={() => filter('scope', 'equipment')}>Matériel & SPIE</button>
    </nav>
    <div className="team-board-filters">
      <label>Équipe<select value={service} onChange={event => filter('service', event.target.value)} disabled={loading}>
        <option value="">{payload?.access.canViewAll ? 'Toutes les équipes' : 'Mes équipes'}</option>
        {service && !services.includes(service) && <option value={service}>{BOARD_SERVICES[service] || 'Service demandé'}</option>}
        {services.map(code => <option key={code} value={code}>{BOARD_SERVICES[code]}</option>)}
      </select></label>
      <label>Suivi<select value={state} onChange={event => filter('etat', event.target.value)}>
        <option value="open">Toutes les demandes à suivre</option><option value="active">Action du lycée / en cours</option><option value="waiting">Réponse du demandeur attendue</option><option value="completed">Terminées</option>
      </select></label>
      <form onSubmit={event => { event.preventDefault(); filter('q', search.trim()); }}><label htmlFor="team-board-search">Retrouver une demande</label><div><input id="team-board-search" value={search} maxLength={80} onChange={event => setSearch(event.target.value)} placeholder="Numéro, nom ou sujet" /><button type="submit" aria-label="Rechercher"><Search size={18} aria-hidden="true" /></button></div></form>
    </div>
    {notice && <p role="status" className="team-board-notice">{notice}</p>}
    {error && <div role="alert" className="team-board-error">{error}<button type="button" onClick={() => setRefresh(v => v + 1)}>Réessayer</button></div>}
    {loading && <p role="status" className="team-board-empty">Chargement du tableau…</p>}
    {payload && !loading && <>
      <div className="team-board-summary"><div><strong>{total} demande{total > 1 ? 's' : ''}</strong><span> · {service ? BOARD_SERVICES[service] : 'Périmètre autorisé'} · actualisé le {date(payload.generatedAt)} à {time(payload.generatedAt)}</span></div><label className="team-board-print-option"><input type="checkbox" checked={printNames} onChange={event => setPrintNames(event.target.checked)} />Afficher le champ Demandeur dans le PDF</label></div>
      <p className="team-board-print-caption">Lycée Blaise Cendrars · Suivi interne · {equipment ? 'Matériel & SPIE' : 'Demandes des usagers'} · Page {payload.pagination.page}/{payload.pagination.totalPages} · {rows.length} lignes sur {total} · {date(payload.generatedAt)} {time(payload.generatedAt)}</p>
      {!rows.length ? <div className="team-board-empty"><Check size={28} aria-hidden="true" /><h2>Aucune demande dans cette vue</h2><p>Changez le service ou le suivi pour consulter une autre sélection.</p></div> : <div className="team-board-table-wrap"><table className="team-board-table"><caption className="sr-only">Demandes autorisées et prochaines actions de l’équipe</caption><thead><tr><th scope="col">Date et numéro</th><th scope="col">Problème</th><th scope="col">Service et suivi</th><th scope="col">Quoi faire</th><th scope="col" className="team-board-screen-only">Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.publicCode}>
        <td data-label="Date et numéro"><time dateTime={row.createdAt}>{date(row.createdAt)}</time><strong className="team-board-code">{row.publicCode}</strong>{row.urgent && <span className="team-board-urgent">Prioritaire</span>}</td>
        <td data-label="Problème"><strong>{row.subject}</strong><p>{row.problem || 'Lire les précisions dans le dossier.'}</p><span className="team-board-person">{row.person}</span></td>
        <td data-label="Service et suivi"><strong>{row.service ? BOARD_SERVICES[row.service] : 'Service à attribuer'}</strong><span className="team-board-status" data-waiting={row.status === 'attente_demandeur'}>{BOARD_STATUSES[row.status]}</span></td>
        <td data-label="Quoi faire"><p className="team-board-action">{row.action}</p><small>{row.instruction ? `Consigne de l’équipe · ${date(row.instructionAt!)}` : 'Démarche proposée · à adapter au dossier'}</small>
          {editing === row.publicCode && <form className="team-board-note team-board-screen-only" onSubmit={event => { event.preventDefault(); void save(row); }}><label htmlFor={`note-${row.publicCode}`}>Consigne pour l’équipe</label><textarea autoFocus id={`note-${row.publicCode}`} maxLength={1000} rows={4} value={drafts[row.publicCode] || ''} onChange={event => setDrafts(current => ({ ...current, [row.publicCode]: event.target.value }))} placeholder="Exemple : vérifier les pièces puis rappeler la famille." /><small>Note interne, sans mot de passe ni code. Aucun message envoyé au demandeur.</small><div><button type="submit" disabled={Boolean(saving) || !(drafts[row.publicCode] || '').trim()}>{saving === row.publicCode ? 'Enregistrement…' : 'Enregistrer la consigne'}</button><button type="button" disabled={Boolean(saving)} onClick={() => setEditing(null)} aria-label="Fermer la consigne"><X size={16} aria-hidden="true" /></button></div></form>}
        </td>
        <td className="team-board-screen-only team-board-row-tools"><button type="button" disabled={Boolean(saving)} onClick={() => { setEditing(row.publicCode); setDrafts(current => ({ ...current, [row.publicCode]: current[row.publicCode] ?? row.instruction ?? '' })); }}><PencilLine size={16} aria-hidden="true" />Consigne</button><Link to={`/gestion/demandes?dossier=${row.publicCode}${row.service ? `&service=${row.service}` : ''}${equipment ? '&scope=equipment' : ''}`}>Ouvrir le dossier<ArrowRight size={16} aria-hidden="true" /></Link></td>
      </tr>)}</tbody></table></div>}
      <footer className="team-board-footer"><p>Une consigne partagée guide le travail. La réponse et la clôture restent enregistrées dans le dossier.</p><nav aria-label="Pages du tableau"><button type="button" disabled={page <= 1} onClick={() => filter('page', String(page - 1))}>Précédent</button><span>Page {payload.pagination.page} / {payload.pagination.totalPages}</span><button type="button" disabled={page >= payload.pagination.totalPages} onClick={() => filter('page', String(page + 1))}>Suivant</button></nav></footer>
      <p className="team-board-sharing-hint">Le lien conserve le service et le suivi. La connexion personnelle reste nécessaire. Le PDF contient uniquement la page affichée, sans coordonnées ni codes d’accès.</p>
    </>}
    <Link className="team-board-back" to={equipment ? '/gestion/materiel' : '/gestion/demandes'}>{equipment ? 'Coordination Matériel & SPIE' : 'Console complète des demandes'}<ArrowRight size={16} aria-hidden="true" /></Link>
  </section>;
}
