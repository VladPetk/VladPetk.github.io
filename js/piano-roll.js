/* ═══════════════════════════════════════════
   PIANO ROLL — Canvas-based MIDI visualization
   Scrolling view with piano-key strip, beat grid,
   prime/continuation divider, color-coded notes.
   ═══════════════════════════════════════════ */

class PianoRoll {
  constructor(canvasId, wrapperId) {
    this.canvas = document.getElementById(canvasId);
    this.wrapper = document.getElementById(wrapperId);
    this.ctx = this.canvas.getContext('2d');

    this.notes = [];
    this.duration = 0;
    this.primeDuration = 0;
    this.currentTime = 0;
    this.bpm = 120;
    this.beatsPerBar = 4;

    // Layout
    this.keyboardWidth = 40;
    this.pxPerSec = 80;
    this.scrollX = 0;
    this.noteRange = { min: 48, max: 84 };

    // Colors
    this.colors = {
      bg:             '#13161b',
      blackKeyRow:    'rgba(0, 0, 0, 0.18)',
      gridBeat:       'rgba(255, 255, 255, 0.025)',
      gridBar:        'rgba(255, 255, 255, 0.055)',
      gridOctave:     'rgba(255, 255, 255, 0.06)',
      divider:        'rgba(255, 255, 255, 0.18)',
      keyBg:          '#0f1115',
      whiteKey:       '#1a1d24',
      blackKey:       '#0c0e12',
      keyLabel:       'rgba(255, 255, 255, 0.28)',
      keyBorder:      'rgba(255, 255, 255, 0.07)',
      original:       { h: 222, s: 90, l: 70 },
      continuation:   { h: 172, s: 65, l: 60 },
      cursor:         '#5cd6c8',
      cursorGlow:     'rgba(92, 214, 200, 0.22)',
    };

    this._dpr = window.devicePixelRatio || 1;
    this.displayWidth = 0;
    this.displayHeight = 0;

    this._resize();
    this._onResize = this._debounce(() => this._resize(), 150);
    window.addEventListener('resize', this._onResize);

    // Click to seek
    this.onSeek = null;
    this.canvas.addEventListener('click', (e) => {
      if (!this.duration || !this.onSeek) return;
      const rect = this.canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      if (cssX < this.keyboardWidth) return;
      const noteAreaX = cssX - this.keyboardWidth;
      const time = (noteAreaX + this.scrollX) / this.pxPerSec;
      this.onSeek(Math.max(0, Math.min(time, this.duration)));
    });
  }

  /* ── Public API ── */

  setNotes(notes, duration, primeDuration, bpm, beatsPerBar) {
    this.notes = notes;
    this.duration = duration;
    this.primeDuration = primeDuration || 0;
    this.bpm = bpm || 120;
    this.beatsPerBar = beatsPerBar || 4;

    this._computeNoteRange();
    this._computeZoom();
    this.scrollX = 0;
    this.currentTime = 0;
    this.render();
  }

  updateCursor(time) {
    this.currentTime = time;
    this._autoScroll();
    this.render();
  }

  /* ── Layout Calculations ── */

  _computeNoteRange() {
    if (this.notes.length === 0) {
      this.noteRange = { min: 48, max: 84 };
      return;
    }
    let min = 127, max = 0;
    for (const n of this.notes) {
      if (n.midi < min) min = n.midi;
      if (n.midi > max) max = n.midi;
    }
    // Pad by a few semitones for breathing room
    this.noteRange = {
      min: Math.max(21, min - 3),
      max: Math.min(108, max + 3),
    };
  }

  _computeZoom() {
    const viewW = this.displayWidth - this.keyboardWidth;
    if (this.duration <= 0 || viewW <= 0) {
      this.pxPerSec = 80;
      return;
    }
    const fitAll = viewW / this.duration;
    const comfortable = viewW / 10; // ~10 seconds visible
    // Use comfortable zoom, or fit-all if the piece is short enough
    this.pxPerSec = Math.max(fitAll, Math.min(comfortable, 140));
  }

