import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

interface StarFieldProps {
  count?: number;
  speed: number;
}

const FlyingStars = ({ count = 500, speed }: StarFieldProps) => {
  const meshRef = useRef<THREE.Points>(null);
  
  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 2] = Math.random() * -100;
      velocities[i] = 0.5 + Math.random() * 1.5;
    }
    
    return { positions, velocities };
  }, [count]);

  useFrame(() => {
    if (!meshRef.current) return;
    
    const positions = meshRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 2] += particles.velocities[i] * speed * 0.5;
      
      if (positions[i * 3 + 2] > 10) {
        positions[i * 3 + 2] = -100;
        positions[i * 3] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      }
    }
    
    meshRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.3}
        color="#fbbf24"
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
};

const SpeedLines = ({ count = 100, speed }: StarFieldProps) => {
  const linesRef = useRef<THREE.Group>(null);
  
  const lines = useMemo(() => {
    const linesData = [];
    for (let i = 0; i < count; i++) {
      linesData.push({
        x: (Math.random() - 0.5) * 60,
        y: (Math.random() - 0.5) * 60,
        z: Math.random() * -80,
        length: 2 + Math.random() * 6,
        speed: 0.8 + Math.random() * 1.2,
      });
    }
    return linesData;
  }, [count]);

  useFrame(() => {
    if (!linesRef.current) return;
    
    linesRef.current.children.forEach((line, i) => {
      line.position.z += lines[i].speed * speed * 0.8;
      
      if (line.position.z > 10) {
        line.position.z = -80;
        line.position.x = (Math.random() - 0.5) * 60;
        line.position.y = (Math.random() - 0.5) * 60;
      }
    });
  });

  return (
    <group ref={linesRef}>
      {lines.map((line, i) => (
        <mesh key={i} position={[line.x, line.y, line.z]}>
          <boxGeometry args={[0.02, 0.02, line.length]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
};

const Nebula = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -50]}>
      <planeGeometry args={[120, 120]} />
      <meshBasicMaterial 
        color="#1e1b4b" 
        transparent 
        opacity={0.3}
      />
    </mesh>
  );
};

interface FlightBackground3DProps {
  isFlying: boolean;
  multiplier: number;
}

const FlightBackground3D = ({ isFlying, multiplier }: FlightBackground3DProps) => {
  const speed = isFlying ? Math.min(multiplier * 0.5, 3) : 0.1;
  
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.3} />
        
        {/* Static background stars */}
        <Stars
          radius={100}
          depth={50}
          count={2000}
          factor={4}
          saturation={0}
          fade
          speed={0.5}
        />
        
        {/* Flying stars (speed lines effect) */}
        <FlyingStars count={400} speed={speed} />
        
        {/* Speed lines */}
        {isFlying && <SpeedLines count={80} speed={speed} />}
        
        {/* Background nebula */}
        <Nebula />
      </Canvas>
    </div>
  );
};

export default FlightBackground3D;
