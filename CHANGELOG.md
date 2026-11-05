# Changelog

Tu zapisuję, co się zmienia w Subberze. Wersje idą według [SemVer](https://semver.org/lang/pl/). Każda wersja ma opis po polsku i po angielsku.

Nowa wersja w Releases powstaje z tagu `v<wersja>`. Opis paczki to sekcja tej wersji stąd, więc zmiany dopisuję na bieżąco do `Unreleased`, a przy wydaniu przenoszę je pod numer.

*Each version is described in Polish and in English.*

## Unreleased

### Co zmieniono
- Po otwarciu nowego filmu nie pojawia się już fala dźwięku z poprzedniego.
- Błąd pobierania modelu, np. brak miejsca na dysku, nie udaje już braku CUDA i nie uruchamia drugiego pobierania na procesor.
- Pliki tymczasowe transkrypcji i eksportu znikają także po błędzie, a dwie operacje naraz nie nadpisują sobie plików.
- Ukośnik w napisie, np. `C:\nowy`, nie łamie linii w eksporcie ASS i MP4.
- Przeciąganie napisu w wąskiej szczelinie nie nakłada go już na sąsiedni.
- Uszkodzony plik wideo pokazuje błąd zamiast wiecznego czekania.
- Odtwarzanie mniej obciąża procesor: co klatkę odświeża się tylko głowica, czas i napis w podglądzie.
- Okno aplikacji ma dostęp tylko do filmów, które otworzysz, i ścisłe zasady bezpieczeństwa treści (CSP).

### What changed
- Opening a new video no longer shows the previous video's waveform.
- A model download error, such as a full disk, no longer looks like missing CUDA or starts a second download for the CPU.
- Temporary files from transcription and export are removed after errors too, and two operations at once no longer overwrite each other's files.
- A backslash in a caption, such as `C:\nowy`, no longer breaks the line in ASS and MP4 export.
- Dragging a caption into a narrow gap no longer overlaps the neighbouring one.
- A broken video file shows an error instead of waiting forever.
- Playback is lighter on the CPU: only the playhead, the time and the preview caption update every frame.
- The app window can read only the videos you open, under a strict content security policy (CSP).

## 0.2.0 - 2026-11-05

### Co nowego
- Pełny ekran podglądu: przycisk w rogu, klawisz F albo dwuklik na filmie. Na dole pasek z odtwarzaniem i czasem, Esc wychodzi.
- Folder silnika i modeli wybierasz w oknie generowania napisów. Silnik, model i pliki tymczasowe nie muszą już lądować na C:. Przed instalacją Subber sprawdza wolne miejsce i mówi, ile brakuje.
- Instalator Windows w Releases, z ffmpeg w środku.
- README po polsku i po angielsku.

### Co zmieniono
- Wypalone napisy z podświetlonym słowem nie mają już ciemnej pionowej kreski, która przesuwała się po tekście. Przy włączonym tle w MP4 widać też obrys.
- Podgląd poziomych filmów mieści się w oknie i stoi na środku, także przy małym oknie.
- Duże filmy nie wywalają programu. Fala dźwięku liczy się strumieniowo przez ffmpeg: plik 1 GB to 1,7 s i kilka MB pamięci.
- Fala dźwięku działa, nawet gdy terminal nie widzi ffmpeg w PATH. Subber szuka go też w folderze winget, w Program Files i w `C:\ffmpeg`.
- Błąd transkrypcji zostaje w oknie i da się go skopiować. Błędy trafiają też do `%APPDATA%\com.subber.app\subber.log`.

### What's new
- Fullscreen preview: the corner button, the F key or a double-click on the video. A bar at the bottom has playback and time, Esc leaves.
- Pick the engine and model folder in the subtitle generation window. The engine, the model and temp files no longer have to go to drive C:. Before installing, Subber checks free space and tells you how much is missing.
- Windows installer in Releases, with ffmpeg inside.
- README in Polish and in English.

### What changed
- Burned-in captions with a highlighted word no longer show a dark vertical line moving through the text. With the background on, the outline now shows in the MP4 too.
- Landscape videos fit the preview and stay centered, also in a small window.
- Large videos no longer crash the app. The waveform is computed by streaming through ffmpeg: a 1 GB file takes 1.7 s and a few MB of memory.
- The waveform works even when the terminal does not see ffmpeg on PATH. Subber also looks in the winget folder, Program Files and `C:\ffmpeg`.
- A transcription error stays in the window and can be copied. Errors also go to `%APPDATA%\com.subber.app\subber.log`.

## 0.1.0 - 2026-11-05

Pierwsza wersja. *First version.*

### Co nowego
- Transkrypcja przez faster-whisper (domyślnie large-v3 na GPU), WhisperX, OpenAI i Deepgram. Silnik instaluje się sam przy pierwszym użyciu.
- Oś czasu z falą dźwięku: przesuwanie, rozciąganie i cięcie napisów, zoom, przewijanie głowicą.
- Lista napisów z edycją tekstu i czasów, wyszukiwaniem i suwakiem znaków na napis.
- Cofnij i ponów dla każdej zmiany.
- Panel stylu: czcionka, kolory, tło, obrys, cień, animacja wzrostu, presety.
- Podświetlanie słowa, które właśnie pada, w podglądzie i w eksporcie.
- Eksport SRT, VTT, ASS i MP4 z wypalonymi napisami.
- Klucze API trzymane w Menedżerze poświadczeń Windows.

### Co zmieniono
- Napis nie łapie już końca jednego zdania i początku drugiego. Wcześniej „miejscu. To” wisiało razem i dalszy tekst spóźniał się za głosem.
- Pobieranie silnika i modelu działa przy Nortonie i innych antywirusach, które skanują HTTPS.
- Wypalone napisy mają tę samą grubą czcionkę Montserrat co podgląd, razem z polskimi znakami.

### What's new
- Transcription with faster-whisper (large-v3 on the GPU by default), WhisperX, OpenAI and Deepgram. The engine installs itself on first use.
- Timeline with the waveform: move, stretch and cut captions, zoom, scrub with the playhead.
- Caption list with editable text and times, search, and a characters-per-caption slider.
- Undo and redo for every change.
- Style panel: font, colors, background, outline, shadow, grow animation, presets.
- Highlight of the word being spoken, in the preview and in the export.
- Export to SRT, VTT, ASS and MP4 with burned-in captions.
- API keys kept in the Windows Credential Manager.

### What changed
- A caption no longer holds the end of one sentence and the start of the next. Before, "miejscu. To" stuck together and the following text fell behind the voice.
- Downloading the engine and the model works with Norton and other antivirus tools that scan HTTPS.
- Burned-in captions use the same bold Montserrat as the preview, Polish letters included.
