'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState, Component, type ReactNode } from 'react';
import * as THREE from 'three';
import { trends } from '@/data/demo';
import { readState } from '@/services';

function useMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches || readState().reducedMotion);
    update();
    media.addEventListener('change', update);
    window.addEventListener('medintel-change', update);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('medintel-change', update);
    };
  }, []);
  return reduced;
}

const names = [
  'HEALTH INTELLIGENCE',
  'PATIENT RECORDS',
  'VISIT HISTORY',
  'PRESCRIPTIONS',
  'DISEASE TRENDS',
  'REGIONAL INSIGHTS',
  'PRIVACY CONTROLS'
];

const positions: [number, number, number][] = [
  [0, 0, 0],
  [-1.8, 1, 0.2],
  [1.7, 0.85, 0.4],
  [1.75, -0.75, -0.3],
  [-1.6, -0.9, 0.4],
  [0.3, 1.65, -0.5],
  [-0.4, -1.6, -0.3]
];

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Focus({ point }: { point: [number, number, number] | null }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 6.6));
  useEffect(() => {
    target.current.set(point ? point[0] * 0.4 : 0, point ? point[1] * 0.4 : 0, point ? 5.4 : 6.6);
  }, [point]);
  useFrame((_, delta) => camera.position.lerp(target.current, Math.min(delta * 2, 1)));
  return null;
}

function NetworkScene({
  selected,
  onSelect,
  reduced,
  labels,
  descriptions
}: {
  selected: number;
  onSelect: (i: number) => void;
  reduced: boolean;
  labels: string[];
  descriptions?: string[];
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current && !reduced) {
      ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.12) * 0.15;
    }
  });

  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[3, 4, 5]} intensity={2.8} color="#ffffff" />
      <pointLight position={[-3, -2, 3]} color="#82BE90" intensity={8} />
      <pointLight position={[3, 2, -2]} color="#4C75F2" intensity={8} />
      <group ref={ref}>
        {positions.slice(1).map((p, i) => {
          const isLineActive = selected === i + 1;
          return (
            <Line
              key={i}
              points={[[0, 0, 0], p]}
              color={isLineActive ? '#82BE90' : '#3A4D4A'}
              transparent
              opacity={isLineActive ? 0.95 : 0.25}
              lineWidth={isLineActive ? 2.5 : 1}
            />
          );
        })}
        {positions.map((p, i) => {
          const isCurrent = selected === i;
          const scaleVal = isCurrent ? 1.08 : i === 0 ? 1 : 0.94;
          const nodeColor = i === 0 ? (isCurrent ? '#82BE90' : '#4C75F2') : isCurrent ? '#82BE90' : '#2E3D3A';
          const nodeOpacity = isCurrent ? 0.98 : i === 0 ? 0.75 : 0.5;
          return (
            <group key={labels[i]} position={p}>
              <mesh onClick={(e) => { e.stopPropagation(); onSelect(i); }} scale={scaleVal}>
                <sphereGeometry args={[i === 0 ? 0.9 : 0.18, 32, 20]} />
                <meshStandardMaterial
                  color={nodeColor}
                  transparent
                  opacity={nodeOpacity}
                  roughness={0.25}
                  metalness={0.2}
                />
              </mesh>
              {i === 0 && (
                <mesh scale={isCurrent ? 1.04 : 1}>
                  <sphereGeometry args={[0.91, 18, 12]} />
                  <meshBasicMaterial
                    color={isCurrent ? '#82BE90' : '#4C75F2'}
                    wireframe
                    transparent
                    opacity={isCurrent ? 0.4 : 0.2}
                  />
                </mesh>
              )}
              <Html position={[0, i === 0 ? 0 : 0.34, 0]} center>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <button className={'node-label ' + (isCurrent ? 'selected' : 'muted-node')} onClick={() => onSelect(i)}>
                    {labels[i]}
                  </button>
                  {isCurrent && descriptions && descriptions[i] && (
                    <div
                      style={{
                        marginTop: '5px',
                        background: 'rgba(22, 25, 28, 0.92)',
                        color: '#FFFFFF',
                        border: '1px solid rgba(130, 190, 144, 0.3)',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        width: '150px',
                        textAlign: 'center',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(8px)'
                      }}
                    >
                      {descriptions[i]}
                    </div>
                  )}
                </div>
              </Html>
            </group>
          );
        })}
      </group>
      <Focus point={selected ? positions[selected] : null} />
    </>
  );
}

