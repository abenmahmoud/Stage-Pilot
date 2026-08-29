type KnowledgeDocumentListMetadata = {
  classification: string;
  title: string;
  purposeDescription: string;
  originalName: string;
};

const MASKED_LABELS: Record<string, string> = {
  personal: "Document personnel",
  sensitive: "Document sensible",
};

export function maskKnowledgeDocumentListMetadata<T extends KnowledgeDocumentListMetadata>(
  document: T
): T {
  const label = MASKED_LABELS[document.classification];
  if (!label) return document;
  return {
    ...document,
    title: label,
    originalName: "Nom du fichier masqué",
    purposeDescription:
      "Détails masqués dans la liste. L’ouverture privée est tracée et réservée aux personnes habilitées.",
  };
}
