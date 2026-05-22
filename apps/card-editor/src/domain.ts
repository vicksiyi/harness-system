export type CardStatus = "draft" | "review" | "published";

export interface EditorCard {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: CardStatus;
  updatedAt: string;
}

export interface CardFilter {
  query?: string;
  tag?: string;
  status?: CardStatus | "all";
}

export interface CardTemplate {
  id: string;
  name: string;
  title: string;
  body: string;
  tags: string[];
  status: CardStatus;
}

export interface BoardSummary {
  total: number;
  byStatus: Record<CardStatus, number>;
  tags: string[];
  completion: number;
}

export const cardTemplates: CardTemplate[] = [
  {
    id: "template-requirement",
    name: "Requirement",
    title: "New requirement",
    body: "Context:\n\nAcceptance criteria:\n- \n\nNotes:",
    tags: ["requirement"],
    status: "draft"
  },
  {
    id: "template-bugfix",
    name: "Bugfix",
    title: "Bug report",
    body: "Observed:\n\nExpected:\n\nReproduction:\n\nFix notes:",
    tags: ["bugfix"],
    status: "review"
  },
  {
    id: "template-polish",
    name: "Polish",
    title: "Polish task",
    body: "Current experience:\n\nImprovement:\n\nCheck:",
    tags: ["polish"],
    status: "draft"
  }
];

export function createCard(input: {
  id: string;
  title: string;
  body?: string;
  tags?: string[];
  status?: CardStatus;
  updatedAt?: string;
}): EditorCard {
  return {
    id: input.id,
    title: normalizeTitle(input.title),
    body: input.body?.trim() ?? "",
    tags: normalizeTags(input.tags ?? []),
    status: input.status ?? "draft",
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

export function createCardFromTemplate(template: CardTemplate, id: string, updatedAt = new Date().toISOString()): EditorCard {
  return createCard({
    id,
    title: template.title,
    body: template.body,
    tags: template.tags,
    status: template.status,
    updatedAt
  });
}

export function updateCard(card: EditorCard, patch: Partial<Omit<EditorCard, "id">>): EditorCard {
  return {
    ...card,
    ...patch,
    title: patch.title === undefined ? card.title : normalizeTitle(patch.title),
    body: patch.body === undefined ? card.body : patch.body.trim(),
    tags: patch.tags === undefined ? card.tags : normalizeTags(patch.tags),
    updatedAt: patch.updatedAt ?? new Date().toISOString()
  };
}

export function filterCards(cards: EditorCard[], filter: CardFilter): EditorCard[] {
  const query = filter.query?.trim().toLowerCase();
  return sortCards(
    cards.filter((card) => {
      const matchesQuery = !query || `${card.title} ${card.body} ${card.tags.join(" ")}`.toLowerCase().includes(query);
      const matchesTag = !filter.tag || filter.tag === "all" || card.tags.includes(filter.tag);
      const matchesStatus = !filter.status || filter.status === "all" || card.status === filter.status;
      return matchesQuery && matchesTag && matchesStatus;
    })
  );
}

export function sortCards(cards: EditorCard[]): EditorCard[] {
  return [...cards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
}

export function collectTags(cards: EditorCard[]): string[] {
  return [...new Set(cards.flatMap((card) => card.tags))].sort((a, b) => a.localeCompare(b));
}

export function completionScore(cards: EditorCard[]): number {
  if (cards.length === 0) {
    return 0;
  }
  const weights: Record<CardStatus, number> = {
    draft: 0.25,
    review: 0.65,
    published: 1
  };
  const total = cards.reduce((sum, card) => sum + weights[card.status], 0);
  return Math.round((total / cards.length) * 100);
}

export function summarizeBoard(cards: EditorCard[]): BoardSummary {
  return {
    total: cards.length,
    byStatus: {
      draft: cards.filter((card) => card.status === "draft").length,
      review: cards.filter((card) => card.status === "review").length,
      published: cards.filter((card) => card.status === "published").length
    },
    tags: collectTags(cards),
    completion: completionScore(cards)
  };
}

export function exportCardsAsMarkdown(cards: EditorCard[]): string {
  if (cards.length === 0) {
    return "# Card Export\n\nNo cards to export.\n";
  }

  const summary = summarizeBoard(cards);
  const header = [
    "# Card Export",
    "",
    `- Total cards: ${summary.total}`,
    `- Completion: ${summary.completion}`,
    `- Draft: ${summary.byStatus.draft}`,
    `- Review: ${summary.byStatus.review}`,
    `- Published: ${summary.byStatus.published}`,
    ""
  ];

  const body = sortCards(cards).flatMap((card) => [
    `## ${card.title}`,
    "",
    `- Status: ${card.status}`,
    `- Tags: ${card.tags.join(", ") || "untagged"}`,
    `- Updated: ${card.updatedAt}`,
    "",
    card.body || "_No body yet._",
    ""
  ]);

  return [...header, ...body].join("\n");
}

function normalizeTitle(title: string): string {
  const normalized = title.trim().replace(/\s+/g, " ");
  return normalized || "Untitled card";
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
