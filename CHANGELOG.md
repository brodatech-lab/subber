# Changelog

Tu zapisuję, co się zmienia w Subberze. Format jest luźno oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersje idą według [SemVer](https://semver.org/lang/pl/).

Każdy push na `master` buduje instalator i wrzuca go do Releases. Opis paczki składa się z sekcji `Unreleased` stąd i z listy commitów od poprzedniej paczki. Commity z `feat:` lądują w „Co nowego”, cała reszta w „Co zmieniono”.

## Unreleased

### Dodane
- Automatyczne paczki na Windows w Releases po każdym pushu na `master`, z opisem zmian.
- README osobno po polsku (`README.md`) i po angielsku (`README.en.md`).

### Poprawione
- Program nie wywala się już przy dużych filmach. Fala dźwięku liczy się teraz strumieniowo przez ffmpeg, plik 1 GB to 1,7 s i kilka MB pamięci. Wcześniej cały plik ładował się do RAM.

## 0.1.0 - 2026-11-05

Pierwsza wersja.

### Dodane
- Transkrypcja przez faster-whisper (domyślnie large-v3 na GPU), WhisperX, OpenAI i Deepgram. Silnik instaluje się sam przy pierwszym użyciu.
- Oś czasu z falą dźwięku: przesuwanie, rozciąganie i cięcie napisów, zoom, przewijanie głowicą.
- Lista napisów z edycją tekstu i czasów, wyszukiwaniem i suwakiem znaków na napis.
- Cofnij i ponów dla każdej zmiany.
- Panel stylu: czcionka, kolory, tło, obrys, cień, animacja wzrostu, presety.
- Podświetlanie słowa, które właśnie pada, w podglądzie i w eksporcie.
- Eksport SRT, VTT, ASS i MP4 z wypalonymi napisami.
- Klucze API trzymane w Menedżerze poświadczeń Windows.

### Poprawione
- Napis nie łapie już końca jednego zdania i początku drugiego. Wcześniej „miejscu. To” wisiało razem i dalszy tekst spóźniał się za głosem.
- Pobieranie silnika i modelu działa przy Nortonie i innych antywirusach, które skanują HTTPS.
- Wypalone napisy mają tę samą grubą czcionkę Montserrat co podgląd, razem z polskimi znakami.
