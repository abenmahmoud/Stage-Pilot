import { useState } from 'react';
import { ArrowRight, BadgeCheck, FileText, MessageCircleMore, RefreshCw, UserRound } from 'lucide-react';
import { PERSONAL_HOME_STATUS_LABELS } from '../../../shared/personal-home';
import { usePersonalHome } from '../../lib/personal-home-client';
import ScheduleChatCard from './ScheduleChatCard';
import PersonalNews from './PersonalNews';
import '../../styles/personal-home.css';

const time = (value: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export default function PersonalHome({ onIdentity, onHelp, onRequests }: { onIdentity: () => void; onHelp: (prompt?: string) => void; onRequests: (code?: string) => void }) {
  const { data, error, day, selectDay, selectTarget, retry } = usePersonalHome();
  const [expanded, setExpanded] = useState(false);
  if (error) return <section className="school-personal-entry" aria-label="Mon espace personnel"><UserRound aria-hidden="true" /><div><h2>Votre espace est momentanément indisponible</h2><p>Vous pouvez continuer dans le chat ou réessayer.</p></div><button type="button" onClick={retry}><RefreshCw aria-hidden="true" />Réessayer</button><button type="button" onClick={() => onHelp()}>Ouvrir le chat</button></section>;
  if (!data) return <section className="school-personal-loading" aria-live="polite" aria-busy="true"><RefreshCw aria-hidden="true" />Ouverture de votre espace…</section>;
  if (data.status === 'unavailable') return <section className="school-personal-entry" aria-labelledby="personal-entry-title"><UserRound aria-hidden="true" /><div><h2 id="personal-entry-title">Votre quotidien, au même endroit</h2><p>Identifiez-vous dans le chat pour retrouver les services disponibles pour vous.</p></div><button type="button" className="school-personal-primary" onClick={onIdentity}>Ouvrir mon espace<ArrowRight aria-hidden="true" /></button></section>;
  const schedule = data.schedule;
  const courseList = schedule.status === 'ready' ? schedule.value.courses : [];
  const upcoming = day === 'today' ? courseList.filter(course => Date.parse(course.endsAt) > Date.now()) : courseList;
  const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${data.date}T12:00:00Z`));
  const profile = { student: 'Élève', guardian: 'Parent ou responsable', staff: 'Personnel du lycée' }[data.personType];
  return <section className="school-personal" aria-labelledby="personal-home-title">
    <header className="school-personal-heading"><div><h2 id="personal-home-title">Pour moi, aujourd’hui</h2><p>Votre espace personnel · {profile}</p></div><div className="school-personal-access"><span><BadgeCheck aria-hidden="true" />Identité confirmée</span><button type="button" onClick={onIdentity}>Gérer mon accès</button></div></header>
    <div className="school-personal-panels">
      <section className="school-personal-schedule" aria-labelledby="personal-schedule-title">
        <h3 id="personal-schedule-title">{data.personType === 'guardian' ? 'L’emploi du temps de mon enfant' : 'Mon emploi du temps'}</h3>
        {data.targets.length > 1 ? <label className="school-personal-target">Choisir un enfant<select value={data.selectedTarget ?? ''} onChange={event => { setExpanded(false); selectTarget(event.target.value); }}>{data.targets.map(target => <option key={target.key} value={target.key}>{target.label}</option>)}</select></label> : data.targets[0] && data.targets[0].label !== 'Mon emploi du temps' ? <p className="school-personal-target-label">{data.targets[0].label}</p> : null}
        <div className="school-personal-days" aria-label="Journée à consulter"><button type="button" aria-pressed={day === 'today'} onClick={() => { setExpanded(false); selectDay('today'); }}>Aujourd’hui</button><button type="button" aria-pressed={day === 'tomorrow'} onClick={() => { setExpanded(false); selectDay('tomorrow'); }}>Demain</button></div>
        <p className="school-personal-date">{date}</p>
        {schedule.status === 'ready' ? <>
          {expanded ? <ScheduleChatCard value={schedule.value} /> : <>
            <ol className="school-personal-courses">{upcoming.slice(0, 2).map((course, index) => <li key={`${course.startsAt}-${index}`} data-cancelled={course.state === 'cancelled'}><span>{time(course.startsAt)} – {time(course.endsAt)}</span><div><strong>{course.subjectLabel}</strong><small>{course.state === 'cancelled' ? 'Cours annulé' : `${course.roomCode ? `Salle ${course.roomCode}` : 'Salle à confirmer'}${course.state === 'moved' ? ' · Modifié' : ''}`}</small></div></li>)}</ol>
            {!upcoming.length && <p className="school-personal-empty">{schedule.value.incompleteGroups ? 'Aucun autre cours confirmé dans les données disponibles.' : courseList.length ? 'Vos cours affichés pour cette journée sont terminés.' : 'Aucun cours prévu dans l’emploi du temps disponible pour cette journée.'}</p>}
            {schedule.value.incompleteGroups && <p className="school-personal-note">Certains cours de groupe peuvent manquer : votre appartenance doit être confirmée par le lycée.</p>}
          </>}
          <footer className="school-personal-schedule-footer"><button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? 'Réduire la journée' : 'Voir toute la journée'}<ArrowRight aria-hidden="true" /></button><small>Source validée par le lycée</small></footer>
        </> : <div className="school-personal-empty"><p>{schedule.message}</p><button type="button" onClick={() => onHelp(data.personType === 'guardian' ? 'Je souhaite faire vérifier le lien avec mon enfant et son emploi du temps.' : `Je souhaite faire vérifier mon emploi du temps ${day === 'tomorrow' ? 'de demain' : 'du jour'}.`)}>Demander de l’aide<ArrowRight aria-hidden="true" /></button></div>}
      </section>
      <section className="school-personal-requests" aria-labelledby="personal-requests-title"><h3 id="personal-requests-title">Mes demandes</h3>
        {data.requests.items.map(request => <article key={request.publicCode} className="school-personal-request"><FileText aria-hidden="true" /><div><h4>{request.subject}</h4><p>{PERSONAL_HOME_STATUS_LABELS[request.status]}</p>{request.hasDocument && <small>Un document à consulter</small>}<button type="button" onClick={() => onRequests(request.publicCode)}>Ouvrir le suivi<ArrowRight aria-hidden="true" /></button></div></article>)}
        {!data.requests.items.length && <p className="school-personal-empty">{data.requests.status === 'unavailable' ? 'L’aperçu de vos demandes ne peut pas être chargé pour le moment.' : 'Aucune demande liée à votre identité n’est à afficher ici. Vos demandes déjà envoyées restent accessibles dans le suivi.'}</p>}
        <button type="button" className="school-personal-all-requests" onClick={() => onRequests()}>{data.requests.items.length ? 'Toutes mes demandes' : 'Retrouver mes demandes'}<ArrowRight aria-hidden="true" /></button>
      </section>
    </div>
    {data.news && <PersonalNews feed={data.news} />}
    <div className="school-personal-chat"><MessageCircleMore aria-hidden="true" /><div><strong>Une question ? Continuons dans le chat.</strong><p>Blaise vous accompagne dans vos démarches.</p></div><button className="school-personal-primary" type="button" onClick={() => onHelp()}>Parler à Blaise</button></div>
  </section>;
}
