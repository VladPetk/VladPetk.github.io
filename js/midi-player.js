/* ═══════════════════════════════════════════
   MIDI PLAYER — Tone.js playback engine
   Loads MIDI files, synthesizes piano audio,
   manages transport (play/pause/stop/seek).
   ═══════════════════════════════════════════ */

class MidiPlayer {
  constructor() {
    this.sampler = null;
    this.scheduledEvents = [];
    this.notes = [];
    this.duration = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.startedAt = 0;     // Tone.now() when playback started
    this.pausedAt = 0;      // elapsed seconds when paused
    this.animFrameId = null;

    // Callbacks
    this.onTimeUpdate = null;   // (currentTime, duration) => void
    this.onPlayStateChange = null; // (isPlaying) => void
    this.onLoadStart = null;
    this.onLoadEnd = null;

    this._initSampler();
  }

  _initSampler() {
    // Use Salamander grand piano samples from Tone.js CDN
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
      release: 1,
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
    }).toDestination();
  }

  async waitForLoad() {
    return Tone.loaded();
  }

  /**
   * Load a track (original + optional continuation).
   * Returns { notes, duration } where notes have: midi, time, duration, velocity, source
   */
  async loadTrack(originalUrl, continuationUrl) {
    if (this.onLoadStart) this.onLoadStart();
    this.stop();

    try {
      const originalMidi = await Midi.fromUrl(originalUrl);
      let allNotes = this._extractNotes(originalMidi, 'original', 0);
      let totalDuration = originalMidi.duration;

      if (continuationUrl) {
        const contMidi = await Midi.fromUrl(continuationUrl);
        const contNotes = this._extractNotes(contMidi, 'continuation', 0);
        allNotes = allNotes.concat(contNotes);
        totalDuration = Math.max(totalDuration, contMidi.duration);
      }

      // Sort by time
      allNotes.sort((a, b) => a.time - b.time);

      this.notes = allNotes;
      this.duration = totalDuration;

      if (this.onLoadEnd) this.onLoadEnd();
      return { notes: this.notes, duration: this.duration };
    } catch (err) {
      console.error('Failed to load MIDI:', err);
      if (this.onLoadEnd) this.onLoadEnd();
      throw err;
    }
  }

  _extractNotes(midi, source, timeOffset) {
    const notes = [];
    midi.tracks.forEach((track, trackIdx) => {
      track.notes.forEach(note => {
        notes.push({
          midi: note.midi,
          time: note.time + timeOffset,
          duration: note.duration,
          velocity: note.velocity,
          source: source,
          trackIdx: trackIdx,
        });
      });
    });
    return notes;
  }

  async play() {
    if (this.notes.length === 0) return;

    await Tone.start();
    await this.waitForLoad();

    if (this.isPaused) {
      // Resume from paused position
      this._scheduleNotes(this.pausedAt);
      this.startedAt = Tone.now() - this.pausedAt;
      this.isPaused = false;
    } else {
      this._scheduleNotes(0);
      this.startedAt = Tone.now();
    }

    this.isPlaying = true;
    if (this.onPlayStateChange) this.onPlayStateChange(true);
    this._startUpdateLoop();
  }

  _scheduleNotes(fromTime) {
    // Clear any previously scheduled
    this._clearScheduled();

    const now = Tone.now();
    this.notes.forEach(note => {
      if (note.time < fromTime) return;

      const delay = note.time - fromTime;
      const freq = Tone.Frequency(note.midi, 'midi').toFrequency();
      const dur = Math.min(note.duration, 4); // Cap at 4 seconds
      const vel = note.velocity * 0.8; // Scale down slightly

      const id = Tone.Transport.schedule(() => {
        try {
          this.sampler.triggerAttackRelease(freq, dur, undefined, vel);
        } catch(e) {
          // Silently ignore if sampler is busy
        }
      }, `+${delay}`);

      this.scheduledEvents.push(id);
    });

    Tone.Transport.start();
  }

  _clearScheduled() {
    this.scheduledEvents.forEach(id => {
      try { Tone.Transport.clear(id); } catch(e) {}
    });
    this.scheduledEvents = [];
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }

  pause() {
    if (!this.isPlaying) return;
    this.pausedAt = this.getCurrentTime();
    this._clearScheduled();
    this.sampler.releaseAll();
    this.isPlaying = false;
    this.isPaused = true;
    if (this.onPlayStateChange) this.onPlayStateChange(false);
    this._stopUpdateLoop();
  }

  stop() {
    this._clearScheduled();
    if (this.sampler) this.sampler.releaseAll();
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAt = 0;
    this.startedAt = 0;
    if (this.onPlayStateChange) this.onPlayStateChange(false);
    if (this.onTimeUpdate) this.onTimeUpdate(0, this.duration);
    this._stopUpdateLoop();
  }

  seek(time) {
    const wasPlaying = this.isPlaying;
    this._clearScheduled();
    this.sampler.releaseAll();

    time = Math.max(0, Math.min(time, this.duration));

    if (wasPlaying) {
      this._scheduleNotes(time);
      this.startedAt = Tone.now() - time;
      this._startUpdateLoop();
    } else {
      this.pausedAt = time;
      this.isPaused = true;
      if (this.onTimeUpdate) this.onTimeUpdate(time, this.duration);
    }
  }

  getCurrentTime() {
    if (this.isPlaying) {
      return Math.min(Tone.now() - this.startedAt, this.duration);
    }
    return this.pausedAt;
  }

  _startUpdateLoop() {
    this._stopUpdateLoop();
    const tick = () => {
      if (!this.isPlaying) return;
      const t = this.getCurrentTime();
      if (this.onTimeUpdate) this.onTimeUpdate(t, this.duration);

      // Auto-stop at end
      if (t >= this.duration) {
        this.stop();
        return;
      }
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  _stopUpdateLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
