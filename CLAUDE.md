# Instrukcja dla Claude: aktualizacja dashboardu

Ten plik jest automatycznie wczytywany przez Claude Code w tym repo. Nie ma tu żadnej
automatyzacji w CI (nie ma GitHub Action, nie ma klucza API) — wszystko dzieje się ręcznie,
gdy Piotr o to poprosi w sesji Claude Code, np.:

- "zaktualizuj dashboard" / "wrzuć co ostatnio zrobiłem" → zrób **Krok A**.
- "zrób podsumowanie tygodnia" / "podsumuj co się zmieniło" (albo `/podsumowanie`) → zrób
  **Krok A** + **Krok B**.
- "dopisz do [projektu] że zrobiłem X, to boczny task, nie ma tego na gicie" → zrób
  **Krok C**.

Kod źródłowy śledzonych projektów (`Codeshare-assistant`, `Slots_Monitoring`, `Slots_MK`) jest
**prywatny** — ten dashboard (repo `Tracking-Projektow`) jest **publiczny**. Nigdy nie kopiuj do
tego repo surowego kodu, treści plików, pełnych diffów, nazw wewnętrznych zmiennych/secretów
itp. — tylko krótkie, ludzkie opisy tego, co się zmieniło. Jeśli commit message albo diff
zawiera coś wrażliwego (klucz, dane, nazwę wewnętrznego systemu, którą lepiej nie ujawniać
publicznie), sparafrazuj to ogólnie albo zapytaj Piotra, zanim to opublikujesz.

## Krok A — odśwież surowe drzewo (`data/activity.json`)

```bash
cd "/Users/piotradamski/Programowanie/lot/Tracking-Projektów"
python3 scripts/update_data.py
```

Skrypt czyta `projects.yaml` i lokalne klony (`local_path`) — bez sieci, bez tokena. Nadpisuje
`data/activity.json` na podstawie **aktualnego stanu lokalnych branchy** (nie GitHuba — jeśli
lokalna kopia jest za zdalną, to celowe: dashboard ma pokazywać co Piotr faktycznie zrobił na
tej maszynie).

## Krok B — napisz ludzkie podsumowanie ("Co nowego")

1. Wczytaj `data/summaries.json` (pole `projects.<id>.last_summarized_sha`, jeśli istnieje).
2. Dla każdego projektu z `projects.yaml`:
   ```bash
   cd "<local_path>"
   git log <last_summarized_sha>..<branch> --pretty=format:'%H|%ai|%s' --stat
   ```
   Brak `last_summarized_sha` (pierwsze uruchomienie) → weź commity z ostatnich 7 dni
   (`--since="7 days ago"`). Brak nowych commitów → pomiń projekt, nic nie dopisuj.
3. Przeczytaj commit messages i (dla nieoczywistych zmian) diffy, żeby zrozumieć **efekt**
   zmiany, nie tylko jej treść.
4. Napisz 3-6 zdań po polsku, językiem dla nietechnicznego odbiorcy (szef): efekt/wartość, nie
   implementacja; bez żargonu, nazw funkcji/plików, bez emoji-spamu; bez koloryzowania — jeśli
   tydzień był głównie o naprawach, tak napisz.
5. **Pokaż szkice Piotrowi i poczekaj na akceptację** — to trafia na publiczną stronę, więc
   zanim to zapiszesz, powinien to zobaczyć i ewentualnie poprawić. Nie commituj bez tego.
6. Po akceptacji dopisz wpis **na początek** listy `entries` dla każdego zaktualizowanego
   projektu (nie nadpisuj starych wpisów) i zaktualizuj `last_summarized_sha`:
   ```json
   {
     "projects": {
       "<project_id>": {
         "last_summarized_sha": "<sha najnowszego uwzględnionego commita>",
         "entries": [
           {
             "period_start": "YYYY-MM-DD",
             "period_end": "YYYY-MM-DD",
             "generated_at": "ISO 8601 z offsetem",
             "commit_count": <int>,
             "summary": "<tekst>"
           }
         ]
       }
     }
   }
   ```

## Krok C — boczny task (coś, czego nie ma na gicie)

Piotr czasem robi coś, co nie zostawia commita (e-mail, plik Excel dla kogoś, rozmowa,
konfiguracja w Databricks) i chce, żeby to też było widoczne na dashboardzie. Wtedy:

1. Zapytaj do którego projektu to przypisać (albo czy to coś ogólne — wtedy można użyć
   `project_id: "inne"` jako kontenera na zadania niezwiązane z konkretnym repo).
2. Dopisz wpis do `data/summaries.json` tak jak w Kroku B (bez `last_summarized_sha` w tym
   wpisie, bo nie wynika z commitów) — pole `commit_count` ustaw na `0` albo pomiń.
3. Pokaż szkic do akceptacji, tak jak w Kroku B.

## Krok D — zapisz i wypchnij

Po akceptacji (Krok B i/albo C):

```bash
cd "/Users/piotradamski/Programowanie/lot/Tracking-Projektów"
git add data/activity.json data/summaries.json
git commit -m "aktualizacja dashboardu: <krótki opis>"
git push
```

Repo jest publiczne, więc `git push` od razu odświeża stronę na GitHub Pages (patrz README.md).
