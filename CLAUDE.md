# Instrukcja dla Claude: tygodniowe podsumowanie zmian

Ten plik jest automatycznie wczytywany przez Claude Code w tym repo. Gdy Piotr napisze coś w
stylu **"zrób podsumowanie tygodnia"**, **"podsumuj co się zmieniło"** albo podobne — wykonaj
poniższą procedurę. To NIE jest zautomatyzowane (nie ma tu żadnego GitHub Action ani klucza
API) — dzieje się tylko wtedy, gdy Piotr o to poprosi, ręcznie, w sesji Claude Code.

## Cel

Zamienić surowe commity z 4 projektów (`projects.yaml`) na krótkie, ludzkie podsumowanie po
polsku — takie, które szef przeczyta i zrozumie bez znajomości kodu. Surowe drzewo commitów
(`data/activity.json`, generowane automatycznie przez GitHub Action) zostaje na stronie jako
"szczegóły techniczne" — to nie ma go zastąpić, tylko dodać nad nim ludzką warstwę.

## Procedura

1. Wczytaj `projects.yaml` (pola: `id`, `name`, `branch`, `local_path`) i `data/summaries.json`
   (pole `projects.<id>.last_summarized_sha`, jeśli istnieje).

2. Dla każdego projektu:
   ```bash
   cd "<local_path z projects.yaml, relatywnie do tego repo>"
   git fetch --quiet  # jeśli repo ma remote i jest sens sprawdzić najnowszy stan
   git log <last_summarized_sha>..<branch> --pretty=format:'%H|%ai|%s' --stat
   ```
   Jeśli `last_summarized_sha` nie istnieje (pierwsze uruchomienie dla danego projektu), weź
   commity z ostatnich 7 dni: `git log <branch> --since="7 days ago" ...`.
   Jeśli commitów od ostatniego podsumowania brak — pomiń ten projekt (nie twórz wpisu "brak
   zmian", po prostu nic nie dopisuj).

3. Przeczytaj commit messages i (dla nieoczywistych zmian) `git show <sha> --stat` / diff, żeby
   zrozumieć co faktycznie się zmieniło — nie tłumacz dosłownie komunikatów commitów, zrozum
   **efekt** zmiany.

4. Napisz podsumowanie: 3-6 zdań, po polsku, językiem dla nietechnicznego odbiorcy (szef).
   - Mów o efekcie/wartości ("teraz można porównać dowolną liczbę okresów naraz"), nie o
     implementacji ("zrefaktoryzowano _build_color_lut").
   - Bez żargonu programistycznego, bez nazw funkcji/plików, bez emoji-spamu.
   - Jeśli w tygodniu było dużo drobnych poprawek i jedna większa funkcja — jedno zdanie o
     poprawkach zbiorczo, więcej miejsca na główną funkcję.
   - Nie koloryzuj i nie zmyślaj — jeśli tydzień był głównie o naprawach błędów, tak napisz.

5. **Pokaż szkic podsumowań Piotrowi w czacie i poczekaj na potwierdzenie/poprawki** — to
   trafia na stronę widoczną dla szefa, więc zanim to zapiszesz i wypchniesz, Piotr powinien to
   zobaczyć i ewentualnie poprawić ton/treść. Nie commituj i nie pushuj bez tego kroku.

6. Po akceptacji, dla każdego zaktualizowanego projektu dopisz wpis do `data/summaries.json`:
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
   Nowe wpisy dopisuj na **początek** listy `entries` (najnowsze pierwsze). Nie nadpisuj
   wcześniejszych wpisów.

7. `git add data/summaries.json && git commit -m "podsumowanie tygodnia: <lista projektów>" &&
   git push` w repo `Tracking-Projektów` (**nie** w repo śledzonych projektów — tam niczego nie
   commitujemy). Push do `main` odświeży stronę na Cloudflare Pages automatycznie.

## Uwaga

`data/activity.json` (surowe drzewo) generuje wyłącznie `.github/workflows/update-dashboard.yml`
przez `scripts/update_data.py` — nie edytuj go ręcznie i nie nadpisuj przy tej procedurze.
