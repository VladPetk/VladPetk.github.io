import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Square } from 'lucide-react';

interface MidiNote {
  noteNumber: number;
  velocity: number;
  startTime: number;
  duration: number;
  channel: number;
}

interface MidiVisualizerProps {
  midiData: MidiNote[] | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_KEYS = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A#

export function MidiVisualizer({
  midiData,
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  onSeek
}: MidiVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width - 32, // Account for padding
          height: Math.max(400, rect.height - 120) // Account for controls
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !midiData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Clear canvas with light background
    ctx.fillStyle = 'hsl(240, 100%, 99%)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Piano roll settings
    const noteHeight = 8;
    const minNote = Math.min(...midiData.map(n => n.noteNumber));
    const maxNote = Math.max(...midiData.map(n => n.noteNumber));
    const noteRange = maxNote - minNote + 1;
    const pianoWidth = 120;
    const rollWidth = canvas.width - pianoWidth;
    
    // Adjust note height based on range
    const actualNoteHeight = Math.min(noteHeight, (canvas.height - 40) / noteRange);
    
    // Draw piano keys
    for (let note = minNote; note <= maxNote; note++) {
      const y = canvas.height - ((note - minNote + 1) * actualNoteHeight) - 20;
      const noteInOctave = note % 12;
      const isBlackKey = BLACK_KEYS.includes(noteInOctave);
      
      // Draw key with soft shadows
      ctx.fillStyle = isBlackKey ? 'hsl(240, 10%, 25%)' : 'hsl(0, 0%, 100%)';
      ctx.fillRect(0, y, pianoWidth - 2, actualNoteHeight - 1);
      
      // Add subtle border for white keys
      if (!isBlackKey) {
        ctx.strokeStyle = 'hsl(240, 20%, 92%)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(0, y, pianoWidth - 2, actualNoteHeight - 1);
      }
      
      // Draw note label
      const octave = Math.floor(note / 12) - 1;
      const noteName = `${NOTES[noteInOctave]}${octave}`;
      ctx.fillStyle = isBlackKey ? 'hsl(0, 0%, 100%)' : 'hsl(240, 10%, 15%)';
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(noteName, pianoWidth / 2, y + actualNoteHeight / 2 + 3);
    }

    // Draw grid lines
    ctx.strokeStyle = 'hsl(240, 20%, 92%)';
    ctx.lineWidth = 0.5;
    
    // Horizontal lines (for each note)
    for (let note = minNote; note <= maxNote; note++) {
      const y = canvas.height - ((note - minNote + 1) * actualNoteHeight) - 20;
      ctx.beginPath();
      ctx.moveTo(pianoWidth, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Vertical lines (time grid)
    const timeScale = rollWidth / duration;
    const gridInterval = 1; // 1 second intervals
    for (let time = 0; time <= duration; time += gridInterval) {
      const x = pianoWidth + (time * timeScale);
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, canvas.height - 20);
      ctx.stroke();
    }

    // Draw MIDI notes
    midiData.forEach(note => {
      const x = pianoWidth + (note.startTime * timeScale);
      const width = note.duration * timeScale;
      const y = canvas.height - ((note.noteNumber - minNote + 1) * actualNoteHeight) - 20;
      
      // Determine note color based on whether it's currently playing
      const noteEndTime = note.startTime + note.duration;
      const isCurrentlyPlaying = isPlaying && currentTime >= note.startTime && currentTime <= noteEndTime;
      
      if (isCurrentlyPlaying) {
        // Playing note - soft mint green with gentle glow
        ctx.fillStyle = 'hsl(160, 60%, 65%)';
        ctx.shadowColor = 'hsl(160, 60%, 65%)';
        ctx.shadowBlur = 12;
      } else {
        // Regular note - soft pastel purple with opacity based on velocity
        const opacity = 0.6 + (note.velocity / 127) * 0.4;
        ctx.fillStyle = `hsla(280, 100%, 70%, ${opacity})`;
        ctx.shadowColor = 'hsl(280, 100%, 70%)';
        ctx.shadowBlur = 2;
      }
      
      ctx.fillRect(x, y, Math.max(2, width), actualNoteHeight - 1);
    });

    // Draw playhead with gradient
    if (isPlaying || currentTime > 0) {
      const playheadX = pianoWidth + (currentTime * timeScale);
      
      // Create gradient for playhead
      const gradient = ctx.createLinearGradient(0, 20, 0, canvas.height - 20);
      gradient.addColorStop(0, 'hsl(280, 100%, 70%)');
      gradient.addColorStop(1, 'hsl(320, 85%, 80%)');
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.shadowColor = 'hsl(280, 100%, 70%)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(playheadX, 20);
      ctx.lineTo(playheadX, canvas.height - 20);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

  }, [midiData, dimensions, currentTime, isPlaying, duration]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || duration === 0) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    const pianoWidth = 120;
    const rollWidth = canvas.width - pianoWidth;
    
    if (x > pianoWidth) {
      const clickTime = ((x - pianoWidth) / rollWidth) * duration;
      onSeek(Math.max(0, Math.min(duration, clickTime)));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="flex flex-col h-full" ref={containerRef}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-4 mb-4">
          <Button
            onClick={isPlaying ? onPause : onPlay}
            variant="default"
            size="sm"
            disabled={!midiData}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            onClick={onStop}
            variant="secondary"
            size="sm"
            disabled={!midiData}
          >
            <Square className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-muted-foreground">{formatTime(currentTime)}</span>
            <Progress 
              value={duration > 0 ? (currentTime / duration) * 100 : 0} 
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-4">
        {midiData ? (
          <canvas
            ref={canvasRef}
            className="w-full h-full border border-border rounded-lg cursor-pointer"
            onClick={handleCanvasClick}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <div className="text-6xl mb-4">🎹</div>
              <p className="text-lg">Select a MIDI file to start visualizing</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}