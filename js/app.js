/* ═══════════════════════════════════════════
   APP — Main initialization & wiring
   Track manifest, playlist rendering,
   event binding, coordination.
   ═══════════════════════════════════════════ */

const TRACKS = [
  {
    id: 'bach-toccata',
    composer: 'Bach',
    title: 'Toccata BWV 915',
    original: 'midi/Bwv0915 Toccata_clean.mid',
    continuation: 'midi/Bwv0915 Toccata_clean_0.mid',
  },
  {
    id: 'brahms-intermezzo',
    composer: 'Brahms',
    title: 'Intermezzo Op. 118 No. 2',
    original: 'midi/brahms-intermezzo-op118-no2_clean.mid',
    continuation: 'midi/brahms-intermezzo-op118-no2_clean_1.mid',
  },
  {
    id: 'chopin-etude',
    composer: 'Chopin',
    title: 'Etude Op. 10 No. 4',
    original: 'midi/chopin-etude-op10-no4_clean.mid',
    continuation: 'midi/chopin-etude-op10-no4_clean_0.mid',
  },
  {
    id: 'clementi-opus36',
    composer: 'Clementi',
    title: 'Opus 36 No. 1, Mvt. 3',
    original: 'midi/clementi_opus36_1_3_clean.mid',
    continuation: 'midi/clementi_opus36_1_3_clean_1.mid',
  },
  {
    id: 'schubert-moments',
    composer: 'Schubert',
    title: 'Moments Musicaux D780 No. 1',
    original: 'midi/Moments musicaux op94 D780 n1_clean.mid',
    continuation: 'midi/Moments musicaux op94 D780 n1_clean_0.mid',
  },
  {
    id: 'beethoven-moonlight',
    composer: 'Beethoven',
    title: 'Moonlight Sonata, Mvt. 3',
    original: 'midi/moonlt23_clean.mid',
    continuation: 'midi/moonlt23_clean_1.mid',
  },
  {
    id: 'beethoven-hammerklavier',
    composer: 'Beethoven',
    title: 'Hammerklavier Op. 106',
    original: "midi/Piano Sonata n29 Op106 ''Hammerklavier''_clean.mid",
    continuation: "midi/Piano Sonata n29 Op106 ''Hammerklavier''_clean_0.mid",
  },
  {
    id: 'korobeiniki',
    composer: 'Traditional',
    title: 'Korobeiniki (Tetris Theme)',
    original: 'midi/korobeiniki_clean.mid',
    continuation: 'midi/korobeiniki_clean_0.mid',
  },
  {
    id: 'granados-goyescas',
    composer: 'Granados',
    title: 'Goyescas - Espanola',
    original: 'midi/gra_esp_3.mid',
    continuation: null,
  },
  {
    id: 'beethoven-9th',
    composer: 'Beethoven',
    title: 'Symphony No. 9',
    original: 'midi/beethoven9.mid',
    continuation: null,
  },
];

// ── State ──

let player;
let pianoRoll;
let currentTrackId = null;

// ── DOM refs ──

const $playlistTracks = document.getElementById('playlist-tracks');
const $pianoRollEmpty = document.getElementById('piano-roll-empty');
const $loadingOverlay = document.getElementById('loading-overlay');
const $btnPlay = document.getElementById('btn-play');
const $btnStop = document.getElementById('btn-stop');
const $iconPlay = document.getElementById('icon-play');
const $iconPause = document.getElementById('icon-pause');
const $timeCurrent = document.getElementById('time-current');
const $timeTotal = document.getElementById('time-total');
const $progressFill = document.getElementById('progress-bar-fill');
const $progressContainer = document.getElementById('progress-bar-container');
const $nowPlaying = document.getElementById('now-playing');

// ── Helpers ──

