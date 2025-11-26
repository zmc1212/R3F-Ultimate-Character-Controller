import React, { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls, Loader } from '@react-three/drei';
import { Controls, ControlMode } from './types';
import { Experience } from './components/Experience';
import { Interface } from './components/Interface';

const App: React.FC = () => {
  const [controlMode, setControlMode] = useState<ControlMode>('direct');

  const map = useMemo(
    () => [
      { name: Controls.forward, keys: ['ArrowUp', 'KeyW'] },
      { name: Controls.backward, keys: ['ArrowDown', 'KeyS'] },
      { name: Controls.left, keys: ['ArrowLeft', 'KeyA'] },
      { name: Controls.right, keys: ['ArrowRight', 'KeyD'] },
      { name: Controls.jump, keys: ['Space'] },
      { name: Controls.run, keys: ['Shift'] },
    ],
    []
  );

  return (
    <>
      <KeyboardControls map={map}>
        <div className="w-full h-full relative" onContextMenu={(e) => e.preventDefault()}>
          <Canvas
            shadows
            camera={{ position: [0, 5, 8], fov: 45 }}
            className="w-full h-full bg-zinc-900"
          >
            <Suspense fallback={null}>
              <Experience controlMode={controlMode} />
            </Suspense>
          </Canvas>
          <Interface controlMode={controlMode} setControlMode={setControlMode} />
        </div>
      </KeyboardControls>
      <Loader />
    </>
  );
};

export default App;