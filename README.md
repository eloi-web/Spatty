# Spatty — Your Images in Space

Spatty is an immersive, interactive 3D photo gallery. Upload your images and explore them floating in a galaxy-like sphere — or fly through them in a tunnel. Navigate with your mouse, scroll wheel, or entirely with hand gestures via your webcam.

## Features

### 3D Gallery Modes
- **Sphere Mode** — 80 images arranged in a dense, majestic floating sphere.
- **Tunnel Mode** — Images form an infinite corridor you fly through.
- **Morph Animation** — Smooth 3D transition between sphere and tunnel at the press of a button.

### Navigation
- **Mouse** — Click and drag to rotate; scroll wheel to zoom.
- **Hand Gestures** (webcam required):
  - `✌️` Index + Middle fingers extended + drag → rotate the sphere.
  - `🤏` Pinch (Index + Thumb distance) → zoom in / out.
  - `🤙` Shaka sign → toggle fullscreen.

### Atmosphere
- **Depth of Field** — Dreamy galaxy blur when zoomed out; images snap to sharp focus when you zoom in close.
- **Dynamic Environment** — Scene background and fog tint automatically match the dominant color of the nearest image.
- **Spatial Ambient Audio** — Six sine-wave oscillators (Am9 chord) placed at the cardinal points of the sphere, rendered with HRTF binaural panning. The soundscape rotates with the sphere. Starts on first interaction (browser autoplay policy).

### Camera Widget
- Draggable, snap-to-corner preview window showing the live webcam feed and hand-skeleton overlay.
- Snaps to any of the 4 corners or the default bottom-center with a spring animation.
- Collapses to a small icon when the camera is off.

## Getting Started

1. Open the app and click **Upload Gallery** to load your images.
2. Use mouse/scroll or enable the camera for hand-gesture control.
3. Click the morph button to switch between Sphere and Tunnel views.

## Tech Stack

| Layer | Library / Tool |
|---|---|
| Framework | React 19 + TypeScript 5.8 |
| Build | Vite 6 + `@vitejs/plugin-react` |
| Styling | Tailwind CSS v4 |
| 3D Rendering | Three.js · `@react-three/fiber` · `@react-three/drei` |
| Post-Processing | `@react-three/postprocessing` · `postprocessing` (Depth of Field) |
| Hand Tracking | MediaPipe Hands (CDN) |
| Audio | Web Audio API — `AudioContext`, `OscillatorNode`, `PannerNode` (HRTF) |
| Icons | `lucide-react` |
| Deployment | Vercel (frontend-only, no backend) |
