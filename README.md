# Subber

Desktopowy edytor napisów dla Windows. Wczytujesz film, Subber rozpoznaje mowę i układa napisy na osi czasu. Potem poprawiasz je na timeline albo w liście, ustawiasz styl i eksportujesz.

## Wymagania

- Windows 10/11, Node 20+, Rust (stable)
- Python 3.10+ w PATH. Przy pierwszej transkrypcji aplikacja sama tworzy środowisko w `%APPDATA%\com.subber.app\engine`.
- ffmpeg z libass w PATH, na przykład z `winget install Gyan.FFmpeg`. Można też położyć `ffmpeg.exe` obok `Subber.exe`.
- Do lokalnych silników karta NVIDIA z CUDA 12. Bez karty działają też na procesorze, tylko wolniej.

## Uruchomienie

```bash
npm install
npm run tauri dev      # aplikacja desktopowa
npm run dev            # sam interfejs w przeglądarce, z przykładową transkrypcją
npm test               # testy formatów napisów, czasu i dzielenia
npm run tauri build    # instalator NSIS w src-tauri/target/release/bundle/nsis
```

## Silniki rozpoznawania mowy

| Silnik | Gdzie działa | Co instaluje przy pierwszym użyciu |
| --- | --- | --- |
| faster-whisper (domyślny) | lokalnie, GPU | `faster-whisper`, biblioteki CUDA (ok. 1,5 GB) plus model (large-v3 ok. 3 GB) |
| WhisperX | lokalnie, GPU | PyTorch CUDA i `whisperx` (kilka GB) |
| OpenAI | chmura | `requests`, klucz API |
| Deepgram | chmura | `requests`, klucz API |

Klucze API trafiają do Menedżera poświadczeń Windows. Nie są zapisywane w plikach projektu.

## Skróty

| Klawisz | Akcja |
| --- | --- |
| Spacja | odtwarzaj / pauza |
| S | podziel napis w miejscu głowicy |
| Ctrl+Z / Ctrl+Y | cofnij / ponów |
| Delete | usuń zaznaczony napis |
| ← / → | przesuń głowicę o 0,1 s (z Shift o 1 s) |
| Ctrl + kółko | powiększenie osi czasu |

## Struktura

- `src/lib`: formaty SRT/VTT/ASS, regrupowanie słów, czas, most do Rusta
- `src/store`: stan projektu z historią cofania
- `src/ui/{atoms,molecules,organisms}`: interfejs (atomic design)
- `src-tauri/src`: `stt.rs` (ffmpeg, środowisko Python, worker), `export.rs` (wypalanie napisów), `secrets.rs` (klucze)
- `engine/stt_worker.py`: worker STT, który zwraca słowa ze znacznikami czasu jako JSON lines

## Znane ograniczenia

- Podgląd rysuje napisy w HTML, a eksport wideo używa libass. Zaokrąglone tło jest tylko w podglądzie, bo w eksporcie tło jest prostokątne. Przy włączonym tle eksport pomija obrys.
- Krój Montserrat jest wbudowany w interfejs. Do eksportu wideo musi być zainstalowany w systemie, inaczej libass podstawi inny krój.
- Tłumaczenie napisów jest wyłączone w tej wersji.
