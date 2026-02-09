/* ═══════════════════════════════════════════
   PIANO ROLL — Canvas-based MIDI visualization
   Draws notes as rounded rectangles,
   color-coded by source (original/continuation).
   Animated playback cursor with glow.
   ═══════════════════════════════════════════ */

class PianoRoll {
  constructor(canvasId, wrapperId) {
    this.canvas = document.getElementById(canvasId);
    this.wrapper = document.getElementById(wrapperId);
    this.ctx = this.canvas.getContext('2d');

    this.notes = [];
    this.duration = 0;
    this.currentTime = 0;

    // Visual config
    this.colors = {
      bg: '#13161b',
      gridLine: 'rgba(92, 214, 200, 0.04)',
      gridLineStrong: 'rgba(92, 214, 200, 0.07)',
      original: { h: 222, s: 90, l: 70 },      // Blue
      continuation: { h: 172, s: 65, l: 70 },   // Teal
      cursor: '#5cd6c8',
      cursorGlow: 'rgba(92, 214, 200, 0.3)',
      activeNote: '#ffffff',
    };

    this.padding = { top: 8, bottom: 8, left: 0, right: 0 };
    this.noteRange = { min: 21, max: 108 }; // Piano range

    this._resize();
    this._onResize = this._debounce(() => this._resize(), 150);
    window.addEventListener('resize', this._onResize);

    // Click to seek
    this.onSeek = null;
    this.canvas.addEventListener('click', (e) => {
      if (!this.duration || !this.onSeek) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const time = (x / this.canvas.width) * this.duration;
      this.onSeek(Math.max(0, Math.min(time, this.duration)));
    });
  }

  _debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  }

  _resize() {
    const rect = this.wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.displayWidth = rect.width;
    this.displayHeight = rect.height;
    this.render();
  }

  setNotes(notes, duration) {
    this.notes = notes;
    this.duration = duration;

    // Calculate actual note range from data
    if (notes.length > 0) {
      let min = 127, max = 0;
      notes.forEach(n => {
        if (n.midi < min) min = n.midi;
        if (n.midi > max) max = n.midi;
      });
      this.noteRange.min = Math.max(21, min - 2);
      this.noteRange.max = Math.min(108, max + 2);
    }

    this.render();
  }

  updateCursor(time) {
    this.currentTime = time;
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;

    if (!w || !h) return;

    // Clear
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, w, h);

    if (this.notes.length === 0 || this.duration === 0) return;

    const drawW = w - this.padding.left - this.padding.right;
    const drawH = h - this.padding.top - this.padding.bottom;
    const noteSpan = this.noteRange.max - this.noteRange.min + 1;
    const noteH = Math.max(2, drawH / noteSpan);
    const pxPerSec = drawW / this.duration;

    // Grid lines (pitch)
    ctx.lineWidth = 0.5;
    for (let midi = this.noteRange.min; midi <= this.noteRange.max; midi++) {
      if (midi % 12 === 0) { // Every octave (C)
        ctx.strokeStyle = this.colors.gridLineStrong;
      } else {
        continue; // Only draw octave lines for cleanliness
      }
      const y = this.padding.top + drawH - (midi - this.noteRange.min) * noteH;
      ctx.beginPath();
      ctx.moveTo(this.padding.left, y);
      ctx.lineTo(w - this.padding.right, y);
      ctx.stroke();
    }

    // Grid lines (time) — every 5 seconds
    const timeStep = this.duration > 60 ? 10 : 5;
    ctx.strokeStyle = this.colors.gridLine;
    for (let t = timeStep; t < this.duration; t += timeStep) {
      const x = this.padding.left + t * pxPerSec;
      ctx.beginPath();
      ctx.moveTo(x, this.padding.top);
      ctx.lineTo(x, h - this.padding.bottom);
      ctx.stroke();
    }

    // Draw notes
    this.notes.forEach(note => {
      const x = this.padding.left + note.time * pxPerSec;
      const noteW = Math.max(2, note.duration * pxPerSec);
      const y = this.padding.top + drawH - (note.midi - this.noteRange.min + 1) * noteH;
      const r = Math.min(2, noteH / 2, noteW / 2);

      // Color based on source
      const pal = note.source === 'continuation' ? this.colors.continuation : this.colors.original;
      const vel = 0.4 + note.velocity * 0.6;

      // Active note highlight
      const isActive = this.currentTime >= note.time && this.currentTime <= note.time + note.duration;

      if (isActive) {
        ctx.fillStyle = `hsla(${pal.h}, ${pal.s}%, ${pal.l + 15}%, 1)`;
        ctx.shadowColor = `hsla(${pal.h}, ${pal.s}%, ${pal.l}%, 0.6)`;
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = `hsla(${pal.h}, ${pal.s}%, ${pal.l}%, ${vel})`;
        ctx.shadowBlur = 0;
      }

      // Rounded rect
      this._roundRect(ctx, x, y, noteW, noteH - 0.5, r);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Playback cursor
    if (this.currentTime > 0 || this.notes.length > 0) {
      const cx = this.padding.left + this.currentTime * pxPerSec;

      // Glow
      const grad = ctx.createLinearGradient(cx - 20, 0, cx + 20, 0);
      grad.addColorStop(0, 'rgba(92, 214, 200, 0)');
      grad.addColorStop(0.5, this.colors.cursorGlow);
      grad.addColorStop(1, 'rgba(92, 214, 200, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 20, this.padding.top, 40, drawH);

      // Line
      ctx.strokeStyle = this.colors.cursor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(cx, this.padding.top);
      ctx.lineTo(cx, h - this.padding.bottom);
      ctx.stroke();
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
  }
}
