/// <reference types="vite/client" />

import "./style.css";
import {
  cardTemplates,
  collectTags,
  completionScore,
  createCardFromTemplate,
  createCard,
  exportCardsAsMarkdown,
  filterCards,
  summarizeBoard,
  updateCard,
  type CardStatus,
  type EditorCard
} from "./domain.js";

interface EditorState {
  cards: EditorCard[];
  selectedId: string;
  query: string;
  tag: string;
  status: CardStatus | "all";
}

const state: EditorState = {
  cards: [
    createCard({
      id: "card-brief",
      title: "Harness target brief",
      body: "This card editor is isolated from the Harness control plane. Agent tasks should modify this target project.",
      tags: ["agent", "target"],
      status: "published",
      updatedAt: "2026-05-23T01:00:00.000Z"
    }),
    createCard({
      id: "card-workflow",
      title: "Workflow detail idea",
      body: "Add richer run detail views, timeline grouping, and test evidence previews.",
      tags: ["workflow", "ux"],
      status: "review",
      updatedAt: "2026-05-23T00:30:00.000Z"
    }),
    createCard({
      id: "card-polish",
      title: "Polish backlog",
      body: "Improve keyboard flow and status summaries for repeated editing sessions.",
      tags: ["polish"],
      status: "draft",
      updatedAt: "2026-05-22T23:40:00.000Z"
    })
  ],
  selectedId: "card-brief",
  query: "",
  tag: "all",
  status: "all"
};

function selectedCard(): EditorCard {
  return state.cards.find((card) => card.id === state.selectedId) ?? state.cards[0];
}

function setSelected(id: string): void {
  state.selectedId = id;
  render();
}

function patchSelected(patch: Partial<Omit<EditorCard, "id">>): void {
  state.cards = state.cards.map((card) => (card.id === state.selectedId ? updateCard(card, patch) : card));
  render();
}

function addCard(): void {
  const id = `card-${Date.now().toString(36)}`;
  const card = createCard({
    id,
    title: "Untitled card",
    body: "",
    tags: ["new"],
    updatedAt: new Date().toISOString()
  });
  state.cards = [card, ...state.cards];
  state.selectedId = id;
  render();
}

