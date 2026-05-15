import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Image as DreiImage } from '@react-three/drei';

interface SphereGalleryProps {
  images: string[];
  interactionRef: React.MutableRefObject<{
    rotationX: number;
    rotationY: number;
    zoomProgress: number;
  }>;
}

export function SphereGallery({ images, interactionRef }: SphereGalleryProps) {
  const groupRef = useRef<THREE.Group>(null);
  const autoRotation = useRef({ x: 0, y: 0 });
  
  // Calculate positions on a sphere
  const positions = useMemo(() => {
    const count = images.length;
    const radius = 35; // Larger radius so photos are spaced out and we can fly inside
    const pos = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
    
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2; // y goes from 1 to -1
      const r = Math.sqrt(1 - y * y); // radius at y
      
      const theta = phi * i; // golden angle increment
      
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      
      pos.push(new THREE.Vector3(x * radius, y * radius, z * radius));
    }
    return pos;
  }, [images.length]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Continuous slow baseline rotation on Y
      autoRotation.current.y += delta * 0.05;
      
      // Target combines continuous rotation and user manual offset
      const targetY = autoRotation.current.y + interactionRef.current.rotationY;
      const targetX = interactionRef.current.rotationX; // Optional pitch rotation
      
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetY,
        0.1
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        targetX,
        0.1
      );
    }
    
    // Zoom control: zoomProgress from 0 to 1.
    // 0 = Far away (Z=80), 1 = Inside (Z=0, passing through)
    const targetZ = 80 - (interactionRef.current.zoomProgress * 100); 
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, 0.05);
  });

  return (
    <group ref={groupRef}>
      {images.map((url, i) => {
        const position = positions[i];
        if (!position) return null;
        
        return (
          <ImageCard 
            key={url + i} 
            url={url} 
            position={position} 
          />
        );
      })}
    </group>
  );
}

function ImageCard({ url, position }: { url: string; position: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (ref.current) {
      // Images face firmly OUTWARD from the sphere center.
      // E.g., if position is at (10, 0, 0), it looks at (20, 0, 0).
      ref.current.lookAt(position.x * 2, position.y * 2, position.z * 2);
      
      if (ref.current.material) {
         // @ts-ignore
         ref.current.material.side = THREE.DoubleSide;
      }
    }
  });

  return (
    <DreiImage
      ref={ref}
      url={url}
      transparent
      position={position}
      scale={[4, 5.5]} // A balanced portrait ratio
    />
  );
}
