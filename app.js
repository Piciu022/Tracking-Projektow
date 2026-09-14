const DATA_URL = "data/activity.json";
const SUMMARIES_URL = "data/summaries.json";

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeDays(iso) {
  if (!iso) return "brak danych o commitach";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "aktywność dzisiaj";
  if (days === 1) return "ostatnia aktywność: wczoraj";
  return `ostatnia aktywność: ${days} dni temu`;
}

function renderCommit(template, commit) {
  const node = template.content.cloneNode(true);
  const li = node.querySelector(".commit-item");
  li.querySelector(".commit-icon").textContent = commit.type_icon;
  const a = li.querySelector(".commit-subject");
  a.textContent = commit.subject;
  a.href = commit.url;
  li.querySelector(".commit-date").textContent = fmtDate(commit.date);
  return li;
}

function renderBranchGroup(groupTemplate, commitTemplate, group) {
  const node = groupTemplate.content.cloneNode(true);
  const li = node.querySelector(".branch-group");
  const toggle = li.querySelector(".branch-toggle");
  const list = li.querySelector(".commit-list");

  li.querySelector(".branch-icon").textContent = group.icon;
  li.querySelector(".branch-label").textContent = group.label;
  li.querySelector(".branch-meta").textContent =
    `${group.commits.length} commit(y) · ${fmtDate(group.merged_at)}`;

  group.commits.forEach((c) => list.appendChild(renderCommit(commitTemplate, c)));

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    list.hidden = expanded;
  });

  return li;
}

function formatPeriod(start, end) {
  if (!start && !end) return "";
  if (start === end || !end) return fmtDate(start);
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

function renderOlderSummary(template, entry) {
  const node = template.content.cloneNode(true);
  const li = node.querySelector(".older-summary-item");
  li.querySelector(".older-summary-period").textContent = formatPeriod(
    entry.period_start,
    entry.period_end
  );
  li.querySelector(".older-summary-text").textContent = entry.summary;
  return li;
}

function renderSummaryBlock(article, olderTemplate, summaryData) {
  const block = article.querySelector(".summary-block");
  if (!summaryData || !summaryData.entries || !summaryData.entries.length) {
    return; // brak podsumowań dla tego projektu - blok zostaje schowany (hidden z HTML)
  }

  const [latest, ...older] = summaryData.entries;
  block.hidden = false;
  block.querySelector(".summary-period").textContent = formatPeriod(
    latest.period_start,
    latest.period_end
  );
  block.querySelector(".summary-text").textContent = latest.summary;

  if (older.length) {
    const olderToggle = block.querySelector(".toggle-older-summaries");
    const olderList = block.querySelector(".older-summaries");
    olderToggle.hidden = false;
    olderToggle.textContent = `Starsze podsumowania (${older.length}) ▾`;
    older.forEach((entry) => olderList.appendChild(renderOlderSummary(olderTemplate, entry)));

    olderToggle.addEventListener("click", () => {
      const expanded = olderToggle.getAttribute("aria-expanded") === "true";
      olderToggle.setAttribute("aria-expanded", String(!expanded));
      olderList.hidden = expanded;
      olderToggle.textContent = expanded
        ? `Starsze podsumowania (${older.length}) ▾`
        : "Zwiń starsze podsumowania ▴";
    });
  }
}

function renderProjectCard(templates, project, summaryData) {
  const node = templates.card.content.cloneNode(true);
  const article = node.querySelector(".project-card");

  article.querySelector(".project-name").textContent = project.name;

  const badge = article.querySelector(".status-badge");
  badge.textContent = project.status;
  badge.dataset.status = project.status.toLowerCase();

  article.querySelector(".project-description").textContent = project.description;

  const chips = article.querySelector(".tech-chips");
  project.tech.forEach((t) => {
    const span = document.createElement("span");
    span.className = "tech-chip";
    span.textContent = t;
    chips.appendChild(span);
  });

  article.querySelector(".last-activity").textContent = relativeDays(project.last_commit_at);

  renderSummaryBlock(article, templates.olderSummary, summaryData);

  const link = article.querySelector(".github-link");
  link.href = `https://github.com/${project.github}`;

  const toggleBtn = article.querySelector(".toggle-tree");
  const treeWrap = article.querySelector(".tree-wrap");
  const tree = article.querySelector(".tree");

  if (project.error) {
    const p = document.createElement("p");
    p.className = "error-state";
    p.textContent = project.error;
    tree.appendChild(p);
  } else if (!project.groups.length) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "Brak zarejestrowanych zmian.";
    tree.appendChild(p);
  } else {
    project.groups.forEach((g) => {
      tree.appendChild(renderBranchGroup(templates.branch, templates.commit, g));
    });
  }

  toggleBtn.addEventListener("click", () => {
    const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
    toggleBtn.setAttribute("aria-expanded", String(!expanded));
    treeWrap.hidden = expanded;
    toggleBtn.textContent = expanded
      ? "Szczegóły techniczne (surowe commity) ▾"
      : "Zwiń szczegóły techniczne ▴";
  });

  return article;
}

function renderFeedItem(template, item) {
  const node = template.content.cloneNode(true);
  const li = node.querySelector(".feed-item");
  li.querySelector(".feed-icon").textContent = item.type_icon;
  const a = li.querySelector(".feed-subject");
  a.textContent = item.subject;
  a.href = item.url;
  const branchPart = item.branch_label ? ` · ${item.branch_label}` : "";
  li.querySelector(".feed-meta").textContent =
    `${item.project_name}${branchPart} · ${fmtDateTime(item.date)}`;
  return li;
}

async function main() {
  const updatedAtEl = document.getElementById("updated-at");
  const projectsEl = document.getElementById("projects");
  const feedEl = document.getElementById("feed");

  let data;
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    updatedAtEl.textContent = "Nie udało się wczytać danych.";
    projectsEl.innerHTML = `<p class="error-state">Błąd wczytywania ${DATA_URL}: ${err.message}</p>`;
    return;
  }

  // Podsumowania tygodniowe są opcjonalne i pisane ręcznie (patrz CLAUDE.md) - ich brak albo
  // błąd wczytania nie może wywalić reszty strony.
  let summaries = { projects: {} };
  try {
    const res = await fetch(SUMMARIES_URL, { cache: "no-store" });
    if (res.ok) summaries = await res.json();
  } catch (err) {
    console.warn(`Nie udało się wczytać ${SUMMARIES_URL}:`, err);
  }

  updatedAtEl.textContent = `Ostatnia aktualizacja: ${fmtDateTime(data.generated_at)}`;

  const templates = {
    card: document.getElementById("project-card-template"),
    branch: document.getElementById("branch-group-template"),
    commit: document.getElementById("commit-item-template"),
    olderSummary: document.getElementById("older-summary-template"),
  };

  data.projects.forEach((p) => {
    const summaryData = summaries.projects && summaries.projects[p.id];
    projectsEl.appendChild(renderProjectCard(templates, p, summaryData));
  });

  const feedTemplate = document.getElementById("feed-item-template");
  if (!data.feed.length) {
    feedEl.innerHTML = '<li class="empty-state">Brak ostatniej aktywności.</li>';
  } else {
    data.feed.forEach((item) => feedEl.appendChild(renderFeedItem(feedTemplate, item)));
  }
}

main();
