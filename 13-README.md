# DJ Mix Studio

Free 2-deck DJ mixing app that runs in the browser (Android-first, installable as an APK wrapper later). Load your own songs, mix them live, and export the remix as an MP3 — no account, no server, no paid plan. Everything runs on the device.

**Live preview:** https://akash991833.github.io/dj-mix-studio-app/

## Features

- 2 decks: load your own audio files (MP3/WAV etc.) or tap DEMO for built-in practice beats
- Play / pause / cue, tap the waveform to seek
- TEMPO control (+-8%) with pitch compensation (SoundTouchJS audio worklet)
- HIGH / MID / LOW EQ knobs + FILTER sweep per deck
- A/B crossfader (equal-power), ECHO send, MASTER level
- 4-beat LOOP per deck
- Auto BPM estimate for loaded tracks
- RECORD your live mix and export it as a real MP3 file (WAV fallback)
- Dark and light themes, English UI, mobile portrait layout

## Screenshots

![Dark theme](dj-design-dark.png)
![Light theme](dj-design-light.png)
![Running mix](dj-live-running.png)

## Stack

- Plain HTML/CSS/JS, no framework
- Web Audio API (AudioContext + AudioWorklet) for the mixing engine
- [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) for tempo/pitch (MPL-2.0)
- [lamejs](https://github.com/zhuker/lamejs) for MP3 encoding (LGPL)
- Works offline after load; no data leaves the device

## Run locally

Serve the folder over any static server and open it on your phone or browser:

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

## Notes

- YouTube/online streaming songs cannot be mixed: YouTube's official terms do not allow extracting or modifying the audio. This app mixes audio files you already have on your device.
- Tested in desktop Chrome (automated engine + UI tests). Android WebView device testing is the next step.
