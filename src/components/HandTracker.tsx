import React, { useEffect, useRef } from 'react';
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


  const lastFullscreenTime = useRef<number>(0);
  // EMA on absolute palm position (ref-repo approach) — smoother than EMA on delta
  const smoothedPalm = useRef({ x: 0.5, y: 0.5, active: false });

  useEffect(() => {
    if (!isEnabled) return;

    let cancelled = false;
    let activeCamera: any = null;

    const setupMediaPipe = async () => {
      // Poll every 100ms instead of 1000ms — scripts usually load well within 100ms
      while (
        // @ts-ignore
        !window.Hands || !window.Camera || !window.drawConnectors || !window.drawLandmarks
      ) {
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 100));
      }
      if (cancelled) return;

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
          window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS, { color: '#DFFF00', lineWidth: 3 });
          // @ts-ignore
          window.drawLandmarks(canvasCtx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 5 });

          analyzeGestures(landmarks);
        } else {
          smoothedPalm.current.active = false;
        }
        canvasCtx.restore();
      });

      // Pre-warm the model before starting the camera — eliminates first-frame lag
      await hands.initialize();
      if (cancelled) return;

      if (videoRef.current) {
        try {
          // @ts-ignore
          activeCamera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current) {
                await hands.send({ image: videoRef.current });
              }
            },
            width: 640,
            height: 480
          });

          await activeCamera.start();
        } catch (err: any) {
          console.error('Camera start error:', err);
        }
      }
    };

    setupMediaPipe().catch(console.error);

    return () => {
      cancelled = true;
      if (activeCamera) {
        activeCamera.stop();
      }
      // Stop the webcam hardware immediately so the indicator light turns off
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [isEnabled]);

  const analyzeGestures = (landmarks: any[]) => {
    const now = Date.now();

    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const indexMCP = landmarks[5];
    const middleMCP = landmarks[9];
    const ringMCP = landmarks[13];
    const pinkyMCP = landmarks[17];

    // Orientation-independent extension check:
    // A finger is "extended" when its tip is clearly further from the wrist than its base knuckle (MCP).
    // This works even when the hand is tilted sideways, unlike raw Y comparisons.
    const d = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);
    const isExtended = (tip: any, mcp: any) => d(tip, wrist) > d(mcp, wrist) * 1.5;
    const isCurled = (tip: any, mcp: any) => d(tip, wrist) < d(mcp, wrist) * 1.3;

    const isIndexUp = isExtended(indexTip, indexMCP);
    const isMiddleUp = isExtended(middleTip, middleMCP);
    const isRingDown = isCurled(ringTip, ringMCP);
    const isPinkyUp = isExtended(pinkyTip, pinkyMCP);

    // 1. Rotation (Two fingers up: Index + Middle)
    if (isIndexUp && isMiddleUp) {
      // Use landmark 9 (middle finger MCP) — more stable than wrist (landmark 0)
      const palm = landmarks[9];
      const mirroredX = 1 - palm.x; // mirror so moving right = rotating right
      const alpha = 0.4; // same as reference repo

      if (!smoothedPalm.current.active) {
        // First frame: initialize without sending rotation
        smoothedPalm.current = { x: mirroredX, y: palm.y, active: true };
      } else {
        const prevX = smoothedPalm.current.x;
        const prevY = smoothedPalm.current.y;
        // Smooth the absolute position, then derive delta from it
        smoothedPalm.current.x += (mirroredX - prevX) * alpha;
        smoothedPalm.current.y += (palm.y - prevY) * alpha;
        const dx = smoothedPalm.current.x - prevX;
        const dy = smoothedPalm.current.y - prevY;
        onInteraction('rotate', { dx: dx * 5, dy: dy * 5 });
      }
    } else {
      smoothedPalm.current.active = false;
    }

    // 2. Zoom: pinch (thumb + index close) when NOT in rotation gesture
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    if (!isIndexUp && !isMiddleUp) {
      if (pinchDist > 0.15) {
        onInteraction('zoom', 0.02); // Zoom In
      } else if (pinchDist < 0.06) {
        onInteraction('zoom', -0.02); // Zoom Out
      }
    }

    // 3. Fullscreen: Shaka sign — only pinky up, index + middle + ring all down
    if (isPinkyUp && !isIndexUp && !isMiddleUp && isRingDown) {
      if (now - lastFullscreenTime.current > 1500) {
        onInteraction('fullscreen');
        lastFullscreenTime.current = now;
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
        <button onClick={() => onInteraction('rotate', { dx: 0.1, dy: 0 })} className="glass-panel p-2 rounded-full"><RotateCcw size={16} className="-scale-x-100" /></button>
        <button onClick={() => onInteraction('zoom', -0.1)} className="glass-panel px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">OUT</button>
        <button onClick={() => onInteraction('zoom', 0.1)} className="glass-panel px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">IN</button>
        <button onClick={() => onInteraction('rotate', { dx: -0.1, dy: 0 })} className="glass-panel p-2 rounded-full"><RotateCcw size={16} /></button>
        <button onClick={() => onInteraction('fullscreen')} className="glass-panel p-2 rounded-full"><Maximize size={16} /></button>
      </div>
    </div>
  );
}

