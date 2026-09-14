# Tracking Projektów

Publiczne portfolio: jakie projekty robię i co potrafią — **nie** monitoring aktywności.
Statyczna strona (`index.html` + `style.css` + `app.js`), zero backendu, zero kosztów.

**To repo jest publiczne** (żeby GitHub Pages był darmowy i prosty), ale **kod źródłowy
śledzonych projektów** (`Codeshare-assistant`, `Slots_Monitoring`, `Slots_MK`) **zostaje
prywatny** — nigdy nie trafia tutaj. Wszystko, co widać na stronie, to ręcznie napisane
opisy, nie surowy kod.

Trzy pliki danych, wszystkie w `data/`:

- **`features.json`** — główna treść kafelka: lista funkcji projektu, każda z opisem i
  opcjonalnym drzewkiem "co dodano", plus "na co czekam" jeśli coś blokuje. Pisane ręcznie
  przez Claude na polecenie Piotra.
- **`summaries.json`** — "Co nowego": krótka ludzka narracja tygodnia. Też ręczne.
- **`activity.json`** — podstawowe metadane kafelka (nazwa/opis/status/tech) plus surowe drzewo
  commitów, generowane automatycznie skryptem czytającym lokalne klony na dysku (**bez AI, bez
  GitHub API, bez tokena**). Drzewo commitów **nigdzie na stronie się nie wyświetla** — to
  wyłącznie materiał źródłowy do pisania `features.json`/`summaries.json`.

Nic z tego nie działa automatycznie w tle — całość odpalana jest ręcznie, kiedy Piotr o to
poprosi. Pełna procedura (co dokładnie robi Claude) jest w [`CLAUDE.md`](CLAUDE.md).

## Jak to działa

```
Piotr pracuje normalnie w 4 projektach (commit/merge jak zawsze, lokalnie)
            │
            ▼
Piotr mówi w Claude Code: "zaktualizuj dashboard" / "zrób podsumowanie tygodnia" /
"dopisz X, tego nie ma na gicie"
            │
            ▼
Claude:
  - czyta lokalne klony projektów (scripts/update_data.py, tylko dysk, zero sieci)
    → data/activity.json (surowe drzewo commitów)
  - pisze ludzkie podsumowanie zmian → pokazuje szkic do akceptacji
            │
            ▼
Piotr akceptuje (albo prosi o poprawki)
            │
            ▼
Claude: git add + commit + push do tego repo (publiczne)
            │
            ▼
GitHub Pages widzi nowy commit na `main` → sam przebudowuje stronę
            │
            ▼
Każdy z linkiem widzi aktualną wersję na https://<user>.github.io/Tracking-Projektow/
```

## Wdrożenie od zera

### 1. Repo na GitHubie (publiczne)

```bash
cd "/Users/piotradamski/Programowanie/lot/Tracking-Projektów"
git init   # jeśli jeszcze nie zrobione
git add .
git commit -m "init: dashboard projektów"
```

Utwórz nowe **publiczne** repozytorium na github.com (np. `Tracking-Projektow`, bez
inicjalizowania README/gitignore — repo ma zostać puste), potem:

```bash
git remote add origin https://github.com/Piciu022/Tracking-Projektow.git
git branch -M main
git push -u origin main
```

### 2. Włącz GitHub Pages

W repo na GitHubie: **Settings → Pages** → *Build and deployment* → *Source*: **Deploy from a
branch** → *Branch*: `main`, folder `/ (root)` → **Save**.

Po chwili GitHub pokaże adres strony, coś w stylu:
`https://piciu022.github.io/Tracking-Projektow/`

Ten link wysyłasz szefowi. Działa dla każdego, kto go ma — bez logowania.

### 3. Pierwsza prawdziwa aktualizacja danych

W Claude Code (w tym repo) powiedz **"zaktualizuj dashboard"** — Claude wykona Krok A z
`CLAUDE.md` (wygeneruje `data/activity.json` z prawdziwych lokalnych commitów) i spyta, czy
zapisać i wypchnąć. Po pushu strona na GitHub Pages sama się odświeży (może minąć minutę).

## Dodawanie kolejnego projektu

1. Dodaj wpis do `projects.yaml`: `id`, `name`, `description`, `status`, `tech`, `github`
   (`"Piciu022/nazwa-repo"` — używane tylko do zbudowania linku do commita), `branch`,
   `local_path` (ścieżka do lokalnego klonu na tym Macu, względna do tego repo).
2. Powiedz "zaktualizuj dashboard" — resztę robi Claude.

## Konwencja commitów, na której opiera się "drzewo"

Skrypt rozpoznaje te prefiksy w pierwszej linii commita:

| Prefiks | Ikona | Znaczenie |
|---|---|---|
| `feat:` | ✨ | Nowa funkcja |
| `fix:` / `napraw:` | 🐛 | Poprawka |
| `eksperyment:` / `experiment:` | 🧪 | Eksperyment |
| `refactor:` | 🔧 | Refaktor |
| `docs:` | 📝 | Dokumentacja |
| `chore:` | 🧹 | Porządki |
| `test:` | ✅ | Testy |

Commity bez rozpoznanego prefiksu i tak trafiają na drzewo (jako "• Zmiana") — nic nie jest
ukrywane, prefiksy tylko dobierają ikonkę.

Grupowanie w gałęzie działa automatycznie na podstawie commitów merge (`Merge branch 'feature/x'
do dev` albo `Merge pull request #N from .../nazwa-brancha`) — nie trzeba nic konfigurować, wynika
z tego, jak i tak już pracujesz na branchach `feature/...`, `fix/...`, `eksperyment/...`.

Projekt bez takich merge commitów (np. `Slots_MK`, gdzie commity idą wprost na `main`/`dev` jako
`Etap N: ...`) po prostu wyląduje jako jedna płaska lista "Najnowsze zmiany" — wciąż automatyczne
i wciąż użyteczne, tylko bez podziału na gałęzie.

## Test lokalny

```bash
cd scripts && pip install -r requirements.txt && cd ..
python3 scripts/update_data.py   # czyta lokalne klony, zero sieci
python3 -m http.server 8000      # potem otwórz http://localhost:8000
```

## Prywatność — co dokładnie jest publiczne

- **Publiczne**: to repo (`Tracking-Projektow`) — kod strony, `data/activity.json` (komunikaty
  commitów, nie treść zmian), `data/summaries.json` (ludzkie podsumowania napisane przez Claude).
- **Prywatne, nigdy tu nie trafia**: kod źródłowy `NOTAM-READER`*, `Codeshare-assistant`,
  `Slots_Monitoring`, `Slots_MK` — treść plików, diffy, secrety, wewnętrzne nazwy systemów.
  Claude czyta je tylko lokalnie z dysku, żeby napisać podsumowanie.

  \* `NOTAM-READER` jest akurat publiczne z innego powodu (był tak założony wcześniej) — ale
  zasada jest taka sama: to repo nie zależy od tego, czy śledzone projekty są publiczne czy nie.

Jeśli commit message albo diff w jednym z projektów zawiera coś wrażliwego, Claude ma
instrukcję (w `CLAUDE.md`) sparafrazować to ogólnie albo zapytać przed opublikowaniem — ale
warto też samemu pamiętać o tym pisząc commit messages w prywatnych repo.
