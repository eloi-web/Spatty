import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Six cardinal positions on the sphere — audio sources orbit with the sphere rotation
const SOURCE_POSITIONS = [
    new THREE.Vector3(35, 0, 0),  // right
    new THREE.Vector3(-35, 0, 0),  // left
    new THREE.Vector3(0, 35, 0),  // top
    new THREE.Vector3(0, -35, 0),  // bottom
    new THREE.Vector3(0, 0, 35),  // front
    new THREE.Vector3(0, 0, -35),  // back
];

// Am9 chord: A2 C3 E3 G3 A3 C4 — warm, ambient, atmospheric
// Optimised for headphones (HRTF panning model).
const FREQUENCIES = [110, 130.8, 164.8, 196, 220, 261.6];

interface AudioSource {
    panner: PannerNode;
    osc: OscillatorNode;
    lfo: OscillatorNode;
}

interface AudioSetup {
    ctx: AudioContext;
    masterGain: GainNode;
    sources: AudioSource[];
}

function buildAudio(): AudioSetup {
    const ctx = new AudioContext();

    // Master gain: fade in from silence to 0.5 over 3 seconds
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 3);
    masterGain.connect(ctx.destination);

    const sources: AudioSource[] = FREQUENCIES.map((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        // Slow vibrato LFO (0.25–0.65 Hz, ±2.5 cents) — makes the pad feel organic
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.25 + i * 0.07;
        lfoGain.gain.value = 2.5;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.detune);

        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.025;

        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF'; // binaural — most spatial effect, especially headphones
        panner.distanceModel = 'exponential';
        panner.refDistance = 50;
        panner.maxDistance = 300;
        panner.rolloffFactor = 1.0;

        const pos = SOURCE_POSITIONS[i];
        panner.positionX.setValueAtTime(pos.x, ctx.currentTime);
        panner.positionY.setValueAtTime(pos.y, ctx.currentTime);
        panner.positionZ.setValueAtTime(pos.z, ctx.currentTime);

        osc.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(masterGain);

        osc.start();
        lfo.start();

        return { panner, osc, lfo };
    });

    return { ctx, masterGain, sources };
}

// Pre-allocated — no per-frame GC
const _rotMatrix = new THREE.Matrix4();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _srcPos = new THREE.Vector3();
const _fwd = new THREE.Vector3();

interface SpatialAudioProps {
    rotationOutRef: React.MutableRefObject<{ x: number; y: number }>;
}

export function SpatialAudio({ rotationOutRef }: SpatialAudioProps) {
    const audioRef = useRef<AudioSetup | null>(null);
    const started = useRef(false);

    useEffect(() => {
        let mounted = true;

        const handleStart = () => {
            if (!mounted || started.current) return;
            started.current = true;
            try {
                audioRef.current = buildAudio();
            } catch {
                // AudioContext creation blocked by browser — fail silently
            }
        };

        document.addEventListener('click', handleStart, { once: true });
        document.addEventListener('keydown', handleStart, { once: true });

        return () => {
            mounted = false;
            document.removeEventListener('click', handleStart);
            document.removeEventListener('keydown', handleStart);
            const setup = audioRef.current;
            if (setup) {
                setup.sources.forEach(({ osc, lfo }) => {
                    try { osc.stop(); lfo.stop(); } catch { /* already stopped */ }
                });
                setup.ctx.close();
            }
        };
    }, []);

    useFrame((state) => {
        const setup = audioRef.current;
        if (!setup || setup.ctx.state !== 'running') return;

        const { camera } = state;
        const l = setup.ctx.listener;

        // ── Listener follows camera ───────────────────────────────────────────
        camera.getWorldDirection(_fwd);
        if ('positionX' in l) {
            l.positionX.value = camera.position.x;
            l.positionY.value = camera.position.y;
            l.positionZ.value = camera.position.z;
            l.forwardX.value = _fwd.x;
            l.forwardY.value = _fwd.y;
            l.forwardZ.value = _fwd.z;
            l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
        } else {
            // Firefox legacy fallback
            (l as any).setPosition(camera.position.x, camera.position.y, camera.position.z);
            (l as any).setOrientation(_fwd.x, _fwd.y, _fwd.z, 0, 1, 0);
        }

        // ── Sources rotate with the sphere ────────────────────────────────────
        const { x: rotX, y: rotY } = rotationOutRef.current;
        _euler.set(rotX, rotY, 0, 'YXZ');
        _rotMatrix.makeRotationFromEuler(_euler);

        setup.sources.forEach((src, i) => {
            _srcPos.copy(SOURCE_POSITIONS[i]).applyMatrix4(_rotMatrix);
            src.panner.positionX.value = _srcPos.x;
            src.panner.positionY.value = _srcPos.y;
            src.panner.positionZ.value = _srcPos.z;
        });
    });

    return null;
}
