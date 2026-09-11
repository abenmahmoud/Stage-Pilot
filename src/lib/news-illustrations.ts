type NewsTopic = { title: string; slug?: string; summary?: string; category?: string };

const illustrations = {
  planning: { alt: "Agenda et cahier sur une table de travail", file: "planning" },
  ordinateurs: { alt: "Ordinateur portable et sa housse", file: "ordinateurs" },
  parents: { alt: "Table préparée pour une rencontre au lycée", file: "parents" },
  sport: { alt: "Ballons et matériel de sport dans un gymnase", file: "sport" },
  orientation: { alt: "Livres et cahier pour préparer son parcours scolaire", file: "orientation" },
  elections: { alt: "Urne et bulletins de vote", file: "elections" },
};

// A curated, local collection keeps future weekly articles illustrated without
// sending their content to an image service. An editor's own cover takes priority.
export function newsIllustration(topic: NewsTopic) {
  const text = `${topic.title} ${topic.slug ?? ""} ${topic.category ?? ""}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let key: keyof typeof illustrations | null = null;
  if (/election|delegue|\bcvl\b|scrutin|vote/.test(text)) key = "elections";
  else if (/sport|gymnase|\bunss\b|tournoi/.test(text)) key = "sport";
  else if (/chromebook|ordinateur|numerique|connexion|\bent\b|\bkoxo\b/.test(text)) key = "ordinateurs";
  else if (/emploi.*temps|\bedt\b|planning|horaire|calendrier/.test(text)) key = "planning";
  else if (/parent|famille|rencontre|reunion/.test(text)) key = "parents";
  else if (/specialite|orientation|parcours|test|positionnement|examen|formation|\bbac\b/.test(text)) key = "orientation";

  if (!key) return {
    key: "lycee", src: "/lycee-blaise-hero.webp", thumbnail: "/lycee-blaise-hero.webp",
    alt: "Façade du lycée Blaise Cendrars à Sevran", illustrative: false,
  };
  const picture = illustrations[key];
  return {
    key, src: `/news/${picture.file}.webp`, thumbnail: `/news/${picture.file}-small.webp`,
    alt: `${picture.alt} — illustration`, illustrative: true,
  };
}
