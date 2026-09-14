# Tracking Projektów

Prywatny dashboard dla szefa: co robię, w jakich projektach, i co się w nich ostatnio zmieniło.
Statyczna strona (`index.html` + `style.css` + `app.js`), zero backendu.

- **Surowe drzewo zmian** (`data/activity.json`) — generowane w pełni automatycznie przez GitHub
  Action, **bez żadnego AI**: tylko konwencjonalne prefiksy commitów (`feat:`, `fix:`/`napraw:`,
  `eksperyment:`...) i grupowanie po branchach, z których zmiany zostały zmergowane.
- **Ludzkie podsumowania "Co nowego"** (`data/summaries.json`) — pisane raz w tygodniu, ręcznie
  wyzwalane przez Piotra w Claude Code (bez klucza API, bez automatu w CI) — szczegóły w sekcji
  poniżej i w [`CLAUDE.md`](CLAUDE.md).

## Jak to działa

Dwie niezależne warstwy danych, obie kończą jako pliki JSON, oba czyta ta sama strona:

**1. Automatyczna, surowa ("Szczegóły techniczne")**

1. `projects.yaml` — lista śledzonych projektów (nazwa, opis, status, repo GitHub, branch).
2. `scripts/update_data.py` — pobiera historię commitów przez GitHub API, rekonstruuje "drzewo"
   (projekt → branch/feature → commity) i zapisuje `data/activity.json`.
3. `.github/workflows/update-dashboard.yml` — odpala skrypt codziennie o 5:00 UTC, ręcznie
   (przycisk "Run workflow"), i przy każdej zmianie `projects.yaml`; wynik commituje z powrotem
   do repo.

**2. Ręczna, ludzka ("Co nowego")**

`data/summaries.json` — krótkie, pisane po ludzku podsumowania tygodnia, bez żadnego AI-w-CI i
bez klucza API. Piotr raz w tygodniu (albo kiedy chce) mówi w Claude Code "zrób podsumowanie
tygodnia" (albo `/podsumowanie`) — Claude czyta lokalną historię commitów, pisze podsumowanie,
pokazuje do akceptacji i po OK commituje/pushuje. Cała procedura opisana w [`CLAUDE.md`](CLAUDE.md).

`index.html` czyta oba pliki JSON i renderuje: kafelki projektów → sekcję "Co nowego" (jeśli
istnieje podsumowanie) → zwijane "Szczegóły techniczne" z surowym drzewem → wspólny feed
aktywności na dole strony.

## Wdrożenie od zera

### 1. Repo na GitHubie (prywatne)

```bash
cd "/Users/piotradamski/Programowanie/lot/Tracking-Projektów"
git init
git add .
git commit -m "init: dashboard projektów"
```

Utwórz nowe **prywatne** repozytorium na github.com (np. `Tracking-Projektow`), potem:

```bash
git remote add origin https://github.com/Piciu022/Tracking-Projektow.git
git branch -M main
git push -u origin main
```

### 2. Token do odczytu prywatnych repo (`REPOS_TOKEN`)

Action potrzebuje dostępu do historii commitów `Codeshare-assistant`, `Slots_Monitoring` i
`Slots_MK` (są prywatne — `NOTAM-READER` jest publiczne, dla niego token nie jest wymagany).

1. GitHub → Settings → Developer settings → **Personal access tokens → Fine-grained tokens**
   → *Generate new token*.
2. *Resource owner*: Twoje konto (`Piciu022`).
3. *Repository access*: **Only select repositories** → wybierz `Codeshare-assistant`,
   `Slots_Monitoring` i `Slots_MK` (i każde kolejne prywatne repo, które dodasz do
   `projects.yaml`).
4. *Permissions* → **Contents: Read-only** (to wystarczy, żeby czytać commity).
5. Wygeneruj token, skopiuj go.
6. W repo `Tracking-Projektow` na GitHubie: **Settings → Secrets and variables → Actions →
   New repository secret** → nazwa `REPOS_TOKEN`, wartość = wklejony token.

### 3. Odpal Action ręcznie pierwszy raz

Zakładka **Actions** w repo → workflow "Aktualizacja danych dashboardu" → **Run workflow**.
Po chwili powinien pojawić się commit z `data/activity.json` wypełnionym prawdziwymi danymi.

### 4. Hosting: Cloudflare Pages (darmowe, prywatne przez Cloudflare Access)

GitHub Pages na darmowym planie nie może być prywatny (musi być publiczny), więc strona jedzie
na **Cloudflare Pages**, gdzie dostęp gasi się przez wbudowany **Cloudflare Access**
(darmowy do 50 użytkowników, logowanie e-mailem + jednorazowy kod — bez hasła w kodzie strony).

1. Załóż darmowe konto na [dash.cloudflare.com](https://dash.cloudflare.com) (jeśli nie masz).
2. **Workers & Pages → Create → Pages → Connect to Git** → wybierz repo `Tracking-Projektow`.
3. Build settings: *Framework preset* — None / Brak. *Build command* — puste (nic nie budujemy).
   *Build output directory* — `/` (katalog główny repo).
4. Deploy. Dostaniesz adres w stylu `tracking-projektow.pages.dev`.
5. Ogranicz dostęp: w projekcie Pages poszukaj sekcji **Access policy / Enable Access**
   (Cloudflare czasem chowa to pod Zero Trust → Access → Applications → *Add an application* →
   wskaż domenę `*.pages.dev` Twojego projektu — nazwy w UI Cloudflare zmieniają się od czasu do
   czasu, więc jeśli nie widzisz dokładnie takiej opcji, szukaj "Access" w ustawieniach projektu
   Pages albo w Zero Trust).
6. Reguła dostępu: *Include* → **Emails** → adres e-mail szefa (i swój, do testów). Zapisz.

Od teraz wejście na adres strony wymaga podania tego konkretnego e-maila i potwierdzenia
jednorazowym kodem wysłanym na skrzynkę — nikt inny się nie zaloguje.

Każdy `git push` do `main` (w tym automatyczny commit z Action) odświeża stronę na Cloudflare
Pages automatycznie.

## Dodawanie kolejnego projektu

1. Dodaj wpis do `projects.yaml` (nazwa, opis, status, `github: "Piciu022/nazwa-repo"`, branch).
2. Jeśli repo jest prywatne, dopisz je do listy repozytoriów w tokenie `REPOS_TOKEN`
   (Settings tokena na GitHubie → Repository access → edytuj listę).
3. `git push` — Action się odpali automatycznie (bo `projects.yaml` się zmienił) i doda kafelek.

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
python3 scripts/update_data.py   # bez REPOS_TOKEN zadziała tylko dla publicznych repo
python3 -m http.server 8000      # potem otwórz http://localhost:8000
```
