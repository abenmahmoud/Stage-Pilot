import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { SECOND_YEAR_PARENTS_MEETING, showParentsMeeting } from "../../shared/school-public-information";

export function SchoolParentsMeeting() {
  const [visible, setVisible] = useState(() => showParentsMeeting(new Date()));

  useEffect(() => {
    const refresh = () => setVisible(showParentsMeeting(new Date()));
    // Also refresh a tab left open across the event's expiration.
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (!visible) return null;
  const meeting = SECOND_YEAR_PARENTS_MEETING;
  return (
    <section className="lycee-parents-meeting" aria-label={meeting.title}>
      <CalendarDays aria-hidden="true" />
      <div>
        <span className="lycee-eyebrow">À noter · Parents de seconde</span>
        <h2>{meeting.title}</h2>
        <p><time dateTime={meeting.date}>{meeting.dateLabel}</time> · {meeting.location}</p>
        <p>{meeting.description}</p>
        <strong>{meeting.timeNotice}</strong>
      </div>
    </section>
  );
}
