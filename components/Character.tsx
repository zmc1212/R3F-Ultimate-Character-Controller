
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls, useAnimations, useGLTF, Html, Cylinder } from '@react-three/drei';
import { RigidBody, RapierRigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import { useControls } from 'leva';
import { Controls, ControlMode, InventoryItem } from '../types';

const MODEL_URL = "/models/ch42.gltf";

interface CharacterProps {
  controlMode?: ControlMode;
  movementTarget?: THREE.Vector3 | null;
  onUpdate?: (data: { x: number; y: number; z: number; rotation: number; animation: string }) => void;
  playerName?: string;
  onTargetReached?: () => void;
  isSitting?: boolean;
  sitPose?: { position: THREE.Vector3; rotation: number } | null;
  onStopSitting?: () => void;
  positionRef?: React.MutableRefObject<{ position: THREE.Vector3; rotation: number }>;
  
  // Door
  isOpeningDoor?: boolean;
  onDoorOpened?: () => void;
  
  // Pickup
  isPickingUp?: boolean;
  onPickupFinished?: () => void;

  // New Features
  inventory?: InventoryItem[];
  emote?: string | null;
}

export const Character: React.FC<CharacterProps> = ({
  controlMode = 'direct',
  movementTarget,
  onUpdate,
  playerName = "Player",
  onTargetReached,
  isSitting = false,
  sitPose = null,
  onStopSitting,
  positionRef,
  isOpeningDoor = false,
  onDoorOpened,
  isPickingUp = false,
  onPickupFinished,
  inventory = [],
  emote = null
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
    jumpForce: { value: 6.5, min: 3, max: 10 },
    camSens: { value: 0.005, min: 0.001, max: 0.01, label: 'Camera Sensitivity' }
  });

  // Refs
  const sensitivityRef = useRef(camSens);
  useEffect(() => { sensitivityRef.current = camSens; }, [camSens]);

  const rigidBody = useRef<RapierRigidBody>(null);
  const characterGroup = useRef<THREE.Group>(null);

  // Physics State
  const isOnFloor = useRef(true);
  const wasOnFloor = useRef(true);
  const isLanding = useRef(false);
  const isFlying = useRef(false);
  const jumpType = useRef<'Jump' | 'RunJump'>('Jump');
  const jumpCooldown = useRef(0);
  const currentVelYRef = useRef(0);

  // Model loading
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, characterGroup);

  // Input
  const [, getKeys] = useKeyboardControls<Controls>();

  // Animation State
  const [animation, setAnimation] = useState<string>('Idle');

  // Smooth Rotation
  const currentRotation = useRef(0);
  const targetRotation = useRef(0);

  // Camera Control
  const isDragging = useRef(false);
  const cameraOrbit = useRef(0);
  const cameraPolar = useRef(Math.PI / 4);

  // Navigation
  const currentNavTarget = useRef<THREE.Vector3 | null>(null);
  const lastPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const stuckTime = useRef(0);

  // Rapier
  const { world, rapier } = useRapier();
  const lastUpdateRef = useRef(0);

  // Check Jetpack Availability (item-2 is "Plasma Cell")
  const hasJetpack = inventory.some(i => i.id === 'item-2');

  // Camera Event Listeners
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => { if (e.button === 2) isDragging.current = true; };
    const handleMouseUp = () => { isDragging.current = false; };
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        cameraOrbit.current -= e.movementX * sensitivityRef.current;
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

  // Sync Nav Target
  useEffect(() => {
    if (movementTarget) {
      currentNavTarget.current = movementTarget.clone();
      stuckTime.current = 0;
    }
  }, [movementTarget]);

  // Animation Transitions
  useEffect(() => {
    let animName = animation;
    
    // Map specialized states
    if (isSitting) {
      animName = actions['Sitting'] ? 'Sitting' : (actions['Sit'] ? 'Sit' : 'Idle');
    }
    
    // Interactions
    if (isOpeningDoor) {
        animName = actions['OpenDoor'] ? 'OpenDoor' : (actions['Interact'] ? 'Interact' : 'Idle');
    }
    if (isPickingUp) {
        animName = actions['PickingUp'] ? 'PickingUp' : (actions['Pickup'] ? 'Pickup' : (actions['Interact'] ? 'Interact' : 'Idle'));
    }

    // Emotes
    if (emote) {
        animName = actions[emote] ? emote : 'Idle';
    }

    let action = actions[animName] || actions['Idle'];

    // Fallbacks
    if (animName === 'Falling' && !actions['Falling']) {
      if (actions['Fall']) action = actions['Fall'];
      else action = actions['Jump'] || actions['Idle'];
    }
    if (animName === 'Flying' && !actions['Flying']) {
        action = actions['Jump'] || actions['Idle'];
    }

    if (action) {
      const isOneShot = 
        animName === 'Jump' || 
        animName === 'RunJump' || 
        animName === 'Landing' || 
        isOpeningDoor || 
        isPickingUp ||
        animName === 'Wave';

      action.reset().fadeIn(0.2).play();

      if (isOneShot) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        if (animName === 'RunJump') action.timeScale = 0.6;
        
        // Callbacks
        if (isOpeningDoor && onDoorOpened) {
            const duration = action.getClip().duration;
            setTimeout(() => { onDoorOpened(); }, duration * 1000 * 0.8); 
        }

        if (isPickingUp && onPickupFinished) {
            const duration = action.getClip().duration;
            setTimeout(() => { onPickupFinished(); }, duration * 1000 * 0.9);
        }

      } else {
        action.timeScale = 1;
      }
    }

    return () => {
      if (action) action.fadeOut(0.2);
    };
  }, [animation, actions, isSitting, isOpeningDoor, isPickingUp, emote]);

  useFrame((state, delta) => {
    if (!rigidBody.current || !characterGroup.current) return;

    const keys = getKeys();
    const { forward, backward, left, right, jump, run } = keys;

    // --- 1. SENSORS & PHYSICS ---
    const linvel = rigidBody.current.linvel();
    currentVelYRef.current = linvel.y;
    const currentPos = rigidBody.current.translation();
    
    if (positionRef) {
        positionRef.current.position.set(currentPos.x, currentPos.y, currentPos.z);
        positionRef.current.rotation = currentRotation.current;
    }

    // Ground Check
    const rayOrigin = { x: currentPos.x, y: currentPos.y + 0.5, z: currentPos.z };
    const rayDir = { x: 0, y: -1, z: 0 };
    let groundDistance = 100;
    if (rapier && world && rigidBody.current) {
      const ray = new rapier.Ray(rayOrigin, rayDir);
      // Explicitly exclude the character's rigid body to prevent self-detection
      // castRay(ray, maxToi, solid, groups, excludeCollider, excludeRigidBody)
      const hit = world.castRay(ray, 2.5, true, 0xffffffff, null, rigidBody.current); 
      if (hit) groundDistance = hit.timeOfImpact;
    }

    if (currentVelYRef.current > 1.0) { 
      isOnFloor.current = false;
    } else {
      // Threshold 0.52 (2cm from feet)
      isOnFloor.current = groundDistance < 0.52;
    }

    // Logic-based Landing detection
    if (!wasOnFloor.current && isOnFloor.current) {
      if (currentVelYRef.current < -1.0) { 
        triggerLanding();
      }
    }
    wasOnFloor.current = isOnFloor.current;

    // --- 2. JETPACK LOGIC ---
    isFlying.current = false;
    if (hasJetpack && !isOnFloor.current && jump) {
        // Apply upward thrust
        currentVelYRef.current += 30 * delta; 
        currentVelYRef.current = Math.min(currentVelYRef.current, 5); 
        isFlying.current = true;
    }

    // --- 3. MOVEMENT ---
    let moveX = 0;
    let moveZ = 0;
    let desiredSpeed = 0;
    const isManualMove = forward || backward || left || right;

    // Breaking out of sit
    if (isSitting && isManualMove && onStopSitting) {
        onStopSitting();
    }

    if (isManualMove) {
      if (currentNavTarget.current) currentNavTarget.current = null;
      desiredSpeed = run ? runSpeed : walkSpeed;
      const camForward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraOrbit.current);
      const camRight = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraOrbit.current);
      const moveDir = new THREE.Vector3(0, 0, 0);
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
      const target = currentNavTarget.current;
      const dx = target.x - currentPos.x;
      const dz = target.z - currentPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const distMoved = new THREE.Vector3(currentPos.x, 0, currentPos.z).distanceTo(lastPosition.current);
      lastPosition.current.set(currentPos.x, 0, currentPos.z);
      if (distMoved < 0.05) stuckTime.current += delta;
      else stuckTime.current = 0;
      if (dist > 0.2 && stuckTime.current < 2.0) {
        desiredSpeed = runSpeed;
        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        moveX = dir.x * desiredSpeed;
        moveZ = dir.z * desiredSpeed;
        targetRotation.current = Math.atan2(moveX, moveZ);
      } else {
        if (onTargetReached) onTargetReached();
        currentNavTarget.current = null;
      }
    }

    // --- 4. STATE MACHINE ---
    let newState = animation;

    // Priority 1: Blocking Interactions
    if (isOpeningDoor) {
        newState = 'OpenDoor'; 
    }
    else if (isPickingUp) {
        newState = 'PickingUp';
    }
    else if (isSitting && sitPose) {
        newState = actions['Sitting'] ? 'Sitting' : 'Idle';
    }
    // Priority 2: Physics Reactions
    else if (isLanding.current) { 
        moveX = 0; moveZ = 0; newState = 'Landing'; 
    }
    else if (isFlying.current) {
        newState = 'Flying';
    }
    // Priority 3: Jumping / Airborne
    else if (jump && isOnFloor.current && Date.now() - jumpCooldown.current > 500) {
      currentVelYRef.current = jumpForce; 
      isOnFloor.current = false; 
      jumpCooldown.current = Date.now();
      const isMoving = Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1;
      jumpType.current = (run && isMoving) ? 'RunJump' : 'Jump';
      newState = jumpType.current;
    }
    else if (!isOnFloor.current) {
      // Keep falling until landed
      if (currentVelYRef.current < -0.1) newState = 'Falling';
      else newState = jumpType.current;
    }
    // Priority 4: Ground Movement
    else {
      if (emote && !isManualMove) {
          newState = emote;
           if (emote === 'Dance') {
            currentRotation.current += delta * 5;
            characterGroup.current.rotation.y = currentRotation.current;
           }
      } else {
          if (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1) {
            newState = (Math.abs(desiredSpeed) > walkSpeed + 1) ? 'Running' : 'Walking';
          } else {
            newState = 'Idle';
          }
      }
    }

    if (animation !== newState) setAnimation(newState);

    // --- 5. APPLY PHYSICS ---
    // Handle interactions logic first to ensure lock
    if (isOpeningDoor || isPickingUp) {
        rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        return;
    }
    if (isSitting && sitPose) {
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rigidBody.current.setTranslation(sitPose.position, true);
      
      let angleDiff = sitPose.rotation - currentRotation.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      currentRotation.current += angleDiff * 10 * delta;
      characterGroup.current.rotation.y = currentRotation.current;
      return;
    }

    const currentHorizontalSpeed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);
    let finalX = moveX;
    let finalZ = moveZ;
    // Momentum preservation (for speed pads etc)
    if (currentHorizontalSpeed > runSpeed + 2.0) {
        const decay = 0.05; 
        finalX = THREE.MathUtils.lerp(linvel.x, moveX, decay);
        finalZ = THREE.MathUtils.lerp(linvel.z, moveZ, decay);
    } 
    rigidBody.current.setLinvel({ x: finalX, y: currentVelYRef.current, z: finalZ }, true);

    if (Math.abs(moveX) > 0.01 || Math.abs(moveZ) > 0.01) {
      let angleDiff = targetRotation.current - currentRotation.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      currentRotation.current += angleDiff * rotationSpeed * delta;
      characterGroup.current.rotation.y = currentRotation.current;
    }

    // Camera Update
    const r = 6;
    const tCam = new THREE.Vector3(
      currentPos.x + r * Math.sin(cameraPolar.current) * Math.sin(cameraOrbit.current),
      currentPos.y + r * Math.cos(cameraPolar.current) + 1.5,
      currentPos.z + r * Math.sin(cameraPolar.current) * Math.cos(cameraOrbit.current)
    );
    state.camera.position.lerp(tCam, 0.1);
    state.camera.lookAt(new THREE.Vector3(currentPos.x, currentPos.y + 1.5, currentPos.z));

    if (onUpdate && Date.now() - lastUpdateRef.current > 50) {
      onUpdate({ x: currentPos.x, y: currentPos.y, z: currentPos.z, rotation: currentRotation.current, animation: newState });
      lastUpdateRef.current = Date.now();
    }
  });

  const triggerLanding = () => {
      isLanding.current = true;
      const landAction = actions['Landing'];
      const duration = landAction ? landAction.getClip().duration : 0.8;
      setTimeout(() => { isLanding.current = false; }, duration * 1000);
  };

  return (
    <RigidBody
      ref={rigidBody}
      colliders={false}
      enabledRotations={[false, false, false]}
      position={[0, 5, 0]}
      friction={0} 
      // Physics-based Landing Trigger
      onCollisionEnter={({ other }) => {
          if (rigidBody.current) {
              const vel = rigidBody.current.linvel();
              // Only trigger landing on hard impacts
              if (vel.y < -2.0 && other.rigidBody && other.rigidBody.isFixed()) {
                  triggerLanding();
              }
          }
      }}
    >
      <CapsuleCollider args={[0.5, 0.4]} position={[0, 0.9, 0]} />
      <group ref={characterGroup} dispose={null}>
        <primitive object={scene} scale={1} />
        
        {/* Jetpack Model */}
        {hasJetpack && (
           <group position={[0, 1.4, -0.25]} rotation={[0, 0, 0]}>
               <mesh castShadow receiveShadow>
                   <boxGeometry args={[0.4, 0.5, 0.2]} />
                   <meshStandardMaterial color="#444" metalness={0.8} />
               </mesh>
               <group position={[-0.25, 0, 0]}>
                   <Cylinder args={[0.08, 0.08, 0.5]} castShadow>
                       <meshStandardMaterial color="#222" />
                   </Cylinder>
               </group>
               <group position={[0.25, 0, 0]}>
                   <Cylinder args={[0.08, 0.08, 0.5]} castShadow>
                       <meshStandardMaterial color="#222" />
                   </Cylinder>
               </group>
               <mesh position={[-0.25, -0.25, 0]}>
                   <coneGeometry args={[0.08, 0.1, 8]} />
                   <meshStandardMaterial color="#111" />
               </mesh>
               <mesh position={[0.25, -0.25, 0]}>
                   <coneGeometry args={[0.08, 0.1, 8]} />
                   <meshStandardMaterial color="#111" />
               </mesh>
               {isFlying.current && (
                   <group>
                       <mesh position={[-0.25, -0.6, 0]} rotation={[Math.PI, 0, 0]}>
                           <coneGeometry args={[0.1, 0.6, 8]} />
                           <meshBasicMaterial color="#00ffcc" transparent opacity={0.6} />
                       </mesh>
                       <mesh position={[0.25, -0.6, 0]} rotation={[Math.PI, 0, 0]}>
                           <coneGeometry args={[0.1, 0.6, 8]} />
                           <meshBasicMaterial color="#00ffcc" transparent opacity={0.6} />
                       </mesh>
                   </group>
               )}
           </group>
        )}

        <Html position={[0, 2.2, 0]} center>
          <div className="bg-black/50 backdrop-blur-sm border border-[#00ffcc]/50 px-2 py-0.5 rounded text-[10px] text-[#00ffcc] font-mono whitespace-nowrap">
            {playerName}
          </div>
        </Html>
      </group>
    </RigidBody>
  );
};
