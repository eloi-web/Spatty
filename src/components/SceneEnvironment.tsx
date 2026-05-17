import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface SceneEnvironmentProps {
    envColor: [number, number, number]; // dominant RGB from nearest image (0-255)
}

/**
 * Sets the scene background and fog to a very subtle tint of the nearest
 * image's dominant colour. Lerps smoothly so transitions feel ambient,
 * not jarring. The blend is kept at 85% white so the canvas never looks
 * heavily coloured — just gently alive.
 */
export function SceneEnvironment({ envColor }: SceneEnvironmentProps) {
    // Sync prop into a ref so the useFrame closure always reads the latest value
    const envColorRef = useRef(envColor);
    envColorRef.current = envColor;

    const lerpedColor = useRef(new THREE.Color(1, 1, 1));
    const targetColor = useRef(new THREE.Color(1, 1, 1));

    useFrame(({ scene }) => {
        const [r, g, b] = envColorRef.current;
        // Blend extracted colour 85% toward white → very subtle ambient tint
        const blend = (c: number) => c / 255 * 0.15 + 0.85;
        targetColor.current.setRGB(blend(r), blend(g), blend(b));

        // Slow lerp so the environment colour drifts gently as you look around
        lerpedColor.current.lerp(targetColor.current, 0.025);

        scene.background = lerpedColor.current;
        if (scene.fog instanceof THREE.Fog) {
            scene.fog.color.copy(lerpedColor.current);
        }
    });

    // Fog is set up declaratively; its colour is updated imperatively above
    return <fog attach="fog" args={['#f8f8f8', 80, 230]} />;
}
