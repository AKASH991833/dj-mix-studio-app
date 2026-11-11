# DJ Mix Studio

Free 2-deck DJ mixing app that runs in the browser (Android-first, installable as an APK wrapper later). Load your own songs, mix them live, and export the remix as an MP3 - no account, no server, no paid plan. Everything runs on the device.

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

![Dark theme](14-dj-design-dark.png)
![Light theme](15-dj-design-light.png)
![Running mix](16-dj-live-running.png)

## Stack

- Plain HTML/CSS/JS, no framework
- Web Audio API (AudioContext + AudioWorklet) for the mixing engine
- [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) for tempo/pitch (MPL-2.0)
- [lamejs](https://github.com/zhuker/lamejs) for MP3 encoding (LGPL)
- Audio processing is local. This preview must first be loaded over HTTPS; persistent offline installation is not implemented yet.

## Run locally

Serve the folder over any static server and open it on your phone or browser:

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

## Notes

- This preview does not mix YouTube/streaming audio: YouTube's official terms do not allow extracting or modifying the audio. This app mixes audio files you already have on your device.
- Tested in desktop Chrome (automated engine + UI tests). Android WebView device testing is the next step.

## Third-party licenses

SoundTouchJS is included without changes under MPL-2.0. Its bundled source appears in `11-app.js`; upstream source: https://github.com/cutterbl/SoundTouchJS .

lamejs is included without changes in `12-lame.min.js` under its upstream LGPL license. Corresponding source: https://github.com/zhuker/lamejs .

### SoundTouchJS MPL-2.0

```text
Mozilla Public License Version 2.0

This package is licensed under the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

Full license text: https://www.mozilla.org/en-US/MPL/2.0/

```
### lamejs license

```text
Can I use LAME in my commercial program?  

Yes, you can, under the restrictions of the LGPL.  The easiest
way to do this is to:

1. Link to LAME as separate jar (lame.min.js or lame.all.js)

2. Fully acknowledge that you are using LAME, and give a link
   to our web site, lame.sourceforge.net

3. If you make modifications to LAME, you *must* release these
   these modifications back to the LAME project, under the LGPL.

```