export function ClinicalIntelligenceModel({
  onSelect,
  compact = false,
  activeIndex,
  labels = names,
  descriptions
}: {
  onSelect?: (name: string, index: number) => void;
  compact?: boolean;
  activeIndex?: number;
  labels?: string[];
  descriptions?: string[];
}) {
  const [selected, setSelected] = useState(0);
  const reduced = useMotion();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  useEffect(() => {
    if (activeIndex !== undefined) setSelected(activeIndex);
  }, [activeIndex]);

  const choose = (i: number) => {
    setSelected(i);
    onSelect?.(labels[i], i);
  };

  const fallback = (
    <div className="model-fallback">
      {labels.map((n, i) => (
        <button className="chip" key={n} onClick={() => choose(i)}>
          {n}
        </button>
      ))}
    </div>
  );

  return (
    <div className={'model ' + (compact ? 'compact' : '')} aria-label="Interactive clinical evidence network">
      {ready ? (
        <Boundary fallback={fallback}>
          <Canvas
            dpr={[1, 1.25]}
            camera={{ position: [0, 0, 6.6], fov: 43 }}
            gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          >
            <Suspense fallback={null}>
              <NetworkScene
                selected={selected}
                onSelect={choose}
                reduced={reduced}
                labels={labels}
                descriptions={descriptions}
              />
            </Suspense>
          </Canvas>
        </Boundary>
      ) : (
        fallback
      )}
    </div>
  );
}

const xyz = (lat: number, lon: number, r = 1.75): [number, number, number] => {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  ];
};

function GlobeScene({
  selected,
  onSelect,
  reduced
}: {
  selected: string;
  onSelect: (id: string) => void;
  reduced: boolean;
}) {
  const [rings, setRings] = useState<number[][][]>([]);
  useEffect(() => {
    fetch('/land.geojson')
      .then((r) => r.json())
      .then((data: unknown) =>
        setRings(
          (data as { features: unknown[] }).features.flatMap((f: unknown) =>
            (f as { geometry: { type: string; coordinates: number[][][] | number[][][][] } }).geometry.type === 'Polygon'
              ? (f as { geometry: { coordinates: number[][][] } }).geometry.coordinates
              : ((f as { geometry: { coordinates: number[][][][] } }).geometry.coordinates).flat()
          )
        )
      )
      .catch(() => {});
  }, []);

  const grid = useMemo(() => {
    const lines: [number, number, number][][] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      lines.push(Array.from({ length: 73 }, (_, i) => xyz(lat, i * 5 - 180)));
    }
    for (let lon = -180; lon < 180; lon += 30) {
      lines.push(Array.from({ length: 37 }, (_, i) => xyz(i * 5 - 90, lon)));
    }
    return lines;
  }, []);

  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[4, 4, 6]} intensity={2} />
      <mesh>
        <sphereGeometry args={[1.73, 48, 32]} />
        <meshStandardMaterial color="#F5F7F4" roughness={0.68} />
      </mesh>
      {grid.map((points, i) => (
        <Line key={i} points={points} color="#DCE6E2" lineWidth={0.6} transparent opacity={0.45} />
      ))}
      {rings.map((ring, i) => (
        <Line key={'land' + i} points={ring.map(([lon, lat]) => xyz(lat, lon, 1.76))} color="#D5B779" lineWidth={1.2} />
      ))}
      {trends.map((t) => (
        <group key={t.id} position={xyz(t.lat, t.lon, 1.8)}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onSelect(t.id);
            }}
          >
            <sphereGeometry args={[t.id === selected ? 0.075 : 0.045, 16, 12]} />
            <meshBasicMaterial color={t.id === selected ? '#237C78' : '#D5B779'} />
          </mesh>
          <Html center distanceFactor={8} occlude position={[0, 0.13, 0]}>
            <button className={'globe-label ' + (t.id === selected ? 'selected' : '')} onClick={() => onSelect(t.id)}>
              {t.region}
            </button>
          </Html>
        </group>
      ))}
      <OrbitControls enablePan={false} minDistance={3.2} maxDistance={8} autoRotate={!reduced} autoRotateSpeed={0.35} />
    </>
  );
}

export function DiseaseGlobe({
  selected,
  onSelect
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [ready, setReady] = useState(false);
  const reduced = useMotion();
  useEffect(() => {
    setReady(true);
  }, []);

  const fallback = (
    <div className="model-fallback">
      {trends.map((t) => (
        <button className="chip" onClick={() => onSelect(t.id)} key={t.id}>
          {t.region}
        </button>
      ))}
    </div>
  );

  return (
    <div className="globe" aria-label="Interactive globe. Drag to rotate, scroll to zoom. Regions also available below.">
      {ready ? (
        <Boundary fallback={fallback}>
          <Canvas camera={{ position: [3, 1.8, 4.5], fov: 43 }} dpr={[1, 1.25]}>
            <Suspense fallback={null}>
              <GlobeScene selected={selected} onSelect={onSelect} reduced={reduced} />
            </Suspense>
          </Canvas>
        </Boundary>
      ) : (
        fallback
      )}
    </div>
  );
}
