import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Image as DreiImage } from '@react-three/drei';

interface ThroughGalleryProps {
  images: string[];
  interactionRef: React.MutableRefObject<{
    rotationX: number;
    rotationY: number;
    zoomProgress: number;
  }>;
}

const SPACING = 4;

export function ThroughGallery({ images, interactionRef }: ThroughGalleryProps) {
  // Positions are stable per images.length; Math.random() is fine inside useMemo
  const positions = useMemo(() => {
    return images.map((_, i) => {
      const x = (i % 2 === 0 ? -1 : 1) * (4 + Math.random() * 2);
      const y = (Math.random() - 0.5) * 6;
      const z = -(i + 1) * SPACING; // images start in front of camera (camera at Z=0)
      return new THREE.Vector3(x, y, z);
    });
  }, [images.length]);

  useFrame((state) => {
    const tunnelLength = images.length * SPACING;

    // Fly the camera forward (negative Z) as scroll progresses
    const targetCamZ = -(interactionRef.current.zoomProgress * tunnelLength);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetCamZ, 0.07);

    // Gentle look-around from drag
    state.camera.rotation.x = THREE.MathUtils.lerp(
      state.camera.rotation.x,
      -interactionRef.current.rotationX * 0.2,
      0.08
    );
    state.camera.rotation.y = THREE.MathUtils.lerp(
      state.camera.rotation.y,
      -interactionRef.current.rotationY * 0.2,
      0.08
    );
  });

  return (
    <group>
      {images.map((url, i) => {
        const position = positions[i];
        if (!position) return null;
        return <ThroughCard key={url + i} url={url} position={position} />;
      })}
    </group>
  );
}

function ThroughCard({ url, position }: { url: string; position: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    // Cards face +Z (toward where the camera starts). DoubleSide makes them
    // visible both on approach and after the camera flies past.
    if (ref.current?.material) {
      // @ts-ignore
      ref.current.material.side = THREE.DoubleSide;
    }
  });

  return (
    <DreiImage
      ref={ref}
      url={url}
      transparent
      position={position}
      scale={[4, 5.5]}
    />
  );
}
