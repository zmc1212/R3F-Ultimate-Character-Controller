import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls, useAnimations, useGLTF, Html } from '@react-three/drei';
import { RigidBody, RapierRigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import { useControls } from 'leva';
import { Controls, ControlMode } from '../types';

const MODEL_URL = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Xbot.glb";

interface CharacterProps {
  controlMode?: ControlMode;
  movementTarget?: THREE.Vector3 | null;
  onUpdate?: (data: { x: number; y: number; z: number; rotation: number; animation: string }) => void;
  playerName?: string;
}

export const Character: React.FC<CharacterProps> = ({ 
  controlMode = 'direct', 
  movementTarget,
  onUpdate,
  playerName = "Player"
}) => {
  // Leva Controls
  const { 
    walkSpeed, 
    runSpeed, 
    rotationSpeed, 
    jumpForce,
    camSens 
  } = useControls('Character Controls', {
    walkSpeed: { value: 4, min: 1, max: 10 },
    runSpeed: { value: 7, min: 1, max: 15 },
    rotationSpeed: { value: 12, min: 1, max: 20 },
    jumpForce: { value: 5.5, min: 3, max: 10 },
    camSens: { value: 0.005, min: 0.001, max: 0.01, label: 'Camera Sensitivity' }
  });

  // Use refs for sensitivity to use in event listeners without re-binding
  const sensitivityRef = useRef(camSens);
  useEffect(() => { sensitivityRef.current = camSens; }, [camSens]);

  // Refs
  const rigidBody = useRef<RapierRigidBody>(null);
  const characterGroup = useRef<THREE.Group>(null);
  const isOnFloor = useRef(true);
  const wasOnFloor = useRef(true);
  const isLanding = useRef(false);
  
  // Model loading
  const { scene, animations } = useGLTF(MODEL_URL);
  // FIX: Use scene directly instead of cloning. 
  // scene.clone() breaks SkinnedMeshes without SkeletonUtils, causing the mesh to disappear on animation.
  // Since we only have one character, using the original scene is safe and performant.
  const { actions } = useAnimations(animations, characterGroup);

  // Input
  const [, getKeys] = useKeyboardControls<Controls>();
  
  // State
  const [animation, setAnimation] = useState<string>('idle');

  // Logic for smooth rotation
  const currentRotation = useRef(0);
  const targetRotation = useRef(0);

  // Camera Orbit Control
  const isDragging = useRef(false);
  const cameraOrbit = useRef(0); // Horizontal angle
  const cameraPolar = useRef(Math.PI / 4); // Vertical angle (starts looking down slightly)

  // Point to click state
  const currentNavTarget = useRef<THREE.Vector3 | null>(null);
  const lastPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const stuckTime = useRef(0);

  // Rapier Raycasting for ground check and obstacle avoidance
  const { world, rapier } = useRapier();

  // Throttling network updates
  const lastUpdateRef = useRef(0);

  // Handle Mouse Drag for Camera
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) { // Right click
        isDragging.current = true;
      }
    };
    
    const handleMouseUp = () => {
      isDragging.current = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        cameraOrbit.current -= e.movementX * sensitivityRef.current;
        // Invert Y axis for natural feel, clamp to prevent flipping
        cameraPolar.current = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, cameraPolar.current - e.movementY * sensitivityRef.current));
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Update nav target when prop changes
  useEffect(() => {
    if (controlMode === 'pointToClick' && movementTarget) {
      currentNavTarget.current = movementTarget.clone();
      stuckTime.current = 0; // Reset stuck timer on new target
    }
  }, [movementTarget, controlMode]);

  // Reset target when switching to direct
  useEffect(() => {
    if (controlMode === 'direct') {
      currentNavTarget.current = null;
    }
  }, [controlMode]);

  // Animation Management
  useEffect(() => {
    const animName = 
      animation === 'idle' ? 'idle' :
      animation === 'walk' ? 'walk' :
      animation === 'run' ? 'run' : 
      animation === 'jump' ? 'jump' : 
      animation === 'land' ? 'land' : 'idle';

    // Fallback to idle if specific animation missing (e.g. land/jump on some models)
    const action = actions[animName] || actions['idle'];
    
    if (action) {
      if (animName === 'jump') {
          action.reset().fadeIn(0.1).setLoop(THREE.LoopOnce, 1).play();
          action.clampWhenFinished = true;
      } else if (animName === 'land') {
          action.reset().fadeIn(0.05).setLoop(THREE.LoopOnce, 1).play();
          action.clampWhenFinished = true;
      } else {
          action.reset().fadeIn(0.2).play();
      }
    }
    
    return () => {
      if (action) action.fadeOut(0.2);
    };
  }, [animation, actions]);

  useFrame((state, delta) => {
    if (!rigidBody.current || !characterGroup.current) return;

    const linvel = rigidBody.current.linvel();
    let currentYVelocity = linvel.y;
    const currentPos = rigidBody.current.translation();

    // 1. Ground Check
    const rayOrigin = { x: currentPos.x, y: currentPos.y + 0.5, z: currentPos.z };
    const rayDir = { x: 0, y: -1, z: 0 };
    
    let groundDistance = 100;
    if (rapier && world) {
        const ray = new rapier.Ray(rayOrigin, rayDir);
        const hit = world.castRay(ray, 2.0, true);
        if (hit) {
            groundDistance = hit.timeOfImpact;
        }
    }
    isOnFloor.current = groundDistance < 0.6;

    // 2. Landing Logic
    if (!wasOnFloor.current && isOnFloor.current) {
        // Character just hit the ground
        // Only trigger land animation if falling speed was significant
        if (currentYVelocity < -2.0) {
            isLanding.current = true;
            setAnimation('land');
            
            // Lock movement for a short duration to emphasize impact
            setTimeout(() => {
                isLanding.current = false;
            }, 200);
        }
    }
    wasOnFloor.current = isOnFloor.current;

    // 3. Determine Movement Input
    const keys = getKeys();
    const { forward, backward, left, right, jump, run } = keys;

    let moveX = 0;
    let moveZ = 0;
    let desiredSpeed = 0;
    let newAnimation = animation; // Default to keeping current

    // Only process movement if we aren't currently landing
    if (!isLanding.current) {
        // --- DIRECT CONTROL MODE ---
        if (controlMode === 'direct') {
          desiredSpeed = run ? runSpeed : walkSpeed;

          if (forward || backward || left || right) {
            newAnimation = run ? 'run' : 'walk';

            // Camera Direction
            const camForward = new THREE.Vector3(0, 0, -1);
            const camRight = new THREE.Vector3(1, 0, 0);
            
            // We calculate direction based on the orbit angle
            const orbitQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cameraOrbit.current);
            
            camForward.applyQuaternion(orbitQuat);
            camRight.applyQuaternion(orbitQuat);

            const moveDir = new THREE.Vector3(0,0,0);
            if (forward) moveDir.add(camForward);
            if (backward) moveDir.sub(camForward);
            if (right) moveDir.add(camRight);
            if (left) moveDir.sub(camRight);
            
            moveDir.normalize();

            moveX = moveDir.x * desiredSpeed;
            moveZ = moveDir.z * desiredSpeed;
            
            targetRotation.current = Math.atan2(moveX, moveZ);
          } else {
            desiredSpeed = 0;
            newAnimation = 'idle';
          }
        } 
        // --- POINT TO CLICK MODE ---
        else if (controlMode === 'pointToClick' && currentNavTarget.current) {
            const target = currentNavTarget.current;
            let dx = target.x - currentPos.x;
            let dz = target.z - currentPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            // Stuck detection
            const distMoved = new THREE.Vector3(currentPos.x, 0, currentPos.z).distanceTo(
                new THREE.Vector3(lastPosition.current.x, 0, lastPosition.current.z)
            );
            lastPosition.current.copy(currentPos);
            
            if (distMoved < 0.01 * runSpeed) { // If moving very slowly
                stuckTime.current += delta;
            } else {
                stuckTime.current = 0;
            }

            // Increased stuck tolerance to 2 seconds to allow for navigation
            if (distance > 0.5 && stuckTime.current < 2.0) {
                newAnimation = 'run'; // Always run to target
                desiredSpeed = runSpeed;
                
                // Basic direction to target
                const rawDir = new THREE.Vector3(dx, 0, dz).normalize();
                let finalDir = rawDir.clone();

                // OBSTACLE AVOIDANCE STEERING
                if (rapier && world) {
                    const whiskerOrigin = { x: currentPos.x, y: currentPos.y + 0.5, z: currentPos.z };
                    
                    // Whiskers: Center, Left, Right
                    const whiskers = [
                        { angle: 0, weight: 1.0, length: 2.0 },        // Front
                        { angle: -Math.PI / 3, weight: 0.8, length: 1.5 }, // Right
                        { angle: Math.PI / 3, weight: 0.8, length: 1.5 },  // Left
                    ];

                    let avoidanceVector = new THREE.Vector3();
                    let hasCollision = false;

                    whiskers.forEach(whisker => {
                        const scanDir = rawDir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), whisker.angle);
                        const ray = new rapier.Ray(whiskerOrigin, { x: scanDir.x, y: 0, z: scanDir.z });
                        const hit = world.castRay(ray, whisker.length, true);

                        if (hit) {
                            const toi = hit.timeOfImpact;
                            // Filter out self-collision (radius ~0.5)
                            if (toi > 0.55) {
                                hasCollision = true;
                                // Calculate repulsion: stronger as we get closer
                                const repulsionStrength = (whisker.length - toi) / whisker.length;
                                const repulsion = scanDir.clone().negate().multiplyScalar(repulsionStrength * whisker.weight * 3);
                                avoidanceVector.add(repulsion);
                            }
                        }
                    });

                    if (hasCollision) {
                        finalDir.add(avoidanceVector);
                        finalDir.normalize();
                    }
                }

                moveX = finalDir.x * desiredSpeed;
                moveZ = finalDir.z * desiredSpeed;

                targetRotation.current = Math.atan2(moveX, moveZ);
            } else {
                // Arrived or stuck
                currentNavTarget.current = null;
                desiredSpeed = 0;
                stuckTime.current = 0;
                newAnimation = 'idle';
            }
        }
    } else {
        // Landing mode - freeze horizontal movement
        moveX = 0;
        moveZ = 0;
        newAnimation = 'land';
    }

    // 4. Jump
    // Can only jump if on floor and not currently in the middle of a heavy landing
    if (jump && isOnFloor.current && !isLanding.current) {
       currentYVelocity = jumpForce;
       newAnimation = 'jump';
       isLanding.current = false; // Cancel landing state if we jump immediately (bunny hop)
    }

    // 5. Override Animation for Air State
    if (!isOnFloor.current) {
        newAnimation = 'jump';
    }

    // 6. Update Animation State
    if (animation !== newAnimation) {
        setAnimation(newAnimation);
    }

    // 7. Apply Physics
    rigidBody.current.setLinvel({ 
      x: moveX, 
      y: currentYVelocity, 
      z: moveZ 
    }, true);

    // 8. Smooth Rotation
    if (desiredSpeed > 0 || (controlMode === 'pointToClick' && currentNavTarget.current)) {
       let angleDiff = targetRotation.current - currentRotation.current;
       while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
       while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
       
       currentRotation.current += angleDiff * rotationSpeed * delta;
       characterGroup.current.rotation.y = currentRotation.current;
    }

    // 9. Camera Follow with Spherical Orbit
    const radius = 6;
    const phi = cameraPolar.current;
    const theta = cameraOrbit.current;

    const offsetX = radius * Math.sin(phi) * Math.sin(theta);
    const offsetY = radius * Math.cos(phi);
    const offsetZ = radius * Math.sin(phi) * Math.cos(theta);

    const targetCameraPos = new THREE.Vector3(
        currentPos.x + offsetX,
        currentPos.y + offsetY + 1.5, // Lift pivot point slightly
        currentPos.z + offsetZ
    );

    // Smoothly interpolate camera position
    state.camera.position.lerp(targetCameraPos, 0.1);
    
    // Look at character
    const lookAtTarget = new THREE.Vector3(currentPos.x, currentPos.y + 1.5, currentPos.z);
    state.camera.lookAt(lookAtTarget);

    // 10. NETWORK SYNC
    // Emit updates ~20 times per second to save bandwidth
    if (onUpdate && Date.now() - lastUpdateRef.current > 50) {
        onUpdate({
            x: currentPos.x,
            y: currentPos.y,
            z: currentPos.z,
            rotation: currentRotation.current,
            animation: newAnimation
        });
        lastUpdateRef.current = Date.now();
    }
  });

  return (
    <RigidBody 
      ref={rigidBody} 
      colliders={false} 
      enabledRotations={[false, false, false]} 
      position={[0, 5, 0]}
      friction={1}
    >
      <CapsuleCollider args={[0.5, 0.4]} position={[0, 0.9, 0]} />
      <group ref={characterGroup} dispose={null}>
         <primitive object={scene} scale={1} />
         {/* Name Tag */}
         <Html position={[0, 2.2, 0]} center>
            <div className="bg-black/50 backdrop-blur-sm border border-[#00ffcc]/50 px-2 py-0.5 rounded text-[10px] text-[#00ffcc] font-mono whitespace-nowrap">
                {playerName}
            </div>
         </Html>
      </group>
    </RigidBody>
  );
};

// Preload to prevent hydration glitches
useGLTF.preload(MODEL_URL);