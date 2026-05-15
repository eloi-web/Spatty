import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { LucideCameraOff, Maximize, RotateCcw } from 'lucide-react';

interface HandTrackerProps {
  isEnabled: boolean;
  onToggleEnabled: () => void;
  onInteraction: (type: 'rotate' | 'zoom' | 'fullscreen', data?: any) => void;
}

export function HandTracker({
  isEnabled,
  onToggleEnabled,
  onInteraction
}: HandTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const previousWrist = useRef<{x: number, y: number} | null>(null);
  const lastFullscreenTime = useRef<number>(0);

  useEffect(() => {
    if (!isEnabled) {
      if (videoRef.current && videoRef.current.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(t => t.stop());
      }
      return;
    }

    let activeCamera: any = null;

    const setupMediaPipe = async () => {
      // @ts-ignore
      if (!window.Hands || !window.Camera || !window.drawConnectors || !window.drawLandmarks) {
        setTimeout(setupMediaPipe, 1000);
        return;
      }

      // @ts-ignore
      const hands = new window.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      });

      hands.onResults((results: any) => {
        if (!canvasRef.current || !videoRef.current) return;
        
        const videoWidth = videoRef.current.videoWidth;
        const videoHeight = videoRef.current.videoHeight;
        
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;
        
        const canvasCtx = canvasRef.current.getContext('2d');
        if (!canvasCtx) return;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Mirror the image
        canvasCtx.translate(canvasRef.current.width, 0);
        canvasCtx.scale(-1, 1);
        canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0];
          
          // Draw skeleton
          // @ts-ignore
          window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS, {color: '#DFFF00', lineWidth: 3});
          // @ts-ignore
          window.drawLandmarks(canvasCtx, landmarks, {color: '#ffffff', lineWidth: 1, radius: 2});

          analyzeGestures(landmarks);
        } else {
           previousWrist.current = null;
        }
        canvasCtx.restore();
      });

      if (videoRef.current) {
        try {
          // @ts-ignore
          activeCamera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current) {
                await hands.send({image: videoRef.current});
              }
            },
            width: 320,
            height: 240
          });
          
          activeCamera.start().catch((err: any) => {
             console.error('Camera start error:', err);
          });
        } catch (err: any) {
          console.error('Camera init error:', err);
        }
      }
    };

    setupMediaPipe();

    return () => {
      if (activeCamera) activeCamera.stop();
    };
  }, [isEnabled]);

  const analyzeGestures = (landmarks: any[]) => {
    const now = Date.now();
    const wrist = landmarks[0];
    
    // Finger states
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    const isIndexUp = indexTip.y < indexPip.y;
    const isMiddleUp = middleTip.y < middlePip.y;
    const isRingDown = ringTip.y > ringPip.y;
    const isPinkyDown = pinkyTip.y > pinkyPip.y;

    // 1. Rotation (Two fingers up: Index + Middle)
    if (isIndexUp && isMiddleUp && isRingDown && isPinkyDown) {
       if (previousWrist.current) {
          const dx = wrist.x - previousWrist.current.x;
          const dy = wrist.y - previousWrist.current.y;
          // Scale Delta for smooth movement, X is mirrored, move Right -> wrist.x increases
          onInteraction('rotate', { dx: dx * 2, dy: dy * 2 });
       }
       previousWrist.current = { x: wrist.x, y: wrist.y };
    } else {
       previousWrist.current = null;
    }

    // 2. Zoom (Pinch distance between Thumb and Index)
    // Only zoom if we are not doing a peace sign to rotate, or we can allow both
    // Actually, open hand = 4 fingers up -> zoom
    const isRingUp = ringTip.y < ringPip.y;
    const isPinkyUp = pinkyTip.y < pinkyPip.y;
    
    if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
       // Open palm -> Zoom Out (pushing away) or we use pinch
    }

    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    // Pinch distance usually ranges `0.02` (closed) to `0.25` (fully spread)
    if (!isMiddleUp && !isRingUp) {
      if (pinchDist > 0.15) {
         onInteraction('zoom', 0.02); // Zoom In
      } else if (pinchDist < 0.06) {
         onInteraction('zoom', -0.02); // Zoom Out
      }
    }

    // 3. Peace Sign for Fullscreen (Need a cool-down so it doesn't trigger 60x a sec)
    if (isIndexUp && isMiddleUp && isRingDown && isPinkyDown) {
       // Actually 2 fingers up is our rotate. So Fullscreen needs another gesture.
       // E.g. Thumb + Pinky up (Shaka sign)
       const isThumbUp = thumbTip.y < landmarks[3].y || thumbTip.x > landmarks[3].x;
       if (isThumbUp && isPinkyUp && !isIndexUp && !isMiddleUp) {
          if (now - lastFullscreenTime.current > 1000) {
             onInteraction('fullscreen');
             lastFullscreenTime.current = now;
          }
       }
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
      <div className={cn(
        "relative rounded-xl overflow-hidden transition-all duration-300",
        isEnabled ? "w-[240px] h-[180px] md:w-[320px] md:h-[240px] ring-2 ring-[#DFFF00]/50" : "w-12 h-12 flex items-center justify-center cursor-pointer hover:bg-black/5"
      )}>
        {!isEnabled ? (
          <button onClick={onToggleEnabled} className="w-full h-full flex items-center justify-center text-[#1b1b1b] hover:text-black transition-colors">
             <LucideCameraOff size={20} />
          </button>
        ) : (
          <>
            <video 
              ref={videoRef} 
              className="hidden" 
              playsInline 
              muted 
            />
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* Close button overlay */}
            <button 
              onClick={onToggleEnabled}
              className="absolute top-2 right-2 bg-black/20 hover:bg-black/40 p-2 rounded-full text-white hover:text-[#DFFF00] transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100 focus:opacity-100"
            >
              <LucideCameraOff size={16} />
            </button>
          </>
        )}
      </div>

      {/* Fallback Mobile Controls */}
      <div className="flex items-center gap-2 md:hidden">
        <button onClick={() => onInteraction('rotate', {dx: 0.1, dy: 0})} className="glass-panel p-2 rounded-full"><RotateCcw size={16} className="-scale-x-100" /></button>
        <button onClick={() => onInteraction('zoom', -0.1)} className="glass-panel px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">OUT</button>
        <button onClick={() => onInteraction('zoom', 0.1)} className="glass-panel px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">IN</button>
        <button onClick={() => onInteraction('rotate', {dx: -0.1, dy: 0})} className="glass-panel p-2 rounded-full"><RotateCcw size={16} /></button>
        <button onClick={() => onInteraction('fullscreen')} className="glass-panel p-2 rounded-full"><Maximize size={16} /></button>
      </div>
    </div>
  );
}