function formatTime(secs) {
  if (!secs || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Playlist ──

function renderPlaylist() {
  $playlistTracks.innerHTML = '';

  TRACKS.forEach(track => {
    const div = document.createElement('div');
    div.className = 'track-item';
    div.dataset.id = track.id;

    const hasCont = !!track.continuation;
    div.innerHTML = `
      <div class="track-composer">${track.composer}</div>
      <div class="track-title">${track.title}</div>
      <div class="track-badge ${hasCont ? 'has-continuation' : 'solo'}">${hasCont ? 'original + continuation' : 'original only'}</div>
      <div class="track-playing-indicator">
        <span></span><span></span><span></span><span></span>
      </div>
    `;

    div.addEventListener('click', () => selectTrack(track.id));
    $playlistTracks.appendChild(div);
  });
}

function setActiveTrackUI(trackId, isPlaying) {
  document.querySelectorAll('.track-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === trackId);
    el.classList.toggle('playing', el.dataset.id === trackId && isPlaying);
  });
}

// ── Track selection & playback ──

async function selectTrack(trackId) {
  const track = TRACKS.find(t => t.id === trackId);
  if (!track) return;

  currentTrackId = trackId;
  setActiveTrackUI(trackId, false);

  // Show loading, hide empty state
  $pianoRollEmpty.style.display = 'none';
  $loadingOverlay.classList.add('visible');

  // Enable buttons
  $btnPlay.disabled = false;
  $btnStop.disabled = false;

  try {
    const { notes, duration } = await player.loadTrack(
      track.original,
      track.continuation
    );

    pianoRoll.setNotes(notes, duration);
    $timeTotal.textContent = formatTime(duration);
    $timeCurrent.textContent = '0:00';
    $progressFill.style.width = '0%';
    $nowPlaying.textContent = `${track.composer} \u2014 ${track.title}`;

    $loadingOverlay.classList.remove('visible');

    // Auto-play
    await player.play();
  } catch (err) {
    console.error('Error loading track:', err);
    $loadingOverlay.classList.remove('visible');
    $pianoRollEmpty.style.display = 'flex';
  }
}

// ── Controls ──

function updatePlayPauseIcon(isPlaying) {
  $iconPlay.style.display = isPlaying ? 'none' : 'block';
  $iconPause.style.display = isPlaying ? 'block' : 'none';
  setActiveTrackUI(currentTrackId, isPlaying);
}

function onTimeUpdate(currentTime, duration) {
  $timeCurrent.textContent = formatTime(currentTime);
  if (duration > 0) {
    $progressFill.style.width = `${(currentTime / duration) * 100}%`;
  }
  pianoRoll.updateCursor(currentTime);
}

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  // Init modules
  player = new MidiPlayer();
  pianoRoll = new PianoRoll('piano-roll', 'piano-roll-wrapper');

  // Wire callbacks
  player.onTimeUpdate = onTimeUpdate;
  player.onPlayStateChange = updatePlayPauseIcon;
  player.onLoadStart = () => $loadingOverlay.classList.add('visible');
  player.onLoadEnd = () => $loadingOverlay.classList.remove('visible');

  pianoRoll.onSeek = (time) => player.seek(time);

  // Render playlist
  renderPlaylist();

  // Play/Pause button
  $btnPlay.addEventListener('click', async () => {
    if (player.isPlaying) {
      player.pause();
    } else {
      await player.play();
    }
  });

  // Stop button
  $btnStop.addEventListener('click', () => {
    player.stop();
    pianoRoll.updateCursor(0);
  });

  // Progress bar seeking
  $progressContainer.addEventListener('click', (e) => {
    if (!player.duration) return;
    const rect = $progressContainer.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    player.seek(ratio * player.duration);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Only when not typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (player.notes.length === 0) return;
      if (player.isPlaying) player.pause();
      else player.play();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      player.seek(player.getCurrentTime() + 5);
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      player.seek(player.getCurrentTime() - 5);
    }
  });

  // Init diagrams
  initDiagrams();
});
