const DATA_URL = "data/activity.json";
const SUMMARIES_URL = "data/summaries.json";
const FEATURES_URL = "data/features.json";

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

function renderFeature(template, feature) {
  const node = template.content.cloneNode(true);
  const li = node.querySelector(".feature-item");
  li.querySelector(".feature-name").textContent = feature.name;
  li.querySelector(".feature-description").textContent = feature.description || "";

  const addedList = li.querySelector(".feature-added");
  (feature.added || []).forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    addedList.appendChild(item);
  });
  if (!feature.added || !feature.added.length) {
    addedList.remove();
  }

  return li;
}

function renderFeaturesBlock(article, featureTemplate, featuresData) {
  const block = article.querySelector(".features-block");
  if (!featuresData || !featuresData.features || !featuresData.features.length) {
    return; // brak opisanych funkcji jeszcze - blok zostaje schowany
  }
  block.hidden = false;
  const list = block.querySelector(".features-list");
  featuresData.features.forEach((f) => list.appendChild(renderFeature(featureTemplate, f)));
}

function renderWaitingOn(article, featuresData) {
  const waitingOn = featuresData && featuresData.waiting_on;
  if (!waitingOn) return; // nic nie czeka - blok zostaje schowany
  const block = article.querySelector(".waiting-on");
  block.hidden = false;
  block.querySelector(".waiting-text").textContent = waitingOn;
}

function renderProjectCard(templates, project, summaryData, featuresData) {
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

  renderSummaryBlock(article, templates.olderSummary, summaryData);
  renderFeaturesBlock(article, templates.feature, featuresData);
  renderWaitingOn(article, featuresData);

  const link = article.querySelector(".github-link");
  if (project.github) {
    link.href = `https://github.com/${project.github}`;
  } else {
    link.remove(); // panel ręczny, bez repo do podlinkowania
  }

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

async function fetchJsonSafe(url, fallback) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn(`Nie udało się wczytać ${url}:`, err);
  }
  return fallback;
}

async function main() {
  const projectsEl = document.getElementById("projects");
  const feedEl = document.getElementById("feed");

  let data;
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    projectsEl.innerHTML = `<p class="error-state">Błąd wczytywania ${DATA_URL}: ${err.message}</p>`;
    return;
  }

  // Podsumowania i opisy funkcji są opcjonalne i pisane ręcznie (patrz CLAUDE.md) - ich brak
  // albo błąd wczytania nie może wywalić reszty strony.
  const summaries = await fetchJsonSafe(SUMMARIES_URL, { projects: {} });
  const features = await fetchJsonSafe(FEATURES_URL, { projects: {} });

  const templates = {
    card: document.getElementById("project-card-template"),
    feature: document.getElementById("feature-item-template"),
    olderSummary: document.getElementById("older-summary-template"),
  };

  data.projects.forEach((p) => {
    const summaryData = summaries.projects && summaries.projects[p.id];
    const featuresData = features.projects && features.projects[p.id];
    projectsEl.appendChild(renderProjectCard(templates, p, summaryData, featuresData));
  });

  const feedTemplate = document.getElementById("feed-item-template");
  if (!data.feed.length) {
    feedEl.innerHTML = '<li class="empty-state">Brak ostatniej aktywności.</li>';
  } else {
    data.feed.forEach((item) => feedEl.appendChild(renderFeedItem(feedTemplate, item)));
  }

  const feedToggle = document.querySelector(".toggle-feed");
  feedToggle.addEventListener("click", () => {
    const expanded = feedToggle.getAttribute("aria-expanded") === "true";
    feedToggle.setAttribute("aria-expanded", String(!expanded));
    feedEl.hidden = expanded;
    feedToggle.textContent = expanded
      ? "Szczegóły techniczne (surowe commity, wszystkie projekty) ▾"
      : "Zwiń szczegóły techniczne ▴";
  });
}

main();
