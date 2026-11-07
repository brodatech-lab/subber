# Subber

**Polski** · [English](README.en.md)

Subber to desktopowy edytor napisów do wideo. Umożliwia automatyczną transkrypcję, edycję napisów na osi czasu, dostosowanie ich wyglądu oraz eksport do popularnych formatów.

Aplikacja powstała jako alternatywa dla chmurowych edytorów napisów, które wymagają przesyłania nagrań na zewnętrzne serwery. W Subberze przetwarzanie odbywa się lokalnie — domyślnie model Whisper korzysta z GPU, a pliki pozostają na komputerze użytkownika.

## Funkcje

- **Automatyczna transkrypcja** — domyślnie faster-whisper large-v3 z wykorzystaniem GPU. Dostępne są również WhisperX oraz usługi chmurowe OpenAI i Deepgram.
- **Edycja na osi czasu** — napisy są wyświetlane obok przebiegu fali dźwiękowej. Można je przesuwać, zmieniać ich długość i dzielić klawiszem `S`.
- **Edycja tekstu i znaczników czasu** — treść oraz czasy napisów można poprawiać na liście po lewej stronie. Obsługiwane są operacje cofania i ponawiania (`Ctrl+Z`, `Ctrl+Y`).
- **Kontrola podziału napisów** — aplikacja zapobiega łączeniu końca jednego zdania z początkiem następnego w obrębie pojedynczego napisu.
- **Podświetlanie aktualnie wypowiadanego słowa** — ułatwia tworzenie napisów w stylu popularnym w krótkich materiałach wideo.
- **Dostosowanie wyglądu** — panel stylizacji pozwala zmieniać czcionkę, kolor, tło, obrys, cień i animację. Ustawienia można zapisywać jako presety.
- **Eksport** — dostępne formaty to SRT, VTT i ASS, a także MP4 z wypalonymi napisami. Obsługiwane są również materiały pionowe w proporcjach 9:16.

W przeprowadzonym teście wypalenie napisów w 55-sekundowym materiale pionowym zajęło mniej niż 4 sekundy.

## Instalacja

Pobierz instalator z sekcji [Releases](https://github.com/brodatech-lab/subber/releases). Instalator zawiera ffmpeg.

Do działania aplikacji wymagany jest również **Python 3.10 lub nowszy**. Przy pierwszej transkrypcji Subber automatycznie przygotowuje własne środowisko i pobiera model. Pobranie obejmuje kilka GB danych, dlatego pierwsze uruchomienie transkrypcji może potrwać dłużej.

Karta graficzna **NVIDIA obsługująca CUDA 12** znacząco przyspiesza przetwarzanie. Aplikacja działa również bez niej, wykorzystując CPU, ale transkrypcja trwa wtedy dłużej.

Subber korzysta z magazynu certyfikatów systemu Windows. Dzięki temu skanowanie HTTPS przez programy takie jak Norton i Avast oraz firmowe serwery proxy nie powinny zakłócać pobierania.

## Skróty klawiszowe

| Klawisz | Działanie |
| --- | --- |
| `Spacja` | Odtwarzanie / pauza |
| `S` | Podział napisu w miejscu głowicy odtwarzania |
| `Ctrl+Z` / `Ctrl+Y` | Cofnij / ponów |
| `Delete` | Usuń zaznaczony napis |
| `←` / `→` | Przesuń głowicę o 0,1 s; z `Shift` — o 1 s |
| `Ctrl` + kółko myszy | Przybliżanie / oddalanie osi czasu |

## Budowanie ze źródeł

Wymagane narzędzia:

- Node.js 20 lub nowszy
- Rust
- ffmpeg dostępny w zmiennej `PATH`

Uruchomienie aplikacji w trybie deweloperskim:

```bash
npm install
npm run tauri dev
```

Aby uruchomić sam interfejs w przeglądarce, użyj:

```bash
npm run dev
```

W tym trybie transkrypcja jest symulowana, natomiast edytor pozostaje w pełni funkcjonalny.

Testy uruchomisz poleceniem `npm test`, a instalator zbudujesz za pomocą:

```bash
npm run tauri build
```

## Proces wydawania nowych wersji

Zwykłe wypchnięcie zmian na gałąź `master` nie uruchamia procesu budowania. Instalator jest tworzony wyłącznie po wypchnięciu tagu wersji, np. `v0.2.0`. GitHub Actions buduje wtedy instalator zawierający ffmpeg i publikuje go w sekcji Releases.

Opis wydania pochodzi z odpowiedniej sekcji pliku [CHANGELOG.md](CHANGELOG.md), dostępnej w języku polskim i angielskim. Bieżące zmiany należy dopisywać do sekcji `Unreleased`.

Aby przygotować wydanie:

1. Zaktualizuj numer wersji w plikach `package.json`, `src-tauri/tauri.conf.json` i `src-tauri/Cargo.toml`.
2. Przenieś wpisy z sekcji `Unreleased` do sekcji nowej wersji w obu językach.
3. Zacommituj i wypchnij zmiany, a następnie utwórz i wypchnij tag, np.:

   ```bash
   git tag v0.3.0 && git push origin v0.3.0
   ```

Jeśli tag nie odpowiada wersji projektu lub w pliku CHANGELOG.md brakuje sekcji dla danego wydania, workflow zostanie przerwany i wydanie nie zostanie opublikowane.

## Architektura

Subber wykorzystuje **Tauri 2**, **React** i **TypeScript** po stronie interfejsu oraz **Rust** po stronie logiki aplikacji.

Rozpoznawanie mowy działa w osobnym procesie Pythona — [engine/stt_worker.py](engine/stt_worker.py). Proces otrzymuje plik audio i zwraca rozpoznane słowa wraz ze znacznikami czasu. Taki podział pozwala wymieniać silniki transkrypcji bez modyfikowania pozostałych części aplikacji. Do wypalania napisów wykorzystywany jest ffmpeg z biblioteką libass.

Najważniejsze katalogi:

- `src/lib` — formaty napisów, dzielenie słów na napisy i obsługa czasu
- `src/ui` — interfejs użytkownika, zorganizowany w atomy, molekuły i organizmy
- `src-tauri/src` — transkrypcja, eksport i obsługa kluczy API

Klucze API OpenAI i Deepgram są przechowywane w Menedżerze poświadczeń systemu Windows, a nie w plikach aplikacji.

## Ograniczenia i planowane obszary rozwoju

- Zaokrąglone tła napisów są widoczne w podglądzie, ale w wyeksportowanym MP4 mają kształt prostokąta. Wynika to ze sposobu renderowania teł przez format ASS.
- Aplikacja nie obsługuje jeszcze tłumaczenia napisów.
- Obecnie dostępna jest wyłącznie wersja dla systemu Windows.

Historia zmian znajduje się w pliku [CHANGELOG.md](CHANGELOG.md).
