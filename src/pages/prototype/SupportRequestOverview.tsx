import { useState } from "react";
import { ArrowRight, CircleAlert, MessageCircleMore } from "lucide-react";
import { supportRequestFocus, type SupportWorkSection } from "../../../shared/support-request-focus";

type Props = {
  message: string;
  messageDate: string | null;
  service: string;
  beneficiary: string | null;
  statusLabel: string;
  routingPending: boolean;
  focus: Parameters<typeof supportRequestFocus>[0];
  onOpen: (section: SupportWorkSection) => void;
};

export function SupportRequestOverview({ message, messageDate, service, beneficiary, statusLabel, routingPending, focus, onOpen }: Props) {
  const [expanded, setExpanded] = useState(false);
  const action = supportRequestFocus(focus);
  const shortened = message.length > 480 && !expanded;
  return <section className="lycee-agent-focus" aria-label="L’essentiel de la demande">
    <div className="lycee-agent-focus-meta"><span>{service}</span><span>{statusLabel}</span>{beneficiary ? <span>Pour {beneficiary}</span> : null}</div>
    <div className="lycee-agent-focus-message">
      <div><MessageCircleMore aria-hidden="true" /><strong>{messageDate ? "Dernier message du demandeur" : "Besoin transmis"}</strong>{messageDate ? <small>{messageDate}</small> : null}</div>
      <p dir="auto">{shortened ? `${message.slice(0, 480)}…` : message || "Aucun texte transmis."}</p>
      {message.length > 480 ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Réduire le message" : "Lire le message entier"}</button> : null}
      <button type="button" onClick={() => onOpen("history")}>Relire les échanges et les réponses</button>
    </div>
    <div className="lycee-agent-focus-next" data-attention={focus.needsIdentity || focus.duplicatePending}>
      <div><strong>{action.title}</strong><p>{action.detail}</p></div>
      <button type="button" onClick={() => onOpen(action.section)}>{action.label}<ArrowRight aria-hidden="true" /></button>
    </div>
    {routingPending ? <button className="lycee-agent-focus-review" type="button" onClick={() => onOpen("management")}><CircleAlert aria-hidden="true" /> Classement proposé à confirmer</button> : null}
  </section>;
}
