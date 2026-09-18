import { usePersonalHome } from '../../lib/personal-home-client';
import ScheduleChatCard from './ScheduleChatCard';

/** Reads only the current OTP-verified person's timetable; no ticket text reaches this endpoint. */
export default function TicketScheduleSelfService() {
  const { data, error, day, selectDay, selectTarget, retry } = usePersonalHome();

  return <section className="lycee-ticket-self-schedule" aria-label="Mon emploi du temps">
    <strong>Mon emploi du temps</strong>
    {error ? <p>La consultation est momentanément indisponible. Vous pouvez réessayer ou préciser le problème dans ce dossier.</p> : null}
    {error ? <button type="button" onClick={retry}>Réessayer</button> : null}
    {!error && !data ? <p aria-live="polite">Recherche de vos cours…</p> : null}
    {data?.status === 'unavailable' ? <p>Votre accès a expiré. Confirmez à nouveau votre identité pour consulter vos cours.</p> : null}
    {data?.status === 'verified' ? <>
      {data.targets.length > 1 ? <label>Choisir un enfant
        <select value={data.selectedTarget ?? ''} onChange={event => selectTarget(event.target.value)}>
          {data.targets.map(target => <option key={target.key} value={target.key}>{target.label}</option>)}
        </select>
      </label> : data.targets[0]?.label ? <small>{data.targets[0].label}</small> : null}
      <div className="lycee-ticket-self-schedule-days" aria-label="Journée à consulter">
        <button type="button" aria-pressed={day === 'today'} onClick={() => selectDay('today')}>Aujourd’hui</button>
        <button type="button" aria-pressed={day === 'tomorrow'} onClick={() => selectDay('tomorrow')}>Demain</button>
      </div>
      {data.schedule.status === 'ready'
        ? <ScheduleChatCard value={data.schedule.value} />
        : <p>{data.schedule.message} Vous pouvez demander une vérification dans ce dossier.</p>}
    </> : null}
  </section>;
}