function addFromTemplate(templateId: string): void {
  const template = cardTemplates.find((item) => item.id === templateId);
  if (!template) {
    return;
  }
  const id = `card-${Date.now().toString(36)}`;
  const card = createCardFromTemplate(template, id);
  state.cards = [card, ...state.cards];
  state.selectedId = id;
  render();
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render(): void {
  const app = byId<HTMLElement>("app");
  const tags = collectTags(state.cards);
  const visible = filterCards(state.cards, {
    query: state.query,
    tag: state.tag,
    status: state.status
  });
  const card = selectedCard();
  const score = completionScore(state.cards);
  const summary = summarizeBoard(state.cards);
  const markdownExport = exportCardsAsMarkdown(visible);

  app.innerHTML = `
    <section class="shell">
      <aside class="panel sidebar">
        <div class="brand">
          <div>
            <h1>Card Editor</h1>
            <p>Isolated target project for Harness-driven Agent work.</p>
          </div>
          <button id="add-card" class="icon-button" title="New card">+</button>
        </div>

        <div class="toolbar">
          <input id="query" value="${escapeHtml(state.query)}" placeholder="Search cards" />
          <select id="tag-filter">
            <option value="all">All tags</option>
            ${tags.map((tag) => `<option value="${tag}" ${state.tag === tag ? "selected" : ""}>${tag}</option>`).join("")}
          </select>
          <select id="status-filter">
            ${["all", "draft", "review", "published"]
              .map((status) => `<option value="${status}" ${state.status === status ? "selected" : ""}>${status}</option>`)
              .join("")}
          </select>
        </div>

        <div class="metric-strip">
          <div><span>Cards</span><strong>${state.cards.length}</strong></div>
          <div><span>Completion</span><strong>${score}</strong></div>
        </div>

        <section class="template-panel">
          <h2>Templates</h2>
          <div class="template-grid">
            ${cardTemplates
              .map((template) => `<button class="template-button" data-template-id="${template.id}">${template.name}</button>`)
              .join("")}
          </div>
        </section>

        <div class="card-list">
          ${
            visible.length
              ? visible
                  .map(
                    (item) => `
                    <button class="card-row ${item.id === state.selectedId ? "selected" : ""}" data-card-id="${item.id}">
                      <span>${escapeHtml(item.title)}</span>
                      <small>${item.status} · ${item.tags.join(", ") || "untagged"}</small>
                    </button>
                  `
                  )
                  .join("")
              : `<div class="empty">No matching cards.</div>`
          }
        </div>
      </aside>

      <section class="panel editor">
        <div class="editor-head">
          <div>
            <span class="eyebrow">Target app</span>
            <h2>${escapeHtml(card.title)}</h2>
          </div>
          <span class="status ${card.status}">${card.status}</span>
        </div>

        <label>
          Title
          <input id="title-input" value="${escapeHtml(card.title)}" />
        </label>

        <label>
          Body
          <textarea id="body-input" rows="12">${escapeHtml(card.body)}</textarea>
        </label>

        <div class="field-grid">
          <label>
            Tags
            <input id="tags-input" value="${escapeHtml(card.tags.join(", "))}" />
          </label>
          <label>
            Status
            <select id="status-input">
              ${["draft", "review", "published"]
                .map((status) => `<option value="${status}" ${card.status === status ? "selected" : ""}>${status}</option>`)
                .join("")}
            </select>
          </label>
        </div>

        <section class="preview">
          <h3>Live Preview</h3>
          <article>
            <h4>${escapeHtml(card.title)}</h4>
            <p>${escapeHtml(card.body || "Start typing to build this card.")}</p>
            <div class="tag-row">${card.tags.map((tag) => `<span>${tag}</span>`).join("") || "<span>untagged</span>"}</div>
          </article>
        </section>

        <section class="board-summary">
          <h3>Board Summary</h3>
          <div class="summary-grid">
            <div><span>Draft</span><strong>${summary.byStatus.draft}</strong></div>
            <div><span>Review</span><strong>${summary.byStatus.review}</strong></div>
            <div><span>Published</span><strong>${summary.byStatus.published}</strong></div>
            <div><span>Tags</span><strong>${summary.tags.length}</strong></div>
          </div>
        </section>

        <section class="export-panel">
          <div class="export-head">
            <h3>Markdown Export</h3>
            <span>${visible.length} cards</span>
          </div>
          <textarea readonly rows="10">${escapeHtml(markdownExport)}</textarea>
        </section>
      </section>
    </section>
  `;

  byId<HTMLButtonElement>("add-card").addEventListener("click", addCard);
  byId<HTMLInputElement>("query").addEventListener("input", (event) => {
    state.query = (event.target as HTMLInputElement).value;
    render();
  });
  byId<HTMLSelectElement>("tag-filter").addEventListener("change", (event) => {
    state.tag = (event.target as HTMLSelectElement).value;
    render();
  });
  byId<HTMLSelectElement>("status-filter").addEventListener("change", (event) => {
    state.status = (event.target as HTMLSelectElement).value as CardStatus | "all";
    render();
  });
  byId<HTMLInputElement>("title-input").addEventListener("input", (event) => {
    patchSelected({ title: (event.target as HTMLInputElement).value });
  });
  byId<HTMLTextAreaElement>("body-input").addEventListener("input", (event) => {
    patchSelected({ body: (event.target as HTMLTextAreaElement).value });
  });
  byId<HTMLInputElement>("tags-input").addEventListener("input", (event) => {
    patchSelected({ tags: (event.target as HTMLInputElement).value.split(",") });
  });
  byId<HTMLSelectElement>("status-input").addEventListener("change", (event) => {
    patchSelected({ status: (event.target as HTMLSelectElement).value as CardStatus });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.cardId) {
        setSelected(button.dataset.cardId);
      }
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-template-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.templateId) {
        addFromTemplate(button.dataset.templateId);
      }
    });
  });
}

render();
