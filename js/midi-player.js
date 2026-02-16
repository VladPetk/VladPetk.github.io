/* ═══════════════════════════════════════════
   MIDI PLAYER — Tone.js playback engine
   Loads MIDI via @tonejs/midi, schedules notes
   on Tone.Transport for sample-accurate timing,
   synthesizes with Salamander grand piano.
   ═══════════════════════════════════════════ */

class MidiPlayer {
  constructor() {
    this.sampler = null;
    this.scheduledIds = [];
    this.notes = [];
    this.duration = 0;
    this.primeDuration = 0;
    this.bpm = 120;
    this.beatsPerBar = 4;

    this.isPlaying = false;
    this.isPaused = false;
    this._pausedTime = 0;
    this._animId = null;

    // Callbacks
    this.onTimeUpdate = null;
    this.onPlayStateChange = null;
    this.onLoadStart = null;
    this.onLoadEnd = null;

    this._initSampler();
  }

  /* ── Sampler Setup ── */

  _initSampler() {
    this.sampler = new Tone.Sampler({
      urls: {
        A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
        A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
        A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
        A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
        A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
        A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
        A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
        A7: 'A7.mp3', C8: 'C8.mp3',
      },
      release: 1.5,
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
    }).toDestination();
  }

  /* ── Track Loading ── */

  async loadTrack(combinedUrl, primeUrl) {
    if (this.onLoadStart) this.onLoadStart();
    this.stop();

    try {
      const [combinedMidi, primeMidi] = await Promise.all([
        Midi.fromUrl(combinedUrl),
        Midi.fromUrl(primeUrl),
      ]);

      this.primeDuration = primeMidi.duration;
      this.notes = this._extractNotes(combinedMidi, this.primeDuration);
      this.duration = combinedMidi.duration;

      // Extract tempo and time signature from MIDI header
      const tempos = combinedMidi.header.tempos;
      this.bpm = tempos.length > 0 ? tempos[0].bpm : 120;
      const timeSigs = combinedMidi.header.timeSignatures;
      this.beatsPerBar = timeSigs.length > 0 ? timeSigs[0].timeSignature[0] : 4;

      if (this.onLoadEnd) this.onLoadEnd();
      return {
        notes: this.notes,
        duration: this.duration,
        primeDuration: this.primeDuration,
        bpm: this.bpm,
        beatsPerBar: this.beatsPerBar,
      };
    } catch (err) {
      console.error('Failed to load MIDI:', err);
      if (this.onLoadEnd) this.onLoadEnd();
      throw err;
    }
  }

  _extractNotes(midi, primeDuration) {
    const notes = [];
    midi.tracks.forEach((track, trackIdx) => {
      track.notes.forEach(note => {
        notes.push({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity,
          source: note.time < primeDuration ? 'original' : 'continuation',
          trackIdx,
        });
      });
    });
    return notes.sort((a, b) => a.time - b.time);
  }

  /* ── Transport Scheduling ──
     Key insight: Schedule notes at ABSOLUTE Transport positions.
     The Transport callback provides a precise audioTime parameter —
     always pass it to triggerAttackRelease for sample-accurate playback.
     Never rely on "now" or undefined timing. */

  _scheduleFrom(fromTime) {
    this._clearScheduled();

    for (const note of this.notes) {
      // Skip notes that have already fully elapsed
      if (note.time + note.duration <= fromTime) continue;

      const id = Tone.Transport.schedule((audioTime) => {
        try {
          this.sampler.triggerAttackRelease(
            Tone.Frequency(note.midi, 'midi'),
            Math.min(note.duration, 8),
            audioTime,                          // Precise Web Audio time
            this._velocityCurve(note.velocity),
          );
        } catch (e) {
          // Sampler polyphony limit — silently skip
        }
      }, note.time); // Absolute position on Transport timeline

      this.scheduledIds.push(id);
    }
  }

  _clearScheduled() {
    for (const id of this.scheduledIds) {
      try { Tone.Transport.clear(id); } catch (e) {}
    }
    this.scheduledIds = [];
    Tone.Transport.cancel();
  }

  _velocityCurve(v) {
    // Slight compression for more natural dynamics
    return Math.pow(v, 0.8) * 0.75;
  }

  /* ── Playback Controls ── */

  async play() {
    if (this.notes.length === 0) return;

    await Tone.start();
    await Tone.loaded();

    const startFrom = this.isPaused ? this._pausedTime : 0;

    // Always: stop → clear → reschedule → start.
    // This avoids stale events and Transport state confusion.
    Tone.Transport.stop();
    this._scheduleFrom(startFrom);
    // Small lookahead (+0.02) gives the audio thread time to buffer
    Tone.Transport.start('+0.02', startFrom);

    this.isPlaying = true;
    this.isPaused = false;
    if (this.onPlayStateChange) this.onPlayStateChange(true);
    this._startTicker();
  }

  pause() {
    if (!this.isPlaying) return;

    this._pausedTime = Tone.Transport.seconds;
    Tone.Transport.pause();
    this.sampler.releaseAll();

    this.isPlaying = false;
    this.isPaused = true;
    if (this.onPlayStateChange) this.onPlayStateChange(false);
    this._stopTicker();
  }

  stop() {
    Tone.Transport.stop();
    this._clearScheduled();
    if (this.sampler) this.sampler.releaseAll();

    this.isPlaying = false;
    this.isPaused = false;
    this._pausedTime = 0;
    if (this.onPlayStateChange) this.onPlayStateChange(false);
    if (this.onTimeUpdate) this.onTimeUpdate(0, this.duration);
    this._stopTicker();
  }

  seek(time) {
    time = Math.max(0, Math.min(time, this.duration));
    const wasPlaying = this.isPlaying;

    Tone.Transport.stop();
    this.sampler.releaseAll();
    this._scheduleFrom(time);

    if (wasPlaying) {
      Tone.Transport.start('+0.02', time);
      this.isPlaying = true;
      this.isPaused = false;
      this._startTicker();
    } else {
      this._pausedTime = time;
      this.isPaused = true;
      if (this.onTimeUpdate) this.onTimeUpdate(time, this.duration);
    }
  }

  getCurrentTime() {
    if (this.isPlaying) {
      return Math.min(Tone.Transport.seconds, this.duration);
    }
    return this._pausedTime;
  }

  /* ── Update Loop ── */

  _startTicker() {
    this._stopTicker();
    const tick = () => {
      if (!this.isPlaying) return;
      const t = this.getCurrentTime();
      if (this.onTimeUpdate) this.onTimeUpdate(t, this.duration);
      if (t >= this.duration) {
        this.stop();
        return;
      }
      this._animId = requestAnimationFrame(tick);
    };
    this._animId = requestAnimationFrame(tick);
  }

  _stopTicker() {
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }
}
