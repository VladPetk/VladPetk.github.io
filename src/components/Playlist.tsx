import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Music } from 'lucide-react';

interface MidiFile {
  id: string;
  name: string;
  url: string;
  duration?: number;
  artist?: string;
}

interface PlaylistProps {
  files: MidiFile[];
  currentFile: MidiFile | null;
  onFileSelect: (file: MidiFile) => void;
  isPlaying: boolean;
}

export function Playlist({ files, currentFile, onFileSelect, isPlaying }: PlaylistProps) {
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          MIDI Playlist
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-1">
          {files.map((file) => {
            const isActive = currentFile?.id === file.id;
            const isHovered = hoveredFile === file.id;
            
            return (
              <div
                key={file.id}
                className={`
                  group relative px-4 py-3 cursor-pointer transition-all duration-200
                  hover:bg-accent/50 border-l-4 border-transparent
                  ${isActive ? 'bg-accent border-l-primary' : ''}
                  ${isHovered ? 'bg-accent/30' : ''}
                `}
                onClick={() => onFileSelect(file)}
                onMouseEnter={() => setHoveredFile(file.id)}
                onMouseLeave={() => setHoveredFile(null)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div 
                        className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                          transition-colors duration-200
                          ${isActive 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground group-hover:bg-primary/20'
                          }
                        `}
                      >
                        {isActive && isPlaying ? (
                          <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`
                          text-sm font-medium truncate
                          ${isActive ? 'text-primary' : 'text-foreground'}
                        `}>
                          {file.name.replace(/\.(mid|midi)$/i, '')}
                        </p>
                        {file.artist && (
                          <p className="text-xs text-muted-foreground truncate">
                            {file.artist}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary" 
                      className="text-xs bg-muted/50 hover:bg-muted"
                    >
                      {formatDuration(file.duration)}
                    </Badge>
                  </div>
                </div>
                
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                )}
              </div>
            );
          })}
          
          {files.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No MIDI files available</p>
              <p className="text-xs mt-1">Add some MIDI files to get started</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}