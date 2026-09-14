#!/usr/bin/env python3
"""
Buduje data/activity.json na podstawie historii commitów w projects.yaml.

Bez żadnego AI: parsuje konwencjonalne prefiksy commitów (feat:/fix:/napraw:/eksperyment:...)
i rekonstruuje "drzewo" zmian, grupując commity po branchu z którego zostały zmergowane
(na podstawie commitów merge, np. "Merge branch 'feature/x' do dev").

Wymaga (opcjonalnie) tokena GitHub w zmiennej środowiskowej REPOS_TOKEN - potrzebny tylko
dla repozytoriów prywatnych. Dla publicznych repo skrypt działa też bez tokena
(z niższym limitem zapytań API).
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
PROJECTS_FILE = ROOT / "projects.yaml"
OUTPUT_FILE = ROOT / "data" / "activity.json"
FEED_LIMIT = 40

TOKEN = os.environ.get("REPOS_TOKEN", "").strip()

TYPE_MAP = [
    (r"^feat", "feat", "✨", "Nowa funkcja"),
    (r"^(fix|napraw)", "fix", "🐛", "Poprawka"),
    (r"^(eksperyment|experiment)", "experiment", "🧪", "Eksperyment"),
    (r"^refactor", "refactor", "🔧", "Refaktor"),
    (r"^docs", "docs", "📝", "Dokumentacja"),
    (r"^chore", "chore", "🧹", "Porządki"),
    (r"^test", "test", "✅", "Testy"),
]

BRANCH_KIND_ICON = {
    "feature": "🌿",
    "fix": "🩹",
    "experiment": "🧪",
    "hotfix": "🩹",
}


def classify(subject: str):
    low = subject.strip().lower()
    for pattern, key, icon, label in TYPE_MAP:
        if re.match(pattern, low):
            return key, icon, label
    return "other", "•", "Zmiana"


def humanize_branch(branch_name: str):
    kind = branch_name.split("/", 1)[0] if "/" in branch_name else "other"
    short = branch_name.split("/", 1)[1] if "/" in branch_name else branch_name
    icon = BRANCH_KIND_ICON.get(kind, "🌿")
    label = short.replace("-", " ").replace("_", " ")
    return icon, label


def api_get(url: str):
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if TOKEN:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  ! GitHub API {e.code} dla {url}: {body[:300]}", file=sys.stderr)
        return None
    except urllib.error.URLError as e:
        print(f"  ! Błąd sieci dla {url}: {e}", file=sys.stderr)
        return None


def fetch_commits(github_repo: str, branch: str, limit: int):
    url = (
        f"https://api.github.com/repos/{github_repo}/commits"
        f"?sha={branch}&per_page={min(limit, 100)}"
    )
    data = api_get(url)
    if data is None:
        return None
    if isinstance(data, dict) and data.get("message"):
        print(f"  ! {github_repo}: {data.get('message')}", file=sys.stderr)
        return None
    return data


MERGE_BRANCH_RE = re.compile(r"Merge branch '([^']+)'")
MERGE_PR_RE = re.compile(r"Merge pull request #\d+ from [^/]+/(.+)")


def extract_branch_name(message: str):
    m = MERGE_BRANCH_RE.search(message) or MERGE_PR_RE.search(message)
    return m.group(1).strip() if m else None


def build_project_data(project: dict):
    github_repo = project["github"]
    branch = project.get("branch", "main")
    limit = project.get("history_limit", 100)
    print(f"-> {project['name']} ({github_repo}@{branch})")

    raw_commits = fetch_commits(github_repo, branch, limit)
    if not raw_commits:
        return {
            **{k: project[k] for k in ("id", "name", "description", "status", "tech", "github")},
            "branch": branch,
            "last_commit_at": None,
            "groups": [],
            "error": "Brak dostępu do historii commitów (sprawdź REPOS_TOKEN / uprawnienia).",
        }

    commits = []
    for c in raw_commits:
        message = c["commit"]["message"]
        subject = message.split("\n", 1)[0].strip()
        is_merge = len(c.get("parents", [])) > 1
        type_key, icon, label = classify(subject)
        commits.append(
            {
                "sha": c["sha"],
                "short_sha": c["sha"][:7],
                "subject": subject,
                "date": c["commit"]["author"]["date"],
                "url": c["html_url"],
                "is_merge": is_merge,
                "type_key": type_key,
                "type_icon": icon,
                "type_label": label,
            }
        )

    # API zwraca najnowsze najpierw - do rekonstrukcji drzewa idziemy od najstarszego.
    commits.reverse()

    groups = []
    pending = []
    for c in commits:
        if c["is_merge"]:
            branch_name = extract_branch_name(c["subject"])
            if pending:
                if branch_name:
                    icon, label = humanize_branch(branch_name)
                else:
                    icon, label = "🔀", "Scalone zmiany"
                groups.append(
                    {
                        "kind": "branch",
                        "branch_name": branch_name,
                        "icon": icon,
                        "label": label,
                        "merged_at": c["date"],
                        "merge_url": c["url"],
                        "commits": pending,
                    }
                )
                pending = []
            # merge bez poprzedzających commitów (np. merge --no-ff bez zmian) - ignorujemy
        else:
            pending.append(c)

    if pending:
        groups.append(
            {
                "kind": "direct",
                "branch_name": None,
                "icon": "🕓",
                "label": "Najnowsze zmiany (jeszcze nie zmergowane / bezpośrednio na branchu)",
                "merged_at": pending[-1]["date"],
                "merge_url": None,
                "commits": pending,
            }
        )

    # Najnowsze grupy na górze.
    groups.sort(key=lambda g: g["merged_at"] or "", reverse=True)
    for g in groups:
        g["commits"] = list(reversed(g["commits"]))

    last_commit_at = commits[-1]["date"] if commits else None

    return {
        "id": project["id"],
        "name": project["name"],
        "description": project["description"].strip(),
        "status": project["status"],
        "tech": project["tech"],
        "github": github_repo,
        "branch": branch,
        "last_commit_at": last_commit_at,
        "groups": groups,
    }


def main():
    with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    projects_data = [build_project_data(p) for p in config["projects"]]
    projects_data.sort(key=lambda p: p["last_commit_at"] or "", reverse=True)

    feed = []
    for p in projects_data:
        for g in p["groups"]:
            for c in g["commits"]:
                feed.append(
                    {
                        "project_id": p["id"],
                        "project_name": p["name"],
                        "branch_label": g["label"] if g["kind"] == "branch" else None,
                        **c,
                    }
                )
    feed.sort(key=lambda c: c["date"], reverse=True)
    feed = feed[:FEED_LIMIT]

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "projects": projects_data,
        "feed": feed,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nZapisano {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
