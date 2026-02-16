/* ═══════════════════════════════════════════
   APP — Main initialization & wiring
   Track manifest, playlist rendering,
   event binding, coordination.
   ═══════════════════════════════════════════ */

const TRACKS = [
  {
    id: 'mozart-k545',
    composer: 'Mozart',
    title: 'Piano Sonata K. 545',
    prime: 'public_gens/K545 Piano Sonata_clean_prime.mid',
    continuations: [
      'public_gens/K545 Piano Sonata_clean_0.mid',
      'public_gens/K545 Piano Sonata_clean_1.mid',
    ],
  },
  {
    id: 'chopin-etude',
    composer: 'Chopin',
    title: 'Etude Op. 10 No. 4',
    prime: 'public_gens/chopin-etude-op10-no4_clean_prime.mid',
    continuations: [
      'public_gens/chopin-etude-op10-no4_clean_0.mid',
      'public_gens/chopin-etude-op10-no4_clean_3.mid',
    ],
  },
  {
    id: 'beethoven-hammerklavier',
    composer: 'Beethoven',
    title: 'Hammerklavier Sonata, Op. 106',
    prime: "public_gens/Piano Sonata n29 Op106 ''Hammerklavier''_clean_prime.mid",
    continuations: [
      "public_gens/Piano Sonata n29 Op106 ''Hammerklavier''_clean_0.mid",
      "public_gens/Piano Sonata n29 Op106 ''Hammerklavier''_clean_1.mid",
    ],
  },
  {
    id: 'satie-gnossienne',
    composer: 'Satie',
    title: 'Gnossienne No. 1',
    prime: 'public_gens/Gnossienne1_clean_prime.mid',
    continuations: [
      'public_gens/Gnossienne1_clean_0.mid',
      'public_gens/Gnossienne1_clean_3.mid',
    ],
  },
  {
    id: 'clementi-opus36',
    composer: 'Clementi',
    title: 'Sonatina Op. 36 No. 1, Mvt. 3',
    prime: 'public_gens/clementi_opus36_1_3_clean_prime.mid',
    continuations: [
      'public_gens/clementi_opus36_1_3_clean_0.mid',
      'public_gens/clementi_opus36_1_3_clean_2.mid',
    ],
  },
  {
    id: 'beethoven-opus22',
    composer: 'Beethoven',
    title: 'Piano Sonata Op. 22 No. 1',
    prime: 'public_gens/beethoven_opus22_1_clean_prime.mid',
    continuations: [
      'public_gens/beethoven_opus22_1_clean_0.mid',
      'public_gens/beethoven_opus22_1_clean_3.mid',
    ],
  },
  {
    id: 'korobeiniki',
    composer: 'Traditional',
    title: 'Korobeiniki',
    prime: 'public_gens/korobeiniki_clean_prime.mid',
    continuations: [
      'public_gens/korobeiniki_clean_0.mid',
      'public_gens/korobeiniki_clean_1.mid',
    ],
  },
  {
    id: 'mendelssohn-lieder',
    composer: 'Mendelssohn',
    title: 'Lieder ohne Worte, Book 1',
    prime: "public_gens/'Lieder ohne Worte' Book 1 op1 n1_clean_prime.mid",
    continuations: [
      "public_gens/'Lieder ohne Worte' Book 1 op1 n1_clean_0.mid",
      "public_gens/'Lieder ohne Worte' Book 1 op1 n1_clean_2.mid",
    ],
  },
  {
    id: 'schubert-d894',
    composer: 'Schubert',
    title: 'Piano Sonata D. 894, Menuetto',
    prime: 'public_gens/Piano Sonata in Sonata in G, No.3, D894 - Menuetto_ Allegro moderato_clean_prime.mid',
    continuations: [
      'public_gens/Piano Sonata in Sonata in G, No.3, D894 - Menuetto_ Allegro moderato_clean_0.mid',
      'public_gens/Piano Sonata in Sonata in G, No.3, D894 - Menuetto_ Allegro moderato_clean_3.mid',
    ],
  },
  {
    id: 'diabelli-sonatina',
    composer: 'Diabelli',
    title: 'Sonatina Op. 151 No. 1, Mvt. 3',
    prime: 'public_gens/Diabelli Sonatina op151 n1 3mov_clean_prime.mid',
    continuations: [
      'public_gens/Diabelli Sonatina op151 n1 3mov_clean_2.mid',
      'public_gens/Diabelli Sonatina op151 n1 3mov_clean_3.mid',
    ],
  },
  {
    id: 'minuet-op33',
    composer: 'Unknown',
    title: 'Minuet, Op. 33 No. 11',
    prime: 'public_gens/Minuet .Piano pieces -Songs & Dances- Opus 33, No.11_clean_prime.mid',
    continuations: [
      'public_gens/Minuet .Piano pieces -Songs & Dances- Opus 33, No.11_clean_0.mid',
      'public_gens/Minuet .Piano pieces -Songs & Dances- Opus 33, No.11_clean_3.mid',
    ],
  },
];

