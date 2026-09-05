import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import { PublicContentMarkdown } from "./PublicContentMarkdown";
import { readFlashPublicFeedPayload, type FlashPublicItem } from "../pages/prototype/flash-public-client";

/**
 * LOT 2 du plan de visibilité publique
 * (docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md) : bandeau sobre des
 * informations flash publiques. Rien ne s'affiche s'il n'y a rien — jamais
 * de bloc vide ni de faux contenu pendant le chargement.
 */
export function FlashPublicBulletin() {
  const [items, setItems] = useState<FlashPublicItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/content/flash/public", { signal: controller.signal })
      .then(readFlashPublicFeedPayload)
      .then((payload) => {
        if (!controller.signal.aborted) setItems(payload.items);
      })
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setItems([]);
      });
    return () => controller.abort();
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="lycee-flash-bulletin" aria-label="Informations flash du lycée">
      <ul>
        {items.map((item) => (
          <li key={item.id} data-importance={item.importance}>
            <CircleAlert aria-hidden="true" />
            <div>
              <strong>{item.title}</strong>
              <div className="lycee-flash-bulletin-body">
                <PublicContentMarkdown>{item.bodyMarkdown}</PublicContentMarkdown>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
