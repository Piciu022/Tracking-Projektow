# Instrukcja dla Claude: aktualizacja dashboardu

Ten plik jest automatycznie wczytywany przez Claude Code w tym repo. Nie ma tu żadnej
automatyzacji w CI (nie ma GitHub Action, nie ma klucza API) — wszystko dzieje się ręcznie,
gdy Piotr o to poprosi w sesji Claude Code, np.:

- "zaktualizuj dashboard" / "wrzuć co ostatnio zrobiłem" → zrób **Krok A**.
- "zrób podsumowanie tygodnia" / "podsumuj co się zmieniło" (albo `/podsumowanie`) → zrób
  **Krok A** + **Krok B**.
- "dodaj/dopisz funkcję X do [projektu]" / "to już działa, dodaj do drzewka" → zrób **Krok B2**.
- "dopisz do [projektu] że zrobiłem X, to boczny task, nie ma tego na gicie" → zrób **Krok C**.
- "na co czekam w [projekcie] to X" / "odblokowało się X" → zaktualizuj `waiting_on` (Krok B2).

Każdy z Kroków B/B2/C kończy się **Krokiem D** (pokazanie do akceptacji + zapis + push).

## Ważne: to ma być portfolio, nie monitoring

Kieras (szef Piotra) **nie chce** wglądu w surową aktywność / commity — to ma wyglądać jak
prezentacja tego, co Piotr zbudował, nie jak podgląd na ręce. Priorytet dla każdego projektu:

1. Nazwa + krótki opis co robi (zawsze widoczne, góra kafelka).
2. "Co nowego" — ludzka narracja tygodnia (`data/summaries.json`).
3. "Funkcje" — czym projekt naprawdę jest: lista konkretnych funkcji z opisem, każda opcjonalnie
   z drzewkiem "co dodano" (`data/features.json`). To jest teraz główna treść kafelka, nie
   surowe commity.
4. "Na co czekam" — jeśli coś blokuje Piotra, jedno zdanie (`waiting_on` w `data/features.json`).

Surowe drzewo commitów (`data/activity.json`) istnieje dalej, ale jest **zwinięte na dole całej
strony** jako "Szczegóły techniczne" — nie per-projekt, nie rozwinięte. To głównie materiał
źródłowy dla Ciebie (do pisania Kroku B/B2), nie coś, co Piotr chce eksponować.

Kod źródłowy śledzonych projektów jest **prywatny** — ten dashboard (repo `Tracking-Projektow`)
jest **publiczny**. Nigdy nie kopiuj tu surowego kodu, treści plików, pełnych diffów, nazw
wewnętrznych zmiennych/secretów. Jeśli commit message albo diff zawiera coś wrażliwego,
sparafrazuj ogólnie albo zapytaj Piotra przed opublikowaniem.

## Krok A — odśwież surowe drzewo (`data/activity.json`)

```bash
cd "/Users/piotradamski/Programowanie/lot/Tracking-Projektów"
python3 scripts/update_data.py
```

Skrypt czyta `projects.yaml` i lokalne klony (`local_path`) — bez sieci, bez tokena. To materiał
źródłowy do Kroków B/B2 (i surowy fallback w zwiniętych "Szczegółach technicznych"), nie coś do
pokazywania per-projekt.

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
5. Dopisz wpis **na początek** listy `entries` dla każdego zaktualizowanego projektu (nie
   nadpisuj starych wpisów) i zaktualizuj `last_summarized_sha`:
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

## Krok B2 — zaktualizuj "Funkcje" (`data/features.json`)

To jest **drzewko**: Projekt → Funkcja → co w niej dodano. Aktualizuj, gdy coś jest trwałą,
konkretną zmianą w tym, co narzędzie umie (nie każdy drobny fix zasługuje na wpis).

Schemat (per projekt w `projects.<id>`):
```json
{
  "waiting_on": "krótkie zdanie albo puste \"\", jeśli nic nie blokuje",
  "features": [
    { "name": "Nazwa funkcji", "description": "1 zdanie co robi", "added": ["punkt", "..."] }
  ]
}
```

1. Jeśli zmiana rozwija istniejącą funkcję → dopisz krótki punkt do jej `added` (na górę listy,
   parafrazując commit na język efektu/wartości, nie implementacji).
2. Jeśli to zupełnie nowa funkcja/zakładka → dodaj nowy obiekt do `features` z `name` +
   `description`, `added: []` (albo od razu z pierwszym punktem).
3. Jeśli Piotr mówi, na co czeka (albo że to się odblokowało) → ustaw/wyczyść `waiting_on` dla
   tego projektu.
4. Nie zgaduj atrybucji na siłę — jeśli nie jesteś pewien, do której funkcji coś przypisać,
   zapytaj, zamiast zgadywać (to strona, którą szef ma oglądać, dokładność się liczy).

## Krok C — boczny task (coś, czego nie ma na gicie)

Piotr czasem robi coś, co nie zostawia commita (e-mail, plik Excel dla kogoś, rozmowa,
konfiguracja w Databricks) i chce, żeby to też było widoczne na dashboardzie. Wtedy zapytaj, czy
to:
- fragment narracji tygodnia → dopisz do `data/summaries.json` jak w Kroku B (bez
  `last_summarized_sha`, `commit_count: 0` albo pominięty), albo
- nowa/rozwijana funkcja → dopisz do `data/features.json` jak w Kroku B2.

## Krok D — pokaż do akceptacji, zapisz, wypchnij

**Zawsze pokaż szkic Piotrowi i poczekaj na akceptację** przed zapisem — to trafia na publiczną
stronę. Po akceptacji:

```bash
cd "/Users/piotradamski/Programowanie/lot/Tracking-Projektów"
git add data/activity.json data/summaries.json data/features.json
git commit -m "aktualizacja dashboardu: <krótki opis>"
git push
```

Repo jest publiczne, więc `git push` od razu odświeża stronę na GitHub Pages (patrz README.md).
