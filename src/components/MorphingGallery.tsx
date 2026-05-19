import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Image as DreiImage } from '@react-three/drei';

type ViewMode = 'sphere' | 'through';

export interface MorphingGalleryProps {
    mode: ViewMode;
    images: string[];
    interactionRef: React.MutableRefObject<{
        rotationX: number;
        rotationY: number;
        zoomProgress: number;
    }>;
    onNearestImage?: (url: string) => void;
    rotationOutRef?: React.MutableRefObject<{ x: number; y: number }>;
}

const SPHERE_RADIUS = 35;
const TUNNEL_SPACING = 4;
const MORPH_DURATION = 1.2; // seconds to complete morph

/** Smoothstep easing (S-curve: slow start, fast middle, slow end) */
function smoothstep(t: number) {
    return t * t * (3 - 2 * t);
}

// Pre-allocated Three.js objects to avoid per-frame garbage collection
const _rotMatrix = new THREE.Matrix4();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _sp = new THREE.Vector3(); // sphere world position
const _ls = new THREE.Vector3(); // lookAt target (sphere: outward)
const _lt = new THREE.Vector3(); // lookAt target (tunnel: forward)
const _lx = new THREE.Vector3(); // blended lookAt target
const _cf = new THREE.Vector3(); // camera forward
const _ti = new THREE.Vector3(); // toImage direction

