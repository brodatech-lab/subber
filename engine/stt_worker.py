"""Subber speech-to-text worker.

Reads a 16 kHz mono WAV and prints JSON lines on stdout:
  {"type": "progress", "stage": str, "percent": float}
  {"type": "result", "words": [{"text": str, "start": float, "end": float}, ...]}
  {"type": "error", "message": str}

Usage: python stt_worker.py --engine faster-whisper --model large-v3 --language pl --audio path.wav
Cloud keys come from SUBBER_OPENAI_KEY / SUBBER_DEEPGRAM_KEY environment variables.
"""
import argparse
import json
import os
import sys


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def progress(stage, percent):
    emit({"type": "progress", "stage": stage, "percent": percent})


def word(text, start, end):
    return {"text": text.strip(), "start": round(float(start), 3), "end": round(float(end), 3)}


def language_arg(language):
    return None if language == "auto" else language


def audio_duration(path):
    import wave

    with wave.open(path, "rb") as f:
        return f.getnframes() / float(f.getframerate())


def run_faster_whisper(args):
    from faster_whisper import WhisperModel

    progress("Ładowanie modelu " + args.model, 5)
    try:
        model = WhisperModel(args.model, device="cuda", compute_type="float16")
    except Exception:
        progress("Brak CUDA, przełączam na procesor", 8)
        model = WhisperModel(args.model, device="cpu", compute_type="int8")
    total = max(audio_duration(args.audio), 0.001)
    segments, _ = model.transcribe(
        args.audio,
        language=language_arg(args.language),
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
    )
    words = []
    for segment in segments:
        for w in segment.words or []:
            if w.word.strip():
                words.append(word(w.word, w.start, w.end))
        progress("Transkrypcja", 10 + 88 * min(1.0, segment.end / total))
    return words


def run_whisperx(args):
    import whisperx

    device = "cuda"
    progress("Ładowanie modelu " + args.model, 5)
    try:
        model = whisperx.load_model(args.model, device, compute_type="float16", language=language_arg(args.language))
    except Exception:
        device = "cpu"
        model = whisperx.load_model(args.model, device, compute_type="int8", language=language_arg(args.language))
    audio = whisperx.load_audio(args.audio)
    progress("Transkrypcja", 20)
    result = model.transcribe(audio, batch_size=16)
    progress("Wyrównanie słów", 70)
    align_model, metadata = whisperx.load_align_model(language_code=result["language"], device=device)
    aligned = whisperx.align(result["segments"], align_model, metadata, audio, device)
    words = []
    for w in aligned.get("word_segments", []):
        if "start" in w and "end" in w and w.get("word", "").strip():
            words.append(word(w["word"], w["start"], w["end"]))
    return words


def run_openai(args):
    import requests

    key = os.environ.get("SUBBER_OPENAI_KEY")
    if not key:
        raise RuntimeError("Brak klucza OpenAI. Dodaj go w ustawieniach silników.")
    progress("Wysyłanie audio do OpenAI", 20)
    data = {"model": args.model, "response_format": "verbose_json", "timestamp_granularities[]": "word"}
    if args.language != "auto":
        data["language"] = args.language
    with open(args.audio, "rb") as f:
        response = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": "Bearer " + key},
            data=data,
            files={"file": ("audio.wav", f, "audio/wav")},
            timeout=600,
        )
    if response.status_code != 200:
        raise RuntimeError("OpenAI zwróciło błąd " + str(response.status_code) + ": " + response.text[:300])
    return [word(w["word"], w["start"], w["end"]) for w in response.json().get("words", [])]


def run_deepgram(args):
    import requests

    key = os.environ.get("SUBBER_DEEPGRAM_KEY")
    if not key:
        raise RuntimeError("Brak klucza Deepgram. Dodaj go w ustawieniach silników.")
    progress("Wysyłanie audio do Deepgram", 20)
    params = {"model": args.model, "smart_format": "true", "punctuate": "true"}
    if args.language == "auto":
        params["detect_language"] = "true"
    else:
        params["language"] = args.language
    with open(args.audio, "rb") as f:
        response = requests.post(
            "https://api.deepgram.com/v1/listen",
            params=params,
            headers={"Authorization": "Token " + key, "Content-Type": "audio/wav"},
            data=f,
            timeout=600,
        )
    if response.status_code != 200:
        raise RuntimeError("Deepgram zwrócił błąd " + str(response.status_code) + ": " + response.text[:300])
    alt = response.json()["results"]["channels"][0]["alternatives"][0]
    return [word(w.get("punctuated_word", w["word"]), w["start"], w["end"]) for w in alt.get("words", [])]


ENGINES = {
    "faster-whisper": run_faster_whisper,
    "whisperx": run_whisperx,
    "openai": run_openai,
    "deepgram": run_deepgram,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", required=True, choices=sorted(ENGINES))
    parser.add_argument("--model", required=True)
    parser.add_argument("--language", default="pl")
    parser.add_argument("--audio", required=True)
    args = parser.parse_args()
    try:
        words = ENGINES[args.engine](args)
        progress("Gotowe", 100)
        emit({"type": "result", "words": words})
    except Exception as exc:  # reported to the UI as a readable message
        emit({"type": "error", "message": str(exc)})
        sys.exit(1)


if __name__ == "__main__":
    main()
