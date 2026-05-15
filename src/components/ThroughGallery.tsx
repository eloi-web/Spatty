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

export function ThroughGallery({ images, interactionRef }: ThroughGalleryProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Calculate positions for a "tunnel" effect
  const positions = useMemo(() => {
    const pos = [];
    const count = images.length;
    // We want them to form a corridor
    // Z goes from 0 to -count * spacing
    const spacing = 3; 
    
    for (let i = 0; i < count; i++) {
       // Alternate left and right
       const x = (i % 2 === 0 ? -1 : 1) * (4 + Math.random() * 2); 
       // Vary height slightly
       const y = (Math.random() - 0.5) * 6;
       const z = -i * spacing;
       
       pos.push(new THREE.Vector3(x, y, z));
    }
    return pos;
  }, [images.length]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // The camera looks along -Z. 
      // Depth progress makes the gallery move towards the camera (positive Z direction)
      const tunnelLength = images.length * 3;
      // We map the zoomProgress from 0 to 1 to 0 to tunnelLength
      // Or we map rotationY to movement depending on what looks better.
      // Let's map zoomProgress AND rotationY logic for continuous forward motion
      
      // zoomProgress is best here because it is a linear 0 to 1 value (but maybe you can zoom past 1? No, locked to 1)
      const targetZ = (interactionRef.current.zoomProgress * tunnelLength) + (interactionRef.current.rotationY * 10);
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        targetZ,
        0.1
      );
    }
  });

  return (
    <group ref={groupRef}>
      {images.map((url, i) => {
        const position = positions[i];
        if (!position) return null;
        
        return (
          <ThroughCard 
            key={url + i} 
            url={url} 
            position={position} 
          />
        );
      })}
    </group>
  );
}

const dummy = new THREE.Object3D();

function ThroughCard({ url, position }: { url: string; position: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ref.current) {
      // Make images face camera directly to remain steady
      ref.current.lookAt(state.camera.position);
      
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
      scale={[4, 5.5]} 
    />
  );
}
