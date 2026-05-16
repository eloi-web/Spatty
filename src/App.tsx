import React, { useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { SphereGallery } from './components/SphereGallery';
import { ThroughGallery } from './components/ThroughGallery';
import { HandTracker } from './components/HandTracker';
import { Upload } from 'lucide-react';
import { cn } from './lib/utils';

// Generate 80 placeholder images from Unsplash for a denser sphere
const DEFAULT_IMAGES = Array.from({ length: 80 }).map((_, i) =>
  `https://picsum.photos/seed/${i + 100}/600/800`
);

type ViewMode = 'sphere' | 'through';

export default function App() {
  const [images, setImages] = useState<string[]>(DEFAULT_IMAGES);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('sphere');

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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-white text-[#1B1B1B] font-sans selection:bg-[#DFFF00] selection:text-black">

      {/* 3D Canvas Background */}
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseMove={handleDrag}
        onWheel={handleWheel}
      >
        <Canvas camera={{ position: [0, 0, 120], fov: 45 }}>
          <ambientLight intensity={1.5} />
          {viewMode === 'sphere' ? (
            <SphereGallery
              images={images}
              interactionRef={interactionRef}
            />
          ) : (
            <ThroughGallery
              images={images}
              interactionRef={interactionRef}
            />
          )}
        </Canvas>
      </div>

      {/* Floating Header */}
      <header className="absolute top-0 left-0 right-0 p-6 md:p-10 flex flex-col md:flex-row items-center justify-between pointer-events-none gap-4">
        <div className="w-full md:w-auto flex justify-center md:justify-start">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="image/jpeg, image/png, image/webp"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-black/10 bg-white/80 backdrop-blur-md shadow-float hover:shadow-active transition-all font-semibold text-sm tracking-wide pointer-events-auto"
          >
            <Upload size={16} />
            <span>UPLOAD GALLERY</span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase pointer-events-auto" >
            SPATTY
          </h1>
          {/* View Mode Switcher */}
          <div className="flex items-center bg-gray-100/80 backdrop-blur p-1 rounded-full shadow-inner pointer-events-auto border border-black/5">
            <button
              onClick={() => switchMode('sphere')}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all",
                viewMode === 'sphere' ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black/80"
              )}
            >
              Spatial Sphere
            </button>
            <button
              onClick={() => switchMode('through')}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all",
                viewMode === 'through' ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black/80"
              )}
            >
              Through View
            </button>
          </div>
        </div>
      </header>

      {/* Legacy mobile fallback hidden, just keeping hints for desktop design reference */}
      <div className="absolute top-[88px] md:top-28 left-6 md:left-10 hidden md:block text-[#1B1B1B]/40 text-[10px] uppercase tracking-widest font-bold pointer-events-none">
        DRAG TO ROTATE • SCROLL TO ZOOM
      </div>

      <div className="absolute top-[108px] md:top-32 left-6 md:left-10 hidden md:block text-[#1B1B1B]/40 text-[10px] uppercase tracking-widest font-bold pointer-events-none">
        HANDS: ✌️ DRAG = ROTATE • 🤏 PINCH = ZOOM
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
