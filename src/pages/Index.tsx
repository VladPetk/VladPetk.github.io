import { useState } from 'react';
import { MidiVisualizer } from '@/components/MidiVisualizer';
import { Playlist } from '@/components/Playlist';
import { useMidiPlayer } from '@/hooks/useMidiPlayer';

// Sample MIDI files for the playlist
const sampleMidiFiles = [
  {
    id: '1',
    name: 'Moonlight Sonata',
    url: '/midi/moonlight.mid',
    duration: 95,
    artist: 'Ludwig van Beethoven'
  },
  {
    id: '2', 
    name: 'Für Elise',
    url: '/midi/fur-elise.mid',
    duration: 78,
    artist: 'Ludwig van Beethoven'
  },
  {
    id: '3',
    name: 'Canon in D',
    url: '/midi/canon.mid', 
    duration: 156,
    artist: 'Johann Pachelbel'
  },
  {
    id: '4',
    name: 'Prelude in C Major',
    url: '/midi/prelude.mid',
    duration: 67,
    artist: 'Johann Sebastian Bach'
  },
  {
    id: '5',
    name: 'Turkish March',
    url: '/midi/turkish-march.mid',
    duration: 89,
    artist: 'Wolfgang Amadeus Mozart'
  },
  {
    id: '6',
    name: 'Minute Waltz',
    url: '/midi/minute-waltz.mid',
    duration: 112,
    artist: 'Frédéric Chopin'
  }
];

const Index = () => {
  const {
    currentFile,
    midiData,
    isPlaying,
    currentTime,
    duration,
    isLoading,
    loadFile,
    play,
    pause,
    stop,
    seek
  } = useMidiPlayer();

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">🎹</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                MIDI Roll Visualizer
              </h1>
              <p className="text-sm text-muted-foreground">
                Interactive piano roll with real-time playback
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
          {/* Playlist sidebar */}
          <div className="col-span-12 lg:col-span-3">
            <Playlist
              files={sampleMidiFiles}
              currentFile={currentFile}
              onFileSelect={loadFile}
              isPlaying={isPlaying}
            />
          </div>

          {/* Visualizer */}
          <div className="col-span-12 lg:col-span-9">
            <MidiVisualizer
              midiData={midiData}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              onPlay={play}
              onPause={pause}
              onStop={stop}
              onSeek={seek}
            />
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-foreground">Loading MIDI file...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
