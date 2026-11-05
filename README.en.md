# Subber

[Polski](README.md) · **English**

Drop in a video and get subtitles back. Fix them on the timeline, style them, export.

I built Subber because I was tired of paying for cloud caption editors and uploading every recording to them. Here everything runs on your machine. Whisper runs on your GPU and the file never leaves your disk.

## What it does

- Transcribes speech. faster-whisper large-v3 on the GPU by default. WhisperX is there too, and OpenAI or Deepgram if you prefer the cloud.
- Puts the captions on a timeline next to the waveform. Drag them, stretch them, cut them with S.
- Lets you fix text and times in the list on the left. Ctrl+Z undoes everything.
- Never lets one caption hold the end of one sentence and the start of the next. Otherwise the text starts falling behind the voice.
- Highlights the word being spoken, like in short-form videos.
- Styles from the right panel: font, color, background, outline, shadow, animation. Save a look as a preset.
- Exports SRT, VTT, ASS, or an MP4 with burned-in captions. Vertical 9:16 works.

On my test video, 55 seconds of vertical footage burns in under 4 seconds.

## Install

Grab the installer from [Releases](https://github.com/brodatech-lab/subber/releases). It ships with ffmpeg.

You also need Python 3.10 or newer. On the first transcription Subber sets up its own environment and downloads the model. That is a one-time download of a few GB, so the first run takes longer.

An NVIDIA card with CUDA 12 helps a lot. Without one it still works on the CPU, just slower.

Running Norton, Avast or a corporate proxy? Nothing to do. Subber uses the Windows certificate store, so their HTTPS scanning does not break downloads.

## Shortcuts

| Key | What it does |
| --- | --- |
| Space | play / pause |
| S | cut the caption at the playhead |
| Ctrl+Z, Ctrl+Y | undo, redo |
| Delete | delete the selected caption |
| ← → | move the playhead 0.1 s, 1 s with Shift |
| Ctrl + wheel | zoom the timeline |

## Build from source

You need Node 20+, Rust and ffmpeg on PATH.

```bash
npm install
npm run tauri dev
```

`npm run dev` runs the UI alone in a browser. Transcription is faked there, the editor works fully.

`npm test` runs the tests, `npm run tauri build` builds the installer.

## Releases

Ordinary pushes to `master` build nothing. A package comes only from a version tag such as `v0.2.0`. Then GitHub Actions builds the installer with ffmpeg inside and publishes it to Releases.

The release description is that version's section of [CHANGELOG.md](CHANGELOG.md), in Polish and English. Changes go into `Unreleased` as they happen. To release:

1. Bump the version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`.
2. Move `Unreleased` under the new number, in both languages.
3. Commit, push and tag: `git tag v0.3.0 && git push origin v0.3.0`.

If the tag does not match the version or the CHANGELOG section is missing, the workflow stops and releases nothing.

## How it is built

Tauri 2, React and TypeScript on top, Rust underneath. Speech recognition runs in a separate Python process, [engine/stt_worker.py](engine/stt_worker.py). It takes an audio file and returns words with timestamps, so engines can be swapped without touching the rest. ffmpeg with libass burns the captions in.

- `src/lib`: subtitle formats, splitting words into captions, time
- `src/ui`: the interface, split into atoms, molecules and organisms
- `src-tauri/src`: transcription, export, API keys

OpenAI and Deepgram keys live in the Windows Credential Manager, not in files.

## Not there yet

- Rounded caption backgrounds only show in the preview. The exported MP4 gets a square box, because that is how the ASS format draws it. I know the workaround, just have not built it yet.
- Translation.
- Platforms other than Windows.

Changes between versions are in [CHANGELOG.md](CHANGELOG.md).
