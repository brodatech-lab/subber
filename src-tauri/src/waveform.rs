use std::io::{BufReader, Read};
use std::process::Stdio;

use crate::tools::{ffmpeg, hidden_command};

/// Audio is decoded at this rate for the waveform only; enough for peaks, tiny for memory.
const SAMPLE_RATE: usize = 8000;
/// Waveform resolution: one peak per 10 ms.
pub const PEAKS_PER_SECOND: usize = 100;

/// Keeps the loudest sample of every `window` samples.
struct PeakCollector {
    window: usize,
    filled: usize,
    current: i32,
    peaks: Vec<f32>,
}

impl PeakCollector {
    fn new(window: usize) -> Self {
        Self { window, filled: 0, current: 0, peaks: Vec::new() }
    }

    fn push(&mut self, sample: i16) {
        self.current = self.current.max(i32::from(sample).abs());
        self.filled += 1;
        if self.filled == self.window {
            self.peaks.push(self.current as f32);
            self.current = 0;
            self.filled = 0;
        }
    }

    fn finish(mut self) -> Vec<f32> {
        if self.filled > 0 {
            self.peaks.push(self.current as f32);
        }
        self.peaks
    }
}

/// Streams the audio track through ffmpeg and keeps one peak per window, so memory use stays flat
/// no matter how big the video is. Loading the whole file in the webview crashed it on ~1 GB inputs.
fn peaks(path: &str) -> Result<Vec<f32>, String> {
    let mut child = hidden_command(ffmpeg()?)
        .args(["-hide_banner", "-loglevel", "error", "-i", path, "-vn", "-ac", "1"])
        .args(["-ar", &SAMPLE_RATE.to_string(), "-f", "s16le", "pipe:1"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Nie udało się uruchomić ffmpeg: {e}"))?;

    let mut reader = BufReader::with_capacity(1 << 16, child.stdout.take().ok_or("Brak wyjścia ffmpeg")?);
    let mut collector = PeakCollector::new(SAMPLE_RATE / PEAKS_PER_SECOND);
    let mut buffer = vec![0u8; 1 << 16];
    // A read can end in the middle of a 16-bit sample; keep that byte for the next read.
    let mut carry: Option<u8> = None;

    loop {
        let read = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        let mut bytes = &buffer[..read];
        if let Some(low) = carry.take() {
            collector.push(i16::from_le_bytes([low, bytes[0]]));
            bytes = &bytes[1..];
        }
        let pairs = bytes.chunks_exact(2);
        carry = pairs.remainder().first().copied();
        for pair in pairs {
            collector.push(i16::from_le_bytes([pair[0], pair[1]]));
        }
    }
    let _ = child.wait();
    let mut result = collector.finish();

    let max = result.iter().copied().fold(0.0f32, f32::max);
    if max > 0.0 {
        result.iter_mut().for_each(|p| *p /= max);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collector_keeps_window_maximum() {
        let mut c = PeakCollector::new(3);
        [1, -5, 2, 7, 0, -1, 4].into_iter().for_each(|s| c.push(s));
        assert_eq!(c.finish(), vec![5.0, 7.0, 4.0]);
    }

    /// Run with `SUBBER_TEST_VIDEO=path cargo test -- --ignored` against a large real file.
    #[test]
    #[ignore]
    fn streams_large_video() {
        let path = std::env::var("SUBBER_TEST_VIDEO").expect("set SUBBER_TEST_VIDEO");
        let started = std::time::Instant::now();
        let result = peaks(&path).expect("peaks");
        println!("{} peaks in {:.1}s", result.len(), started.elapsed().as_secs_f32());
        assert!(!result.is_empty());
        assert!(result.iter().all(|p| (0.0..=1.0).contains(p)));
    }
}

#[tauri::command]
pub async fn waveform_peaks(path: String) -> Result<Vec<f32>, String> {
    tauri::async_runtime::spawn_blocking(move || peaks(&path)).await.map_err(|e| e.to_string())?
}
