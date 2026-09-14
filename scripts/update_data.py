#!/usr/bin/env python3
"""
Buduje data/activity.json na podstawie LOKALNEJ historii commitów (bez GitHub API,
bez tokena) - czyta klony repozytoriów wskazane w projects.yaml (`local_path`).

Kod źródłowy śledzonych projektów może być całkowicie prywatny - ten skrypt nigdy nie
wychodzi do sieci, więc nic z niego nie "wycieka" do publicznego repo Tracking-Projektow
poza tym, co jawnie wylądowało w data/activity.json (podsumowania commitów, nie treść kodu).

Bez żadnego AI: parsuje konwencjonalne prefiksy commitów (feat:/fix:/napraw:/eksperyment:...)
i rekonstruuje "drzewo" zmian, grupując commity po branchu z którego zostały zmergowane
(na podstawie commitów merge, np. "Merge branch 'feature/x' do dev").

Uruchamiane ręcznie (lokalnie), zwykle w ramach procedury z CLAUDE.md - nie w CI, bo CI nie
ma dostępu do tych lokalnych klonów.
"""

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
PROJECTS_FILE = ROOT / "projects.yaml"
OUTPUT_FILE = ROOT / "data" / "activity.json"
FEED_LIMIT = 40

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


MERGE_BRANCH_RE = re.compile(r"Merge branch '([^']+)'")
MERGE_PR_RE = re.compile(r"Merge pull request #\d+ from [^/]+/(.+)")


def extract_branch_name(message: str):
    m = MERGE_BRANCH_RE.search(message) or MERGE_PR_RE.search(message)
    return m.group(1).strip() if m else None


def fetch_local_commits(local_path: Path, branch: str, limit: int):
    """Czyta historię commitów lokalnym `git log` - bez sieci, bez tokena."""
    if not (local_path / ".git").exists():
        return None, f"Nie znaleziono repo git w {local_path}"

    fmt = "%H|%P|%aI|%s"
    result = subprocess.run(
        ["git", "-C", str(local_path), "log", branch, f"--pretty=format:{fmt}", "-n", str(limit)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None, f"git log nie powiódł się dla {local_path}@{branch}: {result.stderr.strip()}"

    commits = []
    for line in result.stdout.splitlines():
        if not line:
            continue
        sha, parents, date, subject = line.split("|", 3)
        commits.append(
            {
                "sha": sha,
                "is_merge": len(parents.split()) > 1,
                "date": date,
                "subject": subject,
            }
        )
    return commits, None


def build_project_data(project: dict):
    github_repo = project["github"]
    branch = project.get("branch", "main")
    limit = project.get("history_limit", 100)
    local_path = (ROOT / project["local_path"]).resolve()
    print(f"-> {project['name']} ({local_path}@{branch})")

    raw_commits, error = fetch_local_commits(local_path, branch, limit)
    if error:
        print(f"  ! {error}", file=sys.stderr)
        return {
            **{k: project[k] for k in ("id", "name", "description", "status", "tech", "github")},
            "branch": branch,
            "last_commit_at": None,
            "groups": [],
            "error": error,
        }

    commits = []
    for c in raw_commits:
        type_key, icon, label = classify(c["subject"])
        commits.append(
            {
                "sha": c["sha"],
                "short_sha": c["sha"][:7],
                "subject": c["subject"],
                "date": c["date"],
                "url": f"https://github.com/{github_repo}/commit/{c['sha']}",
                "is_merge": c["is_merge"],
                "type_key": type_key,
                "type_icon": icon,
                "type_label": label,
            }
        )

    # `git log` zwraca najnowsze najpierw - do rekonstrukcji drzewa idziemy od najstarszego.
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
