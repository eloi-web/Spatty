import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, DepthOfField } from '@react-three/postprocessing';
import type { DepthOfFieldEffect } from 'postprocessing';

export function PostEffects() {
    const dofRef = useRef<DepthOfFieldEffect>(null);

    useFrame((state) => {
        const effect = dofRef.current;
        if (!effect) return;

        const camZ = state.camera.position.z;
        const far = (state.camera as THREE.PerspectiveCamera).far;

        // Actual distance from camera to the nearest sphere images.
        // Sphere front face ≈ 28 world units closer than the camera position.
        // In tunnel mode (camZ ≤ 0) the images are always close, treat as 18 units.
        const distToImages = Math.max(1, camZ > 0 ? camZ - 28 : 18);

        // Focus exactly on the nearest images so nothing you're looking at is blurred.
        (effect as any).focusDistance = Math.min(0.4, Math.max(0.001, distToImages / far));

        // Bokeh = 0 when close-up (≤ 30 units) → pixel-sharp images when zoomed in.
        // Ramps smoothly up to 4.5 only when far away (≥ 85 units) → galaxy atmosphere.
        (effect as any).bokehScale = THREE.MathUtils.lerp(
            0,
            4.5,
            THREE.MathUtils.smoothstep(distToImages, 30, 85)
        );
    });

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    return (
        <EffectComposer multisampling={isMobile ? 0 : 4}>
            <DepthOfField
                ref={dofRef}
                focusDistance={0.08}
                focalLength={0.022}
                bokehScale={3}
                height={480}
            />
        </EffectComposer>
    );
}