  _autoScroll() {
    const viewW = this.displayWidth - this.keyboardWidth;
    const totalW = this.duration * this.pxPerSec;
    if (totalW <= viewW) {
      this.scrollX = 0;
      return;
    }
    // Keep cursor at ~30% from left edge
    const cursorPx = this.currentTime * this.pxPerSec;
    const target = cursorPx - viewW * 0.3;
    this.scrollX = Math.max(0, Math.min(target, totalW - viewW));
  }

  /* ── Rendering ── */

  render() {
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;
    if (!w || !h) return;

    const noteSpan = this.noteRange.max - this.noteRange.min + 1;
    const noteH = h / noteSpan;
    const kw = this.keyboardWidth;
    const viewW = w - kw;

    // 1. Background
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, w, h);

    if (this.notes.length === 0 || this.duration === 0) return;

    // 2. Note area (clipped to right of keyboard)
    ctx.save();
    ctx.beginPath();
    ctx.rect(kw, 0, viewW, h);
    ctx.clip();

    this._drawBlackKeyRows(ctx, kw, viewW, h, noteH, noteSpan);
    this._drawGrid(ctx, kw, viewW, h, noteH);
    this._drawDivider(ctx, kw, h);
    this._drawNotes(ctx, kw, viewW, h, noteH);
    this._drawCursor(ctx, kw, viewW, h);

    ctx.restore();

