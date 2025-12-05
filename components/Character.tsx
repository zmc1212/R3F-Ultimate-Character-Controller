
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls, useAnimations, useGLTF, Html } from '@react-three/drei';
import { RigidBody, RapierRigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import { useControls } from 'leva';
import { Controls, ControlMode } from '../types';

const MODEL_URL = "/models/male.gltf";

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
  const jumpType = useRef<'Jump' | 'RunJump'>('Jump');
  const jumpCooldown = useRef(0);

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
    // Map specialized states to available animations
    if (isSitting) {
      animName = actions['Sitting'] ? 'Sitting' : (actions['Sitting'] ? 'Sitting' : 'Idle');
    }

    let action = actions[animName] || actions['Idle'];

    // Fallback for Falling
    if (animName === 'Falling' && !actions['Falling']) {
      if (actions['Falling']) action = actions['Falling'];
      else action = actions['Jump'] || actions['Idle']; // Clamp Jump frame
    }

    if (action) {
      const isOneShot = animName === 'Jump' || animName === 'RunJump' || animName === 'Landing';

      action.reset().fadeIn(0.2).play();

      if (isOneShot) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        if (animName === 'RunJump') action.timeScale = 0.6;
      } else {
        action.timeScale = 1;
      }
    }

    return () => {
      if (action) action.fadeOut(0.2);
    };
  }, [animation, actions, isSitting]);

  useFrame((state, delta) => {
    if (!rigidBody.current || !characterGroup.current) return;

    // --- 0. PRE-CHECKS & SITTING ---
    const keys = getKeys();
    const { forward, backward, left, right, jump, run } = keys;

    if (isSitting && sitPose) {
      // Break out of sit
      if (onStopSitting && (forward || backward || left || right || jump)) {
        onStopSitting();
        return;
      }
      // Force Sit Pose
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rigidBody.current.setTranslation(sitPose.position, true);

      let angleDiff = sitPose.rotation - currentRotation.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      currentRotation.current += angleDiff * 10 * delta;
      characterGroup.current.rotation.y = currentRotation.current;

      // Sync Update
      if (onUpdate && Date.now() - lastUpdateRef.current > 50) {
        onUpdate({ x: sitPose.position.x, y: sitPose.position.y, z: sitPose.position.z, rotation: currentRotation.current, animation: actions['Sitting'] ? 'Sitting' : 'Idle' });
        lastUpdateRef.current = Date.now();
      }

      // Sit Camera
      const r = 6;
      const targetCam = new THREE.Vector3(
        sitPose.position.x + r * Math.sin(cameraPolar.current) * Math.sin(cameraOrbit.current),
        sitPose.position.y + r * Math.cos(cameraPolar.current) + 1.5,
        sitPose.position.z + r * Math.sin(cameraPolar.current) * Math.cos(cameraOrbit.current)
      );
      state.camera.position.lerp(targetCam, 0.1);
      state.camera.lookAt(new THREE.Vector3(sitPose.position.x, sitPose.position.y + 1.5, sitPose.position.z));
      return;
    }

    // --- 1. SENSORS & PHYSICS ---
    const linvel = rigidBody.current.linvel();
    let currentVelY = linvel.y;
    const currentPos = rigidBody.current.translation();

    // Ground Check (Robust Raycast)
    const rayOrigin = { x: currentPos.x, y: currentPos.y + 0.5, z: currentPos.z };
    const rayDir = { x: 0, y: -1, z: 0 };
    let groundDistance = 100;
    if (rapier && world) {
      const ray = new rapier.Ray(rayOrigin, rayDir);
      // solid: false is CRITICAL to ignore character's own collider
      const hit = world.castRay(ray, 2.5, false);
      if (hit) groundDistance = hit.timeOfImpact;
    }

    // Determine Ground Status
    // If moving UP fast, we are jumping -> not on floor.
    // Otherwise, check ray distance. Offset 0.5 means < 0.55 is touching.
    if (currentVelY > 0.5) {
      isOnFloor.current = false;
    } else {
      isOnFloor.current = groundDistance < 0.55;
    }

    // Detect Landing Impact
    if (!wasOnFloor.current && isOnFloor.current) {
      // Only land if falling fast enough (prevents walking jitter)
      if (currentVelY < 0.5) {
        console.log('landing', currentVelY);

        isLanding.current = true;
         const landAction = actions['Landing'];
        const duration = landAction ? landAction.getClip().duration : 0.8;
        console.log('duration',duration)
        setTimeout(() => { isLanding.current = false; }, duration * 1000);
      }
    }
    wasOnFloor.current = isOnFloor.current;


    // --- 2. MOVEMENT CALCULATION ---
    let moveX = 0;
    let moveZ = 0;
    let desiredSpeed = 0;
    const isManualMove = forward || backward || left || right;

    if (isManualMove) {
      // Manual Input Overrides Auto Nav
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
      // Auto Navigation
      const target = currentNavTarget.current;
      const dx = target.x - currentPos.x;
      const dz = target.z - currentPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Stuck Check
      const distMoved = new THREE.Vector3(currentPos.x, 0, currentPos.z).distanceTo(lastPosition.current);
      lastPosition.current.set(currentPos.x, 0, currentPos.z);
      if (distMoved < 0.05) stuckTime.current += delta;
      else stuckTime.current = 0;

      if (dist > 0.2 && stuckTime.current < 2.0) {
        desiredSpeed = runSpeed;
        const dir = new THREE.Vector3(dx, 0, dz).normalize();

        // Simple Obstacle Avoidance (Only when far from target)
        if (dist > 1.5) {
          // ... (Simpler whiskers could go here, omitting for brevity/stability)
        }

        moveX = dir.x * desiredSpeed;
        moveZ = dir.z * desiredSpeed;
        targetRotation.current = Math.atan2(moveX, moveZ);
      } else {
        // Reached
        if (onTargetReached) onTargetReached();
        currentNavTarget.current = null;
      }
    }


    // --- 3. STATE MACHINE & ANIMATION ---
    let newState = animation;

    // Priority 1: Landing (Lock movement)
    if (isLanding.current) {
      moveX = 0;
      moveZ = 0;
      newState = 'Landing';
    }
    // Priority 2: Jump Trigger
    else if (jump && isOnFloor.current && Date.now() - jumpCooldown.current > 500) {
      currentVelY = jumpForce; // Override physics Y
      isOnFloor.current = false; // Force air state
      jumpCooldown.current = Date.now();

      const isMoving = Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1;
      jumpType.current = (run && isMoving) ? 'RunJump' : 'Jump';
      newState = jumpType.current;
    }
    // Priority 3: Airborne State
    else if (!isOnFloor.current) {
      // If falling down significantly, switch to Falling
      console.log('currentVelY', currentVelY)
      if (currentVelY < 5) {
        newState = 'Falling';
      } else {
        // Otherwise keep Jump/RunJump pose (clamped)
        newState = jumpType.current;
      }
    }
    // Priority 4: Ground Movement
    else {
      // On Floor
      if (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1) {
        newState = (Math.abs(desiredSpeed) > walkSpeed + 1) ? 'Running' : 'Walking';
      } else {
        newState = 'Idle';
      }
    }

    if (animation !== newState) {
      console.log('newState',newState);
       setAnimation(newState)
    };


    // --- 4. APPLY PHYSICS & TRANSFORMS ---

    // Apply Velocity
    rigidBody.current.setLinvel({ x: moveX, y: currentVelY, z: moveZ }, true);

    // Apply Rotation
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

    // Sync
    if (onUpdate && Date.now() - lastUpdateRef.current > 50) {
      onUpdate({ x: currentPos.x, y: currentPos.y, z: currentPos.z, rotation: currentRotation.current, animation: newState });
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
        <Html position={[0, 2.2, 0]} center>
          <div className="bg-black/50 backdrop-blur-sm border border-[#00ffcc]/50 px-2 py-0.5 rounded text-[10px] text-[#00ffcc] font-mono whitespace-nowrap">
            {playerName}
          </div>
        </Html>
      </group>
    </RigidBody>
  );
};
