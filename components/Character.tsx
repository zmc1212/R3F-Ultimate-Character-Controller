
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls, useAnimations, useGLTF, Html } from '@react-three/drei';
import { RigidBody, RapierRigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import { useControls } from 'leva';
import { Controls, ControlMode } from '../types';

const MODEL_URL = "/models/fmale.glb";

interface CharacterProps {
  controlMode?: ControlMode;
  movementTarget?: THREE.Vector3 | null;
  onUpdate?: (data: { x: number; y: number; z: number; rotation: number; animation: string }) => void;
  playerName?: string;
  onTargetReached?: () => void;
  isSitting?: boolean;
  sitPose?: { position: THREE.Vector3; rotation: number } | null;
  onStopSitting?: () => void;
}

export const Character: React.FC<CharacterProps> = ({ 
  controlMode = 'direct', 
  movementTarget,
  onUpdate,
  playerName = "Player",
  onTargetReached,
  isSitting = false,
  sitPose = null,
  onStopSitting
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
  const jumpType = useRef<'Jump' | 'RunJump'>('Jump');
  const jumpCooldown = useRef(0);
  
  // Model loading
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, characterGroup);

  // Input
  const [, getKeys] = useKeyboardControls<Controls>();
  
  // State
  const [animation, setAnimation] = useState<string>('Idle');

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
    if (movementTarget) {
      currentNavTarget.current = movementTarget.clone();
      stuckTime.current = 0; // Reset stuck timer on new target
    }
  }, [movementTarget]);

  // Animation Management
  useEffect(() => {
    // Determine the animation name
    let animName = 'Idle';
    
    if (isSitting) {
        if (actions['Sitting']) animName = 'Sitting';
        else if (actions['Sit']) animName = 'Sit';
        else animName = 'Idle';
    } else {
        animName = 
          animation === 'Idle' ? 'Idle' :
          animation === 'Walking' ? 'Walking' :
          animation === 'Run' ? 'Run' : 
          animation === 'Jump' ? 'Jump' : 
          animation === 'RunJump' ? 'RunJump' :
          animation === 'land' ? 'land' : 'Idle';
    }

    const action = actions[animName] || actions['Idle'];
    
    if (action) {
      if (animName === 'Jump') {
          action.reset().fadeIn(0.1).setLoop(THREE.LoopOnce, 1).play();
          action.clampWhenFinished = true;
      } else if (animName === 'RunJump') {
          // If RunJump exists, play it. Otherwise fallback to Jump if logic below fails.
          const runJumpAction = actions['RunJump'] || actions['Jump'];
          if (runJumpAction) {
             runJumpAction.reset().fadeIn(0.1).setLoop(THREE.LoopOnce, 1).play();
             runJumpAction.clampWhenFinished = true;
             // Slow down the RunJump animation to make it last longer (0.6x speed)
             runJumpAction.timeScale = 0.6;
          }
      } else if (animName === 'land') {
          action.reset().fadeIn(0.05).setLoop(THREE.LoopOnce, 1).play();
          action.clampWhenFinished = true;
      } else {
          action.reset().fadeIn(0.2).play();
          action.timeScale = 1; // Reset timeScale for normal loops
      }
    }
    
    return () => {
      // Clean up previous action
      if (action) action.fadeOut(0.2);
      const fallback = actions['RunJump'] || actions['Jump'];
      if (animName === 'RunJump' && fallback) fallback.fadeOut(0.2);
    };
  }, [animation, actions, isSitting]);

  useFrame((state, delta) => {
    if (!rigidBody.current || !characterGroup.current) return;

    // Get input keys early
    const keys = getKeys();
    const { forward, backward, left, right, jump, run } = keys;

    // --- SITTING STATE ---
    if (isSitting && sitPose) {
        // Check if player wants to stand up
        if (onStopSitting && (forward || backward || left || right || jump)) {
            onStopSitting();
            return;
        }

        // Lock physics
        rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        rigidBody.current.setTranslation(sitPose.position, true);
        
        // Smooth rotation (Increased speed for snappier sit alignment)
        let angleDiff = sitPose.rotation - currentRotation.current;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        currentRotation.current += angleDiff * 10 * delta; // Faster rotation correction (10)
        characterGroup.current.rotation.y = currentRotation.current;
        
        if (onUpdate && Date.now() - lastUpdateRef.current > 50) {
            onUpdate({
                x: sitPose.position.x,
                y: sitPose.position.y,
                z: sitPose.position.z,
                rotation: currentRotation.current,
                animation: actions['Sitting'] ? 'Sitting' : (actions['Sit'] ? 'Sit' : 'Idle')
            });
            lastUpdateRef.current = Date.now();
        }

        // Camera Logic during Sitting
        const radius = 6;
        const phi = cameraPolar.current;
        const theta = cameraOrbit.current;
        const offsetX = radius * Math.sin(phi) * Math.sin(theta);
        const offsetY = radius * Math.cos(phi);
        const offsetZ = radius * Math.sin(phi) * Math.cos(theta);
        const targetCameraPos = new THREE.Vector3(
            sitPose.position.x + offsetX,
            sitPose.position.y + offsetY + 1.5,
            sitPose.position.z + offsetZ
        );
        state.camera.position.lerp(targetCameraPos, 0.1);
        state.camera.lookAt(new THREE.Vector3(sitPose.position.x, sitPose.position.y + 1.5, sitPose.position.z));
        return; 
    }

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
        if (hit) groundDistance = hit.timeOfImpact;
    }
    
    // CRITICAL FIX: If vertical velocity is positive (moving up), we are definitely NOT on floor.
    // This overrides the raycast which might still hit ground during takeoff.
    // if (currentYVelocity > 0.5) {
    //     isOnFloor.current = false;
    // } else {
    //     isOnFloor.current = groundDistance < 0.6;
    // }

    // 2. Landing Logic
    if (!wasOnFloor.current && isOnFloor.current) {
        // Only trigger land if we were falling significantly
        if (currentYVelocity < -2.0) {
            isLanding.current = true;
            setAnimation('land');
            setTimeout(() => { isLanding.current = false; }, 200);
        }
    }
    wasOnFloor.current = isOnFloor.current;

    // 3. Movement Logic
    let moveX = 0;
    let moveZ = 0;
    let desiredSpeed = 0;
    let newAnimation = animation;

    // Has Manual Input?
    const isManualMove = forward || backward || left || right;

    // If Landing, disable movement briefly
    if (isLanding.current) {
        moveX = 0; 
        moveZ = 0;
        newAnimation = 'land';
    } 
    else {
        // --- MOVEMENT CALCULATION ---
        if (isManualMove) {
            // Cancel auto-nav target
            if (currentNavTarget.current) {
                currentNavTarget.current = null;
            }

            desiredSpeed = run ? runSpeed : walkSpeed;
            // Only set ground animations if ON FLOOR
            if (isOnFloor.current) {
                newAnimation = run ? 'Run' : 'Walking';
            }

            const camForward = new THREE.Vector3(0, 0, -1);
            const camRight = new THREE.Vector3(1, 0, 0);
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
        }
        else if (currentNavTarget.current) {
            // Auto Nav Logic
            const target = currentNavTarget.current;
            let dx = target.x - currentPos.x;
            let dz = target.z - currentPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            const distMoved = new THREE.Vector3(currentPos.x, 0, currentPos.z).distanceTo(
                new THREE.Vector3(lastPosition.current.x, 0, lastPosition.current.z)
            );
            lastPosition.current.copy(currentPos);
            
            if (distMoved < 0.01 * runSpeed) {
                stuckTime.current += delta;
            } else {
                stuckTime.current = 0;
            }

            if (distance > 0.2 && stuckTime.current < 2.0) {
                if (isOnFloor.current) newAnimation = 'Run';
                desiredSpeed = runSpeed;
                const rawDir = new THREE.Vector3(dx, 0, dz).normalize();
                let finalDir = rawDir.clone();

                if (rapier && world && distance > 1.5) {
                   // ... Obstacle avoidance code ...
                    const whiskerOrigin = { x: currentPos.x, y: currentPos.y + 0.6, z: currentPos.z };
                    const whiskers = [
                        { angle: 0, weight: 1.0, length: 2.0 },
                        { angle: -Math.PI / 4, weight: 1.5, length: 1.5 },
                        { angle: Math.PI / 4, weight: 1.5, length: 1.5 },
                        { angle: -Math.PI / 2.5, weight: 1.5, length: 1.2 },
                        { angle: Math.PI / 2.5, weight: 1.5, length: 1.2 },
                    ];
                    let avoidanceVector = new THREE.Vector3();
                    let hasCollision = false;

                    whiskers.forEach(whisker => {
                        const scanDir = rawDir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), whisker.angle);
                        const ray = new rapier.Ray(whiskerOrigin, { x: scanDir.x, y: 0, z: scanDir.z });
                        const hit = world.castRay(ray, whisker.length, true);

                        if (hit) {
                            const toi = hit.timeOfImpact;
                            if (toi > 0.55) {
                                hasCollision = true;
                                const repulsionStrength = (whisker.length - toi) / whisker.length;
                                const repulsion = scanDir.clone().negate().multiplyScalar(repulsionStrength * whisker.weight * 5);
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
                if (currentNavTarget.current && onTargetReached) {
                    if (distance < 1.5 || stuckTime.current > 2.0) {
                         onTargetReached();
                    }
                }
                currentNavTarget.current = null;
                desiredSpeed = 0;
                stuckTime.current = 0;
                if (isOnFloor.current) newAnimation = 'Idle';
            }
        } 
        else {
            // Idle
            desiredSpeed = 0;
            if (isOnFloor.current) newAnimation = 'Idle';
        }
    }

    // --- JUMP LOGIC ---
    // Increased cooldown to 500ms to allow flight phase to start
    if (jump && isOnFloor.current && !isLanding.current && Date.now() - jumpCooldown.current > 500) {
       currentYVelocity = jumpForce;
       isLanding.current = false;
       isOnFloor.current = false; // Force airborne state immediately
       jumpCooldown.current = Date.now();
       
       // Determine Jump Type: RunJump or Standard Jump
       // A RunJump happens if we are running and moving
       const isMoving = Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1;
       if (run && isMoving) {
           jumpType.current = 'RunJump';
       } else {
           jumpType.current = 'Jump';
       }
       
       newAnimation = jumpType.current;
    }

    // --- AIR LOGIC ---
    // If not on floor, strictly enforce airborne animation
    if (!isOnFloor.current) {
        newAnimation = jumpType.current;
    }

    if (animation !== newAnimation) {
        setAnimation(newAnimation);
    }

    // Apply Physics
    rigidBody.current.setLinvel({ x: moveX, y: currentYVelocity, z: moveZ }, true);

    // Apply Rotation
    if (desiredSpeed > 0 || (currentNavTarget.current)) {
       let angleDiff = targetRotation.current - currentRotation.current;
       while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
       while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
       currentRotation.current += angleDiff * rotationSpeed * delta;
       characterGroup.current.rotation.y = currentRotation.current;
    }

    // Camera Update
    const radius = 6;
    const phi = cameraPolar.current;
    const theta = cameraOrbit.current;
    const offsetX = radius * Math.sin(phi) * Math.sin(theta);
    const offsetY = radius * Math.cos(phi);
    const offsetZ = radius * Math.sin(phi) * Math.cos(theta);

    const targetCameraPos = new THREE.Vector3(
        currentPos.x + offsetX,
        currentPos.y + offsetY + 1.5,
        currentPos.z + offsetZ
    );
    state.camera.position.lerp(targetCameraPos, 0.1);
    const lookAtTarget = new THREE.Vector3(currentPos.x, currentPos.y + 1.5, currentPos.z);
    state.camera.lookAt(lookAtTarget);

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
      scale={0.5}
      onCollisionEnter={({ other }) => {
        // Hybrid approach: onCollisionEnter catches the exact frame of impact
        // But we filter out "head bumps" (hitting ceiling) by checking velocity
        if (rigidBody.current && rigidBody.current.linvel().y <= 0.1) {
            isOnFloor.current = true;
        }
      }}
    >
      <CapsuleCollider args={[0.5, 0.4]} position={[0, 0.9, 0]} />
      <group ref={characterGroup} dispose={null}>
         <primitive object={scene} scale={1} />
         <Html position={[0, 2.2, 0]} center>
            <div className="bg-black/50 backdrop-blur-sm border border-[#00ffcc]/50 px-2 py-0.5 rounded text-[10px] text-[#00ffcc] font-mono whitespace-nowrap">
                {playerName}
            </div>
         </Html>
      </group>
    </RigidBody>
  );
};

useGLTF.preload(MODEL_URL);
