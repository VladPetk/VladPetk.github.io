import { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';

interface MidiNote {
  noteNumber: number;
  velocity: number;
  startTime: number;
  duration: number;
  channel: number;
}

interface MidiFile {
  id: string;
  name: string;
  url: string;
  duration?: number;
  artist?: string;
}

export function useMidiPlayer() {
  const [currentFile, setCurrentFile] = useState<MidiFile | null>(null);
  const [midiData, setMidiData] = useState<MidiNote[] | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const activeNotesRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  // Initialize synth
  useEffect(() => {
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle'
      },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.3,
        release: 1
      }
    }).toDestination();

    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
      }
    };
  }, []);

  const noteNumberToName = (noteNumber: number) => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(noteNumber / 12) - 1;
    const note = notes[noteNumber % 12];
    return `${note}${octave}`;
  };

  const parseMidiFile = async (file: File): Promise<MidiNote[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Simple MIDI parsing - this is a basic implementation
          // In a real app, you'd use a proper MIDI parsing library
          const notes: MidiNote[] = [];
          
          // For demo purposes, generate some sample notes
          // This would be replaced with actual MIDI parsing
          for (let i = 0; i < 20; i++) {
            const startTime = (i * 0.5) + Math.random() * 2;
            notes.push({
              noteNumber: 60 + Math.floor(Math.random() * 24), // C4 to B5
              velocity: 80 + Math.floor(Math.random() * 40),
              startTime,
              duration: 0.5 + Math.random() * 1.5,
              channel: 0
            });
          }
          
          resolve(notes);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const loadFile = useCallback(async (file: MidiFile) => {
    setIsLoading(true);
    try {
      // For demo purposes, we'll create sample MIDI data
      // In a real app, you'd fetch and parse the actual MIDI file
      const sampleNotes: MidiNote[] = [];
      const numNotes = 30 + Math.floor(Math.random() * 50);
      
      for (let i = 0; i < numNotes; i++) {
        const startTime = Math.random() * 20; // 20 second range
        sampleNotes.push({
          noteNumber: 48 + Math.floor(Math.random() * 36), // C3 to B5
          velocity: 60 + Math.floor(Math.random() * 67),
          startTime,
          duration: 0.3 + Math.random() * 2,
          channel: 0
        });
      }
      
      // Sort by start time
      sampleNotes.sort((a, b) => a.startTime - b.startTime);
      
      const maxEndTime = Math.max(...sampleNotes.map(n => n.startTime + n.duration));
      
      setCurrentFile(file);
      setMidiData(sampleNotes);
      setDuration(maxEndTime);
      setCurrentTime(0);
      setIsPlaying(false);
      pausedAtRef.current = 0;
    } catch (error) {
      console.error('Failed to load MIDI file:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePlayback = useCallback(() => {
    if (!isPlaying || !midiData) return;

    const now = Tone.now();
    const elapsed = now - startTimeRef.current + pausedAtRef.current;
    setCurrentTime(elapsed);

    // Play notes that should be active at current time
    if (synthRef.current) {
      const currentActiveNotes = new Set<string>();
      
      midiData.forEach(note => {
        const noteId = `${note.noteNumber}-${note.startTime}`;
        const noteEndTime = note.startTime + note.duration;
        
        if (elapsed >= note.startTime && elapsed <= noteEndTime) {
          currentActiveNotes.add(noteId);
          
          // If this note wasn't active before, start playing it
          if (!activeNotesRef.current.has(noteId)) {
            const noteName = noteNumberToName(note.noteNumber);
            const velocity = note.velocity / 127;
            synthRef.current.triggerAttack(noteName, undefined, velocity);
          }
        }
      });

      // Stop notes that are no longer active
      activeNotesRef.current.forEach(noteId => {
        if (!currentActiveNotes.has(noteId)) {
          const [noteNumber] = noteId.split('-');
          const noteName = noteNumberToName(parseInt(noteNumber));
          synthRef.current?.triggerRelease(noteName);
        }
      });

      activeNotesRef.current = currentActiveNotes;
    }

    // Check if playback is complete
    if (elapsed >= duration) {
      setIsPlaying(false);
      setCurrentTime(duration);
      activeNotesRef.current.clear();
      if (synthRef.current) {
        synthRef.current.releaseAll();
      }
      return;
    }

    animationFrameRef.current = requestAnimationFrame(updatePlayback);
  }, [isPlaying, midiData, duration]);

  const play = useCallback(async () => {
    if (!midiData || isPlaying) return;

    await Tone.start();
    
    setIsPlaying(true);
    startTimeRef.current = Tone.now();
    
    updatePlayback();
  }, [midiData, isPlaying, updatePlayback]);

  const pause = useCallback(() => {
    if (!isPlaying) return;

    setIsPlaying(false);
    pausedAtRef.current = currentTime;
    
    // Stop all playing notes
    if (synthRef.current) {
      synthRef.current.releaseAll();
    }
    activeNotesRef.current.clear();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isPlaying, currentTime]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    pausedAtRef.current = 0;
    
    // Stop all playing notes
    if (synthRef.current) {
      synthRef.current.releaseAll();
    }
    activeNotesRef.current.clear();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const seek = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(duration, time));
    setCurrentTime(clampedTime);
    pausedAtRef.current = clampedTime;
    
    // Stop all currently playing notes
    if (synthRef.current) {
      synthRef.current.releaseAll();
    }
    activeNotesRef.current.clear();
    
    if (isPlaying) {
      startTimeRef.current = Tone.now() - clampedTime;
    }
  }, [duration, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
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
  };
}