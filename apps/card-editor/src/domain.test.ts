import { describe, expect, it } from "vitest";
import {
  cardTemplates,
  collectTags,
  completionScore,
  createCard,
  createCardFromTemplate,
  exportCardsAsMarkdown,
  filterCards,
  summarizeBoard,
  updateCard
} from "./domain.js";

describe("card editor domain", () => {
  it("normalizes card titles and tags", () => {
    const card = createCard({
      id: "card-1",
      title: "  Launch   Notes  ",
      tags: [" Workflow ", "workflow", "Polish"]
    });

    expect(card.title).toBe("Launch Notes");
    expect(card.tags).toEqual(["polish", "workflow"]);
    expect(card.status).toBe("draft");
  });

  it("updates cards without mutating id", () => {
    const card = createCard({ id: "card-1", title: "Draft", updatedAt: "2026-01-01T00:00:00.000Z" });
    const updated = updateCard(card, {
      title: "Published",
      status: "published",
      tags: ["Release"],
      updatedAt: "2026-01-02T00:00:00.000Z"
    });

    expect(updated.id).toBe("card-1");
    expect(updated.title).toBe("Published");
    expect(updated.status).toBe("published");
    expect(updated.tags).toEqual(["release"]);
  });

  it("filters cards by query, tag, and status", () => {
    const cards = [
      createCard({ id: "1", title: "Workflow Map", body: "Agent loop", tags: ["agent"], status: "review" }),
      createCard({ id: "2", title: "Design Card", body: "Canvas", tags: ["design"], status: "draft" }),
      createCard({ id: "3", title: "Release Note", body: "Ship", tags: ["agent"], status: "published" })
    ];

    expect(filterCards(cards, { query: "agent", tag: "agent", status: "review" }).map((card) => card.id)).toEqual(["1"]);
  });

  it("collects sorted unique tags", () => {
    const cards = [
      createCard({ id: "1", title: "A", tags: ["z", "a"] }),
      createCard({ id: "2", title: "B", tags: ["a", "m"] })
    ];

    expect(collectTags(cards)).toEqual(["a", "m", "z"]);
  });

  it("scores completion by status", () => {
    const cards = [
      createCard({ id: "1", title: "A", status: "draft" }),
      createCard({ id: "2", title: "B", status: "review" }),
      createCard({ id: "3", title: "C", status: "published" })
    ];

    expect(completionScore(cards)).toBe(63);
  });

  it("creates cards from templates", () => {
    const card = createCardFromTemplate(cardTemplates[0], "template-card", "2026-05-23T00:00:00.000Z");

    expect(card.id).toBe("template-card");
    expect(card.tags).toContain("requirement");
    expect(card.body).toContain("Acceptance criteria");
  });

  it("summarizes board state", () => {
    const cards = [
      createCard({ id: "1", title: "A", status: "draft", tags: ["a"] }),
      createCard({ id: "2", title: "B", status: "review", tags: ["b"] }),
      createCard({ id: "3", title: "C", status: "published", tags: ["a"] })
    ];

    expect(summarizeBoard(cards)).toMatchObject({
      total: 3,
      byStatus: { draft: 1, review: 1, published: 1 },
      tags: ["a", "b"],
      completion: 63
    });
  });

  it("exports cards as markdown with summary", () => {
    const markdown = exportCardsAsMarkdown([
      createCard({
        id: "1",
        title: "Release card",
        body: "Ship it",
        tags: ["release"],
        status: "published",
        updatedAt: "2026-05-23T00:00:00.000Z"
      })
    ]);

    expect(markdown).toContain("# Card Export");
    expect(markdown).toContain("- Published: 1");
    expect(markdown).toContain("## Release card");
    expect(markdown).toContain("Ship it");
  });
});
