import React, { useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { MorphingGallery } from './components/MorphingGallery';
import { SceneEnvironment } from './components/SceneEnvironment';
import { PostEffects } from './components/PostEffects';
import { SpatialAudio } from './components/SpatialAudio';
import { HandTracker } from './components/HandTracker';
import { Upload } from 'lucide-react';
import { cn } from './lib/utils';

// Generate 80 placeholder images from Unsplash for a denser sphere
const DEFAULT_IMAGES = Array.from({ length: 80 }).map((_, i) =>
  `https://picsum.photos/seed/${i + 100}/400/600`
);

type ViewMode = 'sphere' | 'through';

/** Extracts the average (dominant) RGB colour from an image URL via a tiny canvas. */
function extractDominantColor(url: string): Promise<[number, number, number]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve([200, 200, 200]); return; }
      ctx.drawImage(img, 0, 0, 8, 8);
      const { data } = ctx.getImageData(0, 0, 8, 8);
      let r = 0, g = 0, b = 0;
      const px = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2];
      }
      resolve([Math.round(r / px), Math.round(g / px), Math.round(b / px)]);
    };
    img.onerror = () => resolve([200, 200, 200]);
    img.src = url;
  });
}

export default function App() {
  const [images, setImages] = useState<string[]>(DEFAULT_IMAGES);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('sphere');
  const [envColor, setEnvColor] = useState<[number, number, number]>([255, 255, 255]);
  const colorCache = useRef(new Map<string, [number, number, number]>());
  const sphereRotRef = useRef({ x: 0, y: 0 });

  // Use refs for interactions to avoid re-renders on continuous 30fps inputs
  const interactionRef = useRef({
    rotationX: 0,
    rotationY: 0,
    zoomProgress: 0 // 0 = far, 1 = close
  });

  const switchMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    // Reset accumulated state so carry-over from the other mode doesn't break the new one
    interactionRef.current.rotationX = 0;
    interactionRef.current.rotationY = 0;
    interactionRef.current.zoomProgress = 0;
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInteraction = useCallback((type: 'rotate' | 'zoom' | 'fullscreen', data?: any) => {
    if (type === 'rotate') {
      interactionRef.current.rotationX += data.dy; // mouse up/down -> affects X axis
      interactionRef.current.rotationY += data.dx; // mouse left/right -> affects Y axis
    } else if (type === 'zoom') {
      interactionRef.current.zoomProgress += data;
      interactionRef.current.zoomProgress = Math.max(0, Math.min(1, interactionRef.current.zoomProgress));
    } else if (type === 'fullscreen') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages = Array.from(files).map(file => URL.createObjectURL(file));
    setImages(prev => [...prev, ...newImages]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (e.buttons === 1) { // Left mouse button
      interactionRef.current.rotationY += e.movementX * 0.01;
      interactionRef.current.rotationX += e.movementY * 0.01;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    interactionRef.current.zoomProgress += e.deltaY * -0.001;
    interactionRef.current.zoomProgress = Math.max(0, Math.min(1, interactionRef.current.zoomProgress));
  };

  const handleNearestImage = useCallback((url: string) => {
    const cached = colorCache.current.get(url);
    if (cached) { setEnvColor(cached); return; }
    extractDominantColor(url).then(color => {
      colorCache.current.set(url, color);
      setEnvColor(color);
    });
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-white text-brand-primary font-sans selection:bg-brand-accent selection:text-black">

      {/* 3D Canvas Background */}
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseMove={handleDrag}
        onWheel={handleWheel}
      >
        <Canvas camera={{ position: [0, 0, 150], fov: 45 }}>
          <SceneEnvironment envColor={envColor} />
          <ambientLight intensity={1.5} />
          <MorphingGallery
            mode={viewMode}
            images={images}
            interactionRef={interactionRef}
            onNearestImage={handleNearestImage}
            rotationOutRef={sphereRotRef}
          />
          <SpatialAudio rotationOutRef={sphereRotRef} />
          <PostEffects />
        </Canvas>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        accept="image/jpeg, image/png, image/webp"
        className="hidden"
      />

      {/* Title — top left */}
      <div className="absolute top-0 left-0 p-4 md:p-6 pointer-events-none">
        <h1 className="text-lg md:text-2xl font-bold tracking-tight uppercase">
          SPATTY
        </h1>
        <p className="hidden md:block mt-1.5 text-brand-primary/40 text-[10px] uppercase tracking-widest font-bold">
          DRAG TO ROTATE • SCROLL TO ZOOM
        </p>
        <p className="hidden md:block mt-0.5 text-brand-primary/40 text-[10px] uppercase tracking-widest font-bold">
          ✌️ DRAG = ROTATE • 🤏 PINCH = ZOOM
        </p>
      </div>

      {/* Controls — top right */}
      <div className="absolute top-0 right-0 p-4 md:p-6 flex flex-col items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 md:px-5 md:py-2.5 rounded-full border border-black/10 bg-white/80 backdrop-blur-md shadow-float hover:shadow-active transition-all font-semibold text-xs md:text-sm tracking-wide"
        >
          <Upload size={14} />
          <span className="hidden sm:inline">UPLOAD</span>
        </button>
        {/* View Mode Switcher */}
        <div className="flex items-center bg-gray-100/80 backdrop-blur p-1 rounded-full shadow-inner border border-black/5">
          <button
            onClick={() => switchMode('sphere')}
            className={cn(
              "px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-semibold tracking-wide transition-all",
              viewMode === 'sphere' ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black/80"
            )}
          >
            Sphere
          </button>
          <button
            onClick={() => switchMode('through')}
            className={cn(
              "px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-semibold tracking-wide transition-all",
              viewMode === 'through' ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black/80"
            )}
          >
            Tunnel
          </button>
        </div>
      </div>

      {/* Hand Tracker Component */}
      <HandTracker
        isEnabled={isTrackingEnabled}
        onToggleEnabled={() => setIsTrackingEnabled(!isTrackingEnabled)}
        onInteraction={handleInteraction}
      />
    </div>
  );
}
