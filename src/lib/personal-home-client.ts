import { useEffect, useRef, useState } from 'react';
import { isPersonalHome, type PersonalHome } from '../../shared/personal-home';
import { readJsonApiResponse } from '../../shared/json-api-response';
import { parisToday } from '../../shared/school-calendar';
import { listenForIdentitySessionChanges } from './identity-session-events';

export function usePersonalHome() {
  const [query, setQuery] = useState<{ day: 'today' | 'tomorrow'; target?: string }>({ day: 'today' });
  const [data, setData] = useState<PersonalHome | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [, setClockTick] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const clear = () => { abort.current?.abort(); setData(null); setError(false); };
  useEffect(() => {
    const reset = () => { clear(); setQuery({ day: 'today' }); setAttempt(value => value + 1); };
    const visibility = () => { clear(); if (!document.hidden) setAttempt(value => value + 1); };
    const offline = () => { clear(); setError(true); };
    const unlisten = listenForIdentitySessionChanges(reset);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', clear); window.addEventListener('pageshow', visibility);
    window.addEventListener('offline', offline); window.addEventListener('online', visibility);
    return () => {
      unlisten(); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', clear); window.removeEventListener('pageshow', visibility);
      window.removeEventListener('offline', offline); window.removeEventListener('online', visibility);
    };
  }, []);
  useEffect(() => {
    if (document.hidden) return;
    const controller = new AbortController(); abort.current = controller;
    setData(null); setError(false);
    const timeout = window.setTimeout(() => controller.abort('timeout'), 20_000);
    const search = new URLSearchParams({ day: query.day, ...(query.target ? { target: query.target } : {}) });
    fetch(`/api/identity/device/today?${search}`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(response => readJsonApiResponse<unknown>(response, { maxBytes: 128 * 1024 }))
      .then(value => {
        if (!isPersonalHome(value)) throw new Error('invalid_personal_home');
        if (controller.signal.aborted || document.hidden) return;
        if (value.status === 'verified' && value.schedule.status === 'ready' && Date.parse(value.schedule.validUntil) <= Date.now()) throw new Error('stale_schedule');
        if (value.status === 'verified' && Date.parse(value.expiresAt) <= Date.now()) setData({ status: 'unavailable' });
        else setData(value);
      })
      .catch(() => { if (!controller.signal.aborted || controller.signal.reason === 'timeout') { setData(null); setError(true); } })
      .finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [query, attempt]);
  useEffect(() => {
    if (data?.status !== 'verified') return;
    const expire = window.setTimeout(() => { clear(); setData({ status: 'unavailable' }); }, Math.min(2_147_483_647, Math.max(0, Date.parse(data.expiresAt) - Date.now())));
    const freshness = data.schedule.status === 'ready' ? window.setTimeout(() => { clear(); setAttempt(value => value + 1); }, Math.min(2_147_483_647, Math.max(0, Date.parse(data.schedule.validUntil) - Date.now()))) : null;
    const referenceDay = parisToday();
    const clock = window.setInterval(() => {
      setClockTick(value => value + 1);
      if (parisToday() !== referenceDay) {
        clear(); setAttempt(value => value + 1);
      }
    }, 30_000);
    return () => { window.clearTimeout(expire); if (freshness !== null) window.clearTimeout(freshness); window.clearInterval(clock); };
  }, [data]);
  return { data, error, day: query.day,
    selectDay: (day: 'today' | 'tomorrow') => { clear(); setQuery(current => ({ ...current, day })); },
    selectTarget: (target: string) => { clear(); setQuery(current => ({ ...current, target })); },
    retry: () => { clear(); setAttempt(value => value + 1); },
  };
}
