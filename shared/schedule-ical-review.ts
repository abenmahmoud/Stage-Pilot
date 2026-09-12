import type { IcalCalendarSummary, IcalDecision, IcalReview } from './schedule-ical-contract.js';

export type IcalReviewFilter = 'pending' | 'unmatched' | 'empty' | 'applied' | 'all';
export type IcalDrafts = Record<string, IcalDecision>;

const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr-FR').trim();
export const isUndecided = (calendar: IcalCalendarSummary) => calendar.status === 'pending' || calendar.status === 'failed';

export function filterIcalCalendars(calendars: IcalCalendarSummary[], filter: IcalReviewFilter, query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return calendars.filter(c => {
    const matches = filter === 'all'
      || (filter === 'pending' && isUndecided(c))
      || (filter === 'unmatched' && isUndecided(c) && ['not_found', 'ambiguous'].includes(c.matchStatus))
      || (filter === 'empty' && isUndecided(c) && c.matchStatus === 'empty' && c.courseCount === 0)
      || (filter === 'applied' && c.status === 'applied');
    const text = normalize(`${c.label} ${c.subjectRef ?? ''} ${c.suggestedRef ?? ''}`);
    return matches && words.every(word => text.includes(word));
  });
}

// Only stage a proposal. Existing human choices and locked calendars are untouched.
export function prepareIcalDrafts(review: IcalReview, current: IcalDrafts, kind: 'exact' | 'empty'): IcalDrafts {
  if (review.sourceStatus !== 'review') return current;
  const next = { ...current };
  for (const c of review.calendars) {
    if (c.status !== 'pending' || current[c.id]) continue;
    if (kind === 'exact' && c.matchStatus === 'exact' && c.suggestedRef && c.courseCount > 0) {
      next[c.id] = { id: c.id, decision: 'include', subjectRef: c.suggestedRef };
    } else if (kind === 'empty' && c.matchStatus === 'empty' && c.courseCount === 0) {
      next[c.id] = { id: c.id, decision: 'exclude', subjectRef: null };
    }
  }
  return next;
}
