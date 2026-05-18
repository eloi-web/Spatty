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

        // Sphere mode (camZ > 0): focus on the sphere surface ahead of camera.
        // The sphere front is roughly 28 units closer than the camera.
        // Tunnel mode (camZ ≤ 0): keep focus a fixed 18 world units ahead.
        const focusDist = camZ > 0 ? Math.max(8, camZ - 28) : 18;
        const normalizedFocus = Math.min(0.4, Math.max(0.001, focusDist / far));

        (effect as any).focusDistance = normalizedFocus;

        // Bokeh scale: dreamy when far from the scene, crisp when up-close.
        const distFactor = Math.min(1, Math.abs(camZ) / 100);
        (effect as any).bokehScale = THREE.MathUtils.lerp(1.5, 4.5, distFactor);
    });

    return (
        <EffectComposer multisampling={4}>
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
