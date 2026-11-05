# Subber

**Polski** · [English](README.en.md)

Wrzucasz film, dostajesz napisy. Poprawiasz je na osi czasu, ustawiasz styl i eksportujesz.

Zrobiłem Subbera, bo miałem dość płacenia za edytory napisów w chmurze i wysyłania im każdego nagrania. Tu wszystko dzieje się na Twoim komputerze. Model Whisper liczy na karcie graficznej, plik nigdzie nie wychodzi.

## Co potrafi

- Sam rozpoznaje mowę. Domyślnie faster-whisper large-v3 na GPU. Do wyboru masz też WhisperX, a jak wolisz chmurę, OpenAI albo Deepgram.
- Układa napisy na osi czasu obok fali dźwięku. Bloki przesuwasz, rozciągasz i tniesz klawiszem S.
- Tekst i czasy poprawiasz też w liście po lewej. Ctrl+Z cofa wszystko.
- Pilnuje, żeby jeden napis nie łapał końca jednego zdania i początku drugiego. Inaczej tekst zaczyna się spóźniać za głosem.
- Podświetla słowo, które właśnie pada. Jak w rolkach.
- Styl ustawiasz w panelu po prawej: czcionka, kolor, tło, obrys, cień, animacja. Ulubiony zapisujesz jako preset.
- Eksportuje SRT, VTT, ASS albo od razu MP4 z wypalonymi napisami. Pionowe 9:16 też.

Na moim filmie 55 sekund pionowego wideo wypala się w niecałe 4 sekundy.

## Instalacja

Gotowy instalator jest w [Releases](https://github.com/brodatech-lab/subber/releases). ffmpeg jest w środku.

Potrzebujesz jeszcze Pythona 3.10 lub nowszego. Przy pierwszej transkrypcji Subber sam stawia sobie środowisko i ściąga model. To jednorazowo kilka GB, więc nie zdziw się, że pierwszy raz trwa dłużej.

Karta NVIDIA z CUDA 12 bardzo pomaga. Bez niej też zadziała, tylko na procesorze i wolniej.

Masz Nortona, Avasta albo firmowe proxy? Nic nie musisz robić. Subber bierze certyfikaty z Windowsa, więc ich skanowanie HTTPS nie blokuje pobierania.

## Skróty

| Klawisz | Co robi |
| --- | --- |
| Spacja | start / pauza |
| S | tnie napis w miejscu głowicy |
| Ctrl+Z, Ctrl+Y | cofnij, ponów |
| Delete | usuwa zaznaczony napis |
| ← → | głowica o 0,1 s, z Shiftem o 1 s |
| Ctrl + kółko | zoom osi czasu |

## Budowanie ze źródeł

Potrzebujesz Node 20+, Rusta i ffmpeg w PATH.

```bash
npm install
npm run tauri dev
```

Sam interfejs odpalisz w przeglądarce przez `npm run dev`. Transkrypcja jest wtedy udawana, ale cały edytor działa.

Testy uruchamiasz przez `npm test`, a instalator budujesz przez `npm run tauri build`.

## Wydania

Zwykłe pushe na `master` niczego nie budują. Paczka powstaje tylko z tagu wersji, na przykład `v0.2.0`. Wtedy GitHub Actions buduje instalator z ffmpeg w środku i wrzuca go do Releases.

Opis paczki to sekcja tej wersji w [CHANGELOG.md](CHANGELOG.md), po polsku i po angielsku. Zmiany dopisuję na bieżąco do `Unreleased`. Przy wydaniu robię tak:

1. Podbijam wersję w `package.json`, `src-tauri/tauri.conf.json` i `src-tauri/Cargo.toml`.
2. Przenoszę `Unreleased` pod nowy numer, w obu językach.
3. Commituję, wypycham i dodaję tag: `git tag v0.3.0 && git push origin v0.3.0`.

Jeśli tag nie zgadza się z wersją albo w CHANGELOG brakuje sekcji, workflow się zatrzyma i nic nie wyda.

## Jak to jest zbudowane

Tauri 2, React i TypeScript z przodu, Rust pod spodem. Rozpoznawaniem mowy zajmuje się osobny proces w Pythonie, [engine/stt_worker.py](engine/stt_worker.py). Dostaje plik audio i zwraca słowa z czasami. Dzięki temu silniki da się podmieniać bez ruszania reszty. Napisy wypala ffmpeg z libass.

- `src/lib`: formaty napisów, dzielenie słów na napisy, czas
- `src/ui`: interfejs, podzielony na atomy, molekuły i organizmy
- `src-tauri/src`: transkrypcja, eksport, klucze API

Klucze do OpenAI i Deepgrama trzymam w Menedżerze poświadczeń Windows, nie w plikach.

## Czego jeszcze nie ma

- Zaokrąglone tło widać tylko w podglądzie. W gotowym MP4 jest prostokątne, bo tak rysuje je format ASS. Wiem, jak to obejść, jeszcze tego nie zrobiłem.
- Tłumaczenie napisów na inne języki.
- Na razie tylko Windows.

Co się zmienia między wersjami, znajdziesz w [CHANGELOG.md](CHANGELOG.md).
