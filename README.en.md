# Subber

[Polski](README.md) · **English**

Subber is a desktop video subtitle editor. It provides speech transcription, timeline-based subtitle editing, styling, and export to common subtitle and video formats.

The project was created as an alternative to cloud-based subtitle editors that require recordings to be uploaded to external servers. Subber processes files locally: by default, Whisper runs on the GPU, and recordings stay on the user's computer.

## Features

- **Automatic transcription** — faster-whisper large-v3 runs on the GPU by default. WhisperX is also available, as are the cloud services OpenAI and Deepgram.
- **Timeline editing** — subtitles appear alongside the audio waveform. Move and resize subtitle blocks, or split them at the playhead by pressing `S`.
- **Text and timestamp editing** — edit subtitle content and timing in the list on the left. Undo and redo are supported (`Ctrl+Z`, `Ctrl+Y`).
- **Subtitle segmentation** — Subber prevents a single subtitle from containing the end of one sentence and the beginning of the next.
- **Active-word highlighting** — highlights the word currently being spoken, a style commonly used in short-form videos.
- **Subtitle styling** — adjust the font, text color, background, outline, shadow, and animation in the styling panel. Save configurations as presets.
- **Export** — export to SRT, VTT, or ASS, or create an MP4 with burned-in subtitles. Vertical 9:16 video is supported.

In one test, burning subtitles into a 55-second vertical video took less than 4 seconds.

## Installation

Download the installer from [Releases](https://github.com/brodatech-lab/subber/releases). The installer includes ffmpeg.

**Python 3.10 or newer** is also required. During the first transcription, Subber creates its own environment and downloads the model. This is a one-time download of several gigabytes, so the initial setup may take longer.

An **NVIDIA GPU with CUDA 12 support** can significantly speed up processing. Subber also works without one, using the CPU instead, but transcription will be slower.

Subber uses the Windows certificate store. As a result, HTTPS inspection by tools such as Norton and Avast, as well as corporate proxies, should not interfere with downloads.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `S` | Split the subtitle at the playhead |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Delete` | Delete the selected subtitle |
| `←` / `→` | Move the playhead by 0.1 s; hold `Shift` to move by 1 s |
| `Ctrl` + mouse wheel | Zoom the timeline in / out |

## Build from source

Requirements:

- Node.js 20 or newer
- Rust
- ffmpeg available on `PATH`

To install dependencies and start the Tauri development build:

```bash
npm install
npm run tauri dev
```

To run the UI alone in a browser:

```bash
npm run dev
```

Transcription is simulated in this mode; the editor itself remains fully functional.

Run the tests with `npm test`. Build the installer with:

```bash
npm run tauri build
```

## Release process

Pushing ordinary commits to `master` does not trigger a build. An installer is built only when a version tag, such as `v0.2.0`, is pushed. GitHub Actions then builds the installer with ffmpeg bundled and publishes it to Releases.

The release description is taken from the corresponding section in [CHANGELOG.md](CHANGELOG.md), which is maintained in Polish and English. Add ongoing changes to the `Unreleased` section.

To prepare a release:

1. Update the version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. Move the entries from `Unreleased` into the new version's section in both languages.
3. Commit and push the changes, then create and push the version tag, for example:

   ```bash
   git tag v0.3.0 && git push origin v0.3.0
   ```

If the tag does not match the project version or the corresponding CHANGELOG.md section is missing, the workflow stops and no release is published.

## Architecture

Subber is built with **Tauri 2**, **React**, and **TypeScript** for the UI, with **Rust** handling the application logic.

Speech recognition runs in a separate Python process: [engine/stt_worker.py](engine/stt_worker.py). It receives an audio file and returns recognized words with timestamps. This separation makes it possible to switch transcription engines without changing the rest of the application. Subtitles are burned into video using ffmpeg with libass.

Key directories:

- `src/lib` — subtitle formats, splitting words into subtitles, and time handling
- `src/ui` — the user interface, organized into atoms, molecules, and organisms
- `src-tauri/src` — transcription, export, and API key handling

OpenAI and Deepgram API keys are stored in the Windows Credential Manager rather than in application files.

## Limitations and future work

- Rounded subtitle backgrounds are visible in the preview, but appear as rectangular boxes in exported MP4 files. This is due to how the ASS format renders backgrounds.
- Subtitle translation is not currently supported.
- Subber is currently available for Windows only.

See [CHANGELOG.md](CHANGELOG.md) for changes between versions.
