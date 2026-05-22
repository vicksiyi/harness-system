/// <reference types="vite/client" />

import "./style.css";
import type { ServiceHealth, WorkflowRun, WorkflowType } from "@harness/shared";

const orchestratorUrl = import.meta.env.VITE_ORCHESTRATOR_URL ?? "http://localhost:4100";

interface ServiceHealthEntry {
  name: string;
  url: string;
  health: ServiceHealth;
}

interface AppState {
  runs: WorkflowRun[];
  selectedRun?: WorkflowRun;
  health: ServiceHealthEntry[];
  busy: boolean;
  error?: string;
  prompt: string;
  type: WorkflowType;
}

const state: AppState = {
  runs: [],
  health: [],
  busy: false,
  prompt: "增加一个工作流运行详情页",
  type: "requirement"
};

async function rpc<TResult>(method: string, params?: unknown): Promise<TResult> {
  const response = await fetch(`${orchestratorUrl}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: `web_${Date.now()}`, method, params })
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? `RPC ${method} failed`);
  }
  return body.result as TResult;
}

function statusClass(status: string): string {
  if (status === "passed" || status === "ok" || status === "healthy") return "good";
  if (status === "running" || status === "queued" || status === "degraded") return "active";
  return "bad";
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

async function refresh(): Promise<void> {
  try {
    const [runs, health] = await Promise.all([
      rpc<WorkflowRun[]>("listWorkflows"),
      rpc<ServiceHealthEntry[]>("serviceHealth")
    ]);
    state.runs = runs;
    state.health = health;
    if (state.selectedRun) {
      state.selectedRun = (await rpc<WorkflowRun | null>("getWorkflow", { runId: state.selectedRun.id })) ?? state.selectedRun;
    } else {
      state.selectedRun = runs[0];
    }
    state.error = undefined;
  } catch (error) {
    state.error = error instanceof Error ? error.message : "Unable to refresh console data.";
  }
  render();
}

async function startWorkflow(type: WorkflowType, prompt: string): Promise<void> {
  state.busy = true;
  state.error = undefined;
  render();
  try {
    const run = await rpc<WorkflowRun>("runWorkflow", { type, prompt, requestedBy: "web-console" });
    state.selectedRun = run;
    await refresh();
  } catch (error) {
    state.error = error instanceof Error ? error.message : "Workflow execution failed.";
  } finally {
    state.busy = false;
    render();
  }
}

function runList(runs: WorkflowRun[]): string {
  if (runs.length === 0) {
    return `<div class="empty">No workflow runs yet.</div>`;
  }

  return runs
    .map(
      (run) => `
        <button class="run-row ${state.selectedRun?.id === run.id ? "selected" : ""}" data-run-id="${run.id}">
          <span class="run-title">${escapeHtml(run.title)}</span>
          <span class="meta">${run.type}</span>
          <span class="pill ${statusClass(run.status)}">${run.status}</span>
          <span class="meta">${new Date(run.updatedAt).toLocaleTimeString()}</span>
        </button>
      `
    )
    .join("");
}

function healthGrid(entries: ServiceHealthEntry[]): string {
  if (entries.length === 0) {
    return `<div class="empty">Health unavailable.</div>`;
  }

  return entries
    .map(
      (entry) => `
        <div class="health-row">
          <span>${entry.name}</span>
          <span class="pill ${statusClass(entry.health.status)}">${entry.health.status}</span>
          <span class="meta">${entry.url}</span>
        </div>
      `
    )
    .join("");
}

function runDetail(run?: WorkflowRun): string {
  if (!run) {
    return `<section class="surface detail"><div class="empty">Select or start a workflow.</div></section>`;
  }

  const events = run.events
    .slice()
    .reverse()
    .map(
      (event) => `
        <li>
          <span class="dot ${event.level}"></span>
          <div>
            <div class="timeline-title">${escapeHtml(event.message)}</div>
            <div class="meta">${event.stage} · ${new Date(event.at).toLocaleString()}</div>
          </div>
        </li>
      `
    )
    .join("");

  const logs = run.logs
    .slice(-20)
    .map(
      (log) => `
        <div class="log-line ${log.level}">
          <span>${new Date(log.at).toLocaleTimeString()}</span>
          <strong>${log.service}</strong>
          <code>${escapeHtml(log.message)}</code>
        </div>
      `
    )
    .join("");

  const criteria = run.analysis?.acceptanceCriteria
    .map((criterion) => `<li>${escapeHtml(criterion.statement)} <span class="meta">${escapeHtml(criterion.verification)}</span></li>`)
    .join("");

  const failures = run.tests?.failures
    .map((failure) => `<li><strong>${escapeHtml(failure.reason)}</strong>: ${escapeHtml(failure.suggestedFix)}</li>`)
    .join("");

  return `
    <section class="surface detail">
      <div class="detail-head">
        <div>
          <h2>${escapeHtml(run.title)}</h2>
          <p class="meta">${run.id} · ${run.type} · ${new Date(run.createdAt).toLocaleString()}</p>
        </div>
        <div class="stage-stack">
          <span class="pill ${statusClass(run.status)}">${run.status}</span>
          <span class="pill active">${run.stage}</span>
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric"><span>Attempts</span><strong>${run.attempts}/${run.maxAttempts}</strong></div>
        <div class="metric"><span>Test Score</span><strong>${run.tests?.score ?? "n/a"}</strong></div>
        <div class="metric"><span>Deploy</span><strong>${run.deployment?.status ?? "pending"}</strong></div>
        <div class="metric"><span>Events</span><strong>${run.events.length}</strong></div>
      </div>

      <div class="two-col">
        <section>
          <h3>Event Timeline</h3>
          <ul class="timeline">${events}</ul>
        </section>
        <section>
          <h3>Log Stream</h3>
          <div class="logs">${logs || `<div class="empty">No logs.</div>`}</div>
        </section>
      </div>

      <div class="two-col">
        <section>
          <h3>Test Result</h3>
          <div class="result ${run.tests?.passed ? "good-border" : "warn-border"}">
            <div>${run.tests ? (run.tests.passed ? "Passed" : "Needs fix") : "Not run"}</div>
            <code>${escapeHtml(run.tests?.command ?? "pending")}</code>
            <ul>${failures || "<li>No failures recorded.</li>"}</ul>
          </div>
        </section>
        <section>
          <h3>Deployment</h3>
          <div class="result ${run.deployment?.status === "healthy" ? "good-border" : "warn-border"}">
            <div>${run.deployment?.target ?? "pending"}</div>
            <ul>
              ${
                run.deployment?.healthChecks
                  .map((check) => `<li>${check.ok ? "OK" : "FAIL"} ${escapeHtml(check.name)} · ${escapeHtml(check.detail)}</li>`)
                  .join("") ?? "<li>No deployment check yet.</li>"
              }
            </ul>
          </div>
        </section>
      </div>

      <section>
        <h3>Acceptance</h3>
        <ul class="acceptance">${criteria || "<li>Analysis pending.</li>"}</ul>
      </section>

      <section>
        <h3>Recent Agent Record</h3>
        <pre>${escapeHtml(JSON.stringify({ stage: run.stage, blocker: run.blocker, updatedAt: run.updatedAt }, null, 2))}</pre>
      </section>

      <section>
        <h3>MR Summary Preview</h3>
        <pre>${escapeHtml(run.mrSummary ?? "MR summary pending.")}</pre>
      </section>
    </section>
  `;
}

function render(): void {
  const app = byId<HTMLElement>("app");
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <h1>Harness Console</h1>
          <span class="meta">Codex workflow control plane</span>
        </div>

        <section class="surface compact">
          <h2>New Run</h2>
          <div class="segmented" role="tablist">
            ${(["requirement", "bugfix", "polish"] as WorkflowType[])
              .map((type) => `<button class="${state.type === type ? "selected" : ""}" data-type="${type}">${type}</button>`)
              .join("")}
          </div>
          <textarea id="prompt-input" rows="4">${escapeHtml(state.prompt)}</textarea>
          <button id="start-run" class="primary" ${state.busy ? "disabled" : ""}>${state.busy ? "Running..." : "Start Workflow"}</button>
          ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ""}
        </section>

        <section class="surface compact">
          <div class="section-head">
            <h2>Workflow List</h2>
            <button id="refresh" class="ghost">Refresh</button>
          </div>
          <div class="run-list">${runList(state.runs)}</div>
        </section>

        <section class="surface compact">
          <h2>Service Health</h2>
          <div class="health-grid">${healthGrid(state.health)}</div>
        </section>
      </aside>

      ${runDetail(state.selectedRun)}
    </div>
  `;

  byId<HTMLTextAreaElement>("prompt-input").addEventListener("input", (event) => {
    state.prompt = (event.target as HTMLTextAreaElement).value;
  });

  byId<HTMLButtonElement>("start-run").addEventListener("click", () => {
    void startWorkflow(state.type, state.prompt);
  });

  byId<HTMLButtonElement>("refresh").addEventListener("click", () => {
    void refresh();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.type = button.dataset.type as WorkflowType;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-run-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const runId = button.dataset.runId;
      if (!runId) return;
      state.selectedRun = (await rpc<WorkflowRun | null>("getWorkflow", { runId })) ?? undefined;
      render();
    });
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
void refresh();
setInterval(() => {
  void refresh();
}, 8000);