// ── State ──

let player;
let pianoRoll;
let currentTrackId = null;
let currentVariant = 0; // 0 = first continuation, 1 = second continuation

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
const $variantBtns = document.querySelectorAll('.variant-btn');

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

    div.innerHTML = `
      <div class="track-composer">${track.composer}</div>
      <div class="track-title">${track.title}</div>
      <div class="track-badge has-continuation">prime + continuation</div>
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

// ── Variant switching ──

function updateVariantUI() {
  $variantBtns.forEach((btn, i) => {
    btn.classList.toggle('active', i === currentVariant);
  });
}

async function selectVariant(variantIndex) {
  if (variantIndex === currentVariant) return;
  currentVariant = variantIndex;
  updateVariantUI();

  // Reload current track with new variant
  if (currentTrackId) {
    await selectTrack(currentTrackId);
  }
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
    const combinedUrl = track.continuations[currentVariant];
    const { notes, duration } = await player.loadTrack(combinedUrl, track.prime);

    pianoRoll.setNotes(notes, duration);
    $timeTotal.textContent = formatTime(duration);
    $timeCurrent.textContent = '0:00';
    $progressFill.style.width = '0%';
    const trackLabel = `${track.composer} \u2014 ${track.title}`;
    $nowPlaying.textContent = trackLabel;
    $miniTrack.textContent = trackLabel;

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
  $miniIconPlay.style.display = isPlaying ? 'none' : 'block';
  $miniIconPause.style.display = isPlaying ? 'block' : 'none';
  setActiveTrackUI(currentTrackId, isPlaying);
}

function onTimeUpdate(currentTime, duration) {
  $timeCurrent.textContent = formatTime(currentTime);
  $miniTime.textContent = formatTime(currentTime);
  if (duration > 0) {
    const pct = `${(currentTime / duration) * 100}%`;
    $progressFill.style.width = pct;
    $miniProgressFill.style.width = pct;
  }
  pianoRoll.updateCursor(currentTime);
}

// ── Sticky mini-player ──

const $miniPlayer = document.getElementById('mini-player');
const $miniBtnPlay = document.getElementById('mini-btn-play');
const $miniTrack = document.getElementById('mini-player-track');
const $miniProgressFill = document.getElementById('mini-progress-fill');
const $miniTime = document.getElementById('mini-time');
const $miniIconPlay = $miniBtnPlay.querySelector('.mini-icon-play');
const $miniIconPause = $miniBtnPlay.querySelector('.mini-icon-pause');

function initMiniPlayer() {
  // Show mini-player when main controls scroll out of view
  const $controls = document.getElementById('controls');
  const observer = new IntersectionObserver(([entry]) => {
    const hasTrack = currentTrackId !== null;
    $miniPlayer.classList.toggle('visible', !entry.isIntersecting && hasTrack);
  }, { threshold: 0 });
  observer.observe($controls);

  $miniBtnPlay.addEventListener('click', async () => {
    if (player.isPlaying) player.pause();
    else await player.play();
  });
}

function updateMiniPlayer(currentTime, duration, isPlaying) {
  $miniTime.textContent = formatTime(currentTime);
  if (duration > 0) {
    $miniProgressFill.style.width = `${(currentTime / duration) * 100}%`;
  }
  $miniIconPlay.style.display = isPlaying ? 'none' : 'block';
  $miniIconPause.style.display = isPlaying ? 'block' : 'none';
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

  // Variant buttons
  $variantBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => selectVariant(i));
  });
  updateVariantUI();

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

  // Init diagrams & mini-player
  initDiagrams();
  initMiniPlayer();
});