export function MorphingGallery({
    mode,
    images,
    interactionRef,
    onNearestImage,
    rotationOutRef,
}: MorphingGalleryProps) {

    // ─── Sphere base positions (un-rotated, Fibonacci spiral) ─────────────
    const spherePos = useMemo(() => {
        const n = images.length;
        const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
        return Array.from({ length: n }, (_, i) => {
            const y = 1 - (i / (n - 1)) * 2;
            const r = Math.sqrt(1 - y * y);
            const theta = phi * i;
            return new THREE.Vector3(
                Math.cos(theta) * r * SPHERE_RADIUS,
                y * SPHERE_RADIUS,
                Math.sin(theta) * r * SPHERE_RADIUS
            );
        });
    }, [images.length]);

    // ─── Tunnel positions (deterministic, no Math.random) ─────────────────
    const tunnelPos = useMemo(() => {
        // Simple integer hash for deterministic "random" offsets
        const h = (n: number) => ((n * 2654435761) >>> 0) / 4294967296;
        return images.map((_, i) => new THREE.Vector3(
            (i % 2 === 0 ? -1 : 1) * (4 + h(i * 3 + 1) * 2),
            (h(i * 7 + 2) - 0.5) * 6,
            -(i + 1) * TUNNEL_SPACING
        ));
    }, [images.length]);

    // ─── Animation state refs ─────────────────────────────────────────────
    const morphRef = useRef(0);           // 0 = fully sphere, 1 = fully tunnel
    const worldRotY = useRef(0);           // accumulated sphere auto-rotation (Y)
    const smoothRot = useRef({ x: 0, y: 0 }); // smoothed sphere rotation
    const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
    const nearestRef = useRef(-1);
    const lastColor = useRef(0);

    // ─── Ref-copies of props so the useFrame closure stays fresh ──────────
    const modeRef = useRef(mode); modeRef.current = mode;
    const imagesRef = useRef(images); imagesRef.current = images;
    const spherePosRef = useRef(spherePos); spherePosRef.current = spherePos;
    const tunnelPosRef = useRef(tunnelPos); tunnelPosRef.current = tunnelPos;
    const nearestCbRef = useRef(onNearestImage); nearestCbRef.current = onNearestImage;

    useFrame((state, delta) => {
        const currentMode = modeRef.current;
        const sp = spherePosRef.current;
        const tp = tunnelPosRef.current;
        const meshes = meshRefs.current;

        // ── 1. Advance morph progress (0 = sphere, 1 = tunnel) ──────────────
        const targetMorph = currentMode === 'through' ? 1 : 0;
        const step = Math.sign(targetMorph - morphRef.current) *
            Math.min(Math.abs(targetMorph - morphRef.current), delta / MORPH_DURATION);
        morphRef.current = Math.max(0, Math.min(1, morphRef.current + step));
        const t = smoothstep(morphRef.current);

        // ── 2. Sphere auto-rotation (fades out as we enter tunnel) ──────────
        worldRotY.current += delta * 0.05 * (1 - t);

        // ── 3. Smooth sphere rotation (preserves the original feel) ─────────
        const targetRotY = worldRotY.current + interactionRef.current.rotationY;
        const targetRotX = interactionRef.current.rotationX;
        smoothRot.current.y = THREE.MathUtils.lerp(smoothRot.current.y, targetRotY, 0.1);
        smoothRot.current.x = THREE.MathUtils.lerp(smoothRot.current.x, targetRotX, 0.1);
        _euler.set(smoothRot.current.x, smoothRot.current.y, 0, 'YXZ');
        _rotMatrix.makeRotationFromEuler(_euler);

        // ── 4. Update each card position & orientation ───────────────────────
        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            if (!mesh || !sp[i] || !tp[i]) continue;

            // Sphere world position after applying rotation
            _sp.copy(sp[i]).applyMatrix4(_rotMatrix);

            // Interpolated world position
            mesh.position.x = THREE.MathUtils.lerp(_sp.x, tp[i].x, t);
            mesh.position.y = THREE.MathUtils.lerp(_sp.y, tp[i].y, t);
            mesh.position.z = THREE.MathUtils.lerp(_sp.z, tp[i].z, t);

            // Orientation: sphere = face outward, tunnel = face +Z (toward camera origin)
            // Blend smoothly between the two using the same eased t
            _ls.copy(_sp).multiplyScalar(2);                                        // sphere: look outward
            _lt.set(mesh.position.x, mesh.position.y, mesh.position.z + 1000);     // tunnel: look toward +Z
            _lx.lerpVectors(_ls, _lt, t);
            mesh.lookAt(_lx);

            if (mesh.material) {
                (mesh.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
            }
        }

        // ── 5. Camera (smoothly blended between sphere and tunnel behaviour) ─
        const zoom = interactionRef.current.zoomProgress;
        const tunnelLen = imagesRef.current.length * TUNNEL_SPACING;

        const sphereCamZ = 150 - zoom * 170;
        const tunnelCamZ = -(zoom * tunnelLen);
        const targetCamZ = THREE.MathUtils.lerp(sphereCamZ, tunnelCamZ, t);
        state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetCamZ, 0.065);

        // Camera look-around: none in sphere mode, interaction-driven in tunnel
        const lookX = THREE.MathUtils.lerp(0, -interactionRef.current.rotationX * 0.2, t);
        const lookY = THREE.MathUtils.lerp(0, -interactionRef.current.rotationY * 0.2, t);
        state.camera.rotation.x = THREE.MathUtils.lerp(state.camera.rotation.x, lookX, 0.07);
        state.camera.rotation.y = THREE.MathUtils.lerp(state.camera.rotation.y, lookY, 0.07);

        // ── 6. Nearest image detection (throttled, for colour extraction) ────
        const cb = nearestCbRef.current;
        const now = Date.now();
        if (cb && now - lastColor.current > 400) {
            lastColor.current = now;
            let best = 0;
            let maxDot = -Infinity;
            state.camera.getWorldDirection(_cf);
            for (let i = 0; i < meshes.length; i++) {
                const mesh = meshes[i];
                if (!mesh) continue;
                _ti.copy(mesh.position).sub(state.camera.position).normalize();
                const dot = _ti.dot(_cf);
                if (dot > maxDot) { maxDot = dot; best = i; }
            }
            if (best !== nearestRef.current) {
                nearestRef.current = best;
                const url = imagesRef.current[best];
                if (url) cb(url);
            }
        }

        // ── 7. Expose smoothed rotation for external consumers (spatial audio) ──
        if (rotationOutRef) {
            rotationOutRef.current.x = smoothRot.current.x;
            rotationOutRef.current.y = smoothRot.current.y;
        }
    });

    return (
        <>
            {images.map((url, i) => (
                <DreiImage
                    key={url + i}
                    ref={(el) => { meshRefs.current[i] = el as THREE.Mesh | null; }}
                    url={url}
                    transparent
                    position={spherePos[i]?.toArray() as [number, number, number] ?? [0, 0, 0]}
                    scale={[4, 5.5]}
                />
            ))}
        </>
    );
}