    // 3. Piano key strip (drawn last, on top)
    this._drawKeyboard(ctx, kw, h, noteH, noteSpan);
  }

  _drawBlackKeyRows(ctx, kw, viewW, h, noteH, noteSpan) {
    ctx.fillStyle = this.colors.blackKeyRow;
    for (let i = 0; i < noteSpan; i++) {
      if (this._isBlackKey(this.noteRange.min + i)) {
        const y = h - (i + 1) * noteH;
        ctx.fillRect(kw, y, viewW, noteH);
      }
    }
  }

  _drawGrid(ctx, kw, viewW, h, noteH) {
    // Horizontal: octave lines at each C
    ctx.lineWidth = 0.5;
    for (let midi = this.noteRange.min; midi <= this.noteRange.max; midi++) {
      if (midi % 12 === 0) {
        ctx.strokeStyle = this.colors.gridOctave;
        const i = midi - this.noteRange.min;
        const y = h - i * noteH;
        ctx.beginPath();
        ctx.moveTo(kw, y);
        ctx.lineTo(kw + viewW, y);
        ctx.stroke();
      }
    }

    // Vertical: beat and bar lines
    const beatDur = 60 / this.bpm;
    const viewStartTime = this.scrollX / this.pxPerSec;
    const viewEndTime = (this.scrollX + viewW) / this.pxPerSec;

    const firstBeat = Math.floor(viewStartTime / beatDur);
    const lastBeat = Math.ceil(viewEndTime / beatDur);

    for (let b = firstBeat; b <= lastBeat; b++) {
      if (b < 0) continue;
      const t = b * beatDur;
      const x = kw + t * this.pxPerSec - this.scrollX;
      const isBar = b % this.beatsPerBar === 0;

      ctx.strokeStyle = isBar ? this.colors.gridBar : this.colors.gridBeat;
      ctx.lineWidth = isBar ? 0.8 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  _drawDivider(ctx, kw, h) {
    if (this.primeDuration <= 0) return;

    const x = kw + this.primeDuration * this.pxPerSec - this.scrollX;

    // Dashed line
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = this.colors.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.restore();

    // Labels
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(111, 163, 247, 0.35)';
    ctx.textAlign = 'right';
    ctx.fillText('prime', x - 6, 14);
    ctx.fillStyle = 'rgba(92, 214, 200, 0.35)';
    ctx.textAlign = 'left';
    ctx.fillText('continuation', x + 6, 14);
  }

  _drawNotes(ctx, kw, viewW, h, noteH) {
    const viewStartTime = this.scrollX / this.pxPerSec;
    const viewEndTime = (this.scrollX + viewW) / this.pxPerSec;

    // Draw in two passes (original then continuation) to batch fillStyle changes
    for (const source of ['original', 'continuation']) {
      const pal = this.colors[source];

      for (const note of this.notes) {
        if (note.source !== source) continue;

        // Cull notes outside viewport
        if (note.time + note.duration < viewStartTime) continue;
        if (note.time > viewEndTime) continue;

        const x = kw + note.time * this.pxPerSec - this.scrollX;
        const noteW = Math.max(2, note.duration * this.pxPerSec);
        const i = note.midi - this.noteRange.min;
        const y = h - (i + 1) * noteH;
        const r = Math.min(2, noteH / 3, noteW / 3);

        const vel = 0.4 + note.velocity * 0.6;
        const isActive =
          this.currentTime >= note.time &&
          this.currentTime <= note.time + note.duration;

        if (isActive) {
          ctx.fillStyle = `hsla(${pal.h}, ${pal.s}%, ${pal.l + 15}%, 1)`;
          ctx.shadowColor = `hsla(${pal.h}, ${pal.s}%, ${pal.l}%, 0.5)`;
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = `hsla(${pal.h}, ${pal.s}%, ${pal.l}%, ${vel})`;
          ctx.shadowBlur = 0;
        }

        this._roundRect(ctx, x, y + 0.5, noteW, noteH - 1, r);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  _drawCursor(ctx, kw, viewW, h) {
    if (this.duration <= 0) return;

    const cx = kw + this.currentTime * this.pxPerSec - this.scrollX;
    if (cx < kw || cx > kw + viewW) return;

    // Glow
    const grad = ctx.createLinearGradient(cx - 15, 0, cx + 15, 0);
    grad.addColorStop(0, 'rgba(92, 214, 200, 0)');
    grad.addColorStop(0.5, this.colors.cursorGlow);
    grad.addColorStop(1, 'rgba(92, 214, 200, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 15, 0, 30, h);

    // Line
    ctx.strokeStyle = this.colors.cursor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();
  }

  _drawKeyboard(ctx, kw, h, noteH, noteSpan) {
    // Solid background to cover any note bleed
    ctx.fillStyle = this.colors.keyBg;
    ctx.fillRect(0, 0, kw, h);

    // Separator line
    ctx.strokeStyle = this.colors.keyBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(kw - 0.5, 0);
    ctx.lineTo(kw - 0.5, h);
    ctx.stroke();

    // Individual key rows
    for (let i = 0; i < noteSpan; i++) {
      const midi = this.noteRange.min + i;
      const y = h - (i + 1) * noteH;
      const isBlack = this._isBlackKey(midi);

      ctx.fillStyle = isBlack ? this.colors.blackKey : this.colors.whiteKey;
      ctx.fillRect(0, y + 0.5, kw - 1, noteH - 1);

      // Label C notes
      if (midi % 12 === 0) {
        const octave = Math.floor(midi / 12) - 1;
        ctx.fillStyle = this.colors.keyLabel;
        const fontSize = Math.min(10, Math.max(7, noteH - 2));
        ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`C${octave}`, kw - 4, y + noteH / 2);
      }
    }
  }

  /* ── Helpers ── */

  _isBlackKey(midi) {
    const pc = midi % 12;
    return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
  }

  _roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    if (r < 0) r = 0;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _resize() {
    const rect = this.wrapper.getBoundingClientRect();
    this._dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * this._dpr;
    this.canvas.height = rect.height * this._dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    this.displayWidth = rect.width;
    this.displayHeight = rect.height;
    this._computeZoom();
    this.render();
  }

  _debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
  }
}
