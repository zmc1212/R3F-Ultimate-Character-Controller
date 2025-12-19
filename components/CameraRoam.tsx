
import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

interface CameraRoamProps {
  active: boolean;
  onComplete: () => void;
  onLabelChange?: (label: string) => void;
}

// 漫游路径点配置
const ROAM_POINTS = [
  { pos: { x: 0, y: 35, z: 35 }, target: { x: 0, y: 0, z: 0 }, duration: 3, label: '系统引导中：欢迎来到虚拟实验室' },
  { pos: { x: 25, y: 15, z: 15 }, target: { x: 20, y: 2, z: -4 }, duration: 4, label: '设施预览：全息远程会议中心' },
  { pos: { x: 45, y: 18, z: 12 }, target: { x: 40, y: 2, z: 0 }, duration: 4, label: '休闲功能：赛博竞技场' },
  { pos: { x: -35, y: 22, z: 18 }, target: { x: -30, y: 5, z: 0 }, duration: 4, label: '物理测试：零重力模拟环境' },
  { pos: { x: -10, y: 12, z: 28 }, target: { x: -20, y: 2, z: 15 }, duration: 3.5, label: '防御系统：高压激光缓冲区' },
  { pos: { x: 8, y: 10, z: -12 }, target: { x: 5, y: 1, z: -15 }, duration: 3, label: '核心终端：重力场调度台' },
];

export const CameraRoam: React.FC<CameraRoamProps> = ({ active, onComplete, onLabelChange }) => {
  const { camera } = useThree();
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const lookAtTarget = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (active) {
      // 漫游启动：立即将相机移动到第一个点位，避免滑行启动导致的延迟感
      camera.position.set(ROAM_POINTS[0].pos.x, ROAM_POINTS[0].pos.y, ROAM_POINTS[0].pos.z);
      lookAtTarget.current.set(ROAM_POINTS[0].target.x, ROAM_POINTS[0].target.y, ROAM_POINTS[0].target.z);
      camera.lookAt(lookAtTarget.current);

      const tl = gsap.timeline({
        onComplete: () => {
          onComplete();
        }
      });
      timeline.current = tl;

      ROAM_POINTS.forEach((point, index) => {
        // 相机位置补间
        tl.to(camera.position, {
          x: point.pos.x,
          y: point.pos.y,
          z: point.pos.z,
          duration: point.duration,
          ease: "expo.inOut",
          onStart: () => {
            if (onLabelChange) onLabelChange(point.label);
          }
        }, index === 0 ? 0 : ">-1.0"); // 增加重叠度，让镜头切换更丝滑

        // 视口注视点补间
        tl.to(lookAtTarget.current, {
          x: point.target.x,
          y: point.target.y,
          z: point.target.z,
          duration: point.duration,
          ease: "expo.inOut"
        }, index === 0 ? 0 : ">-1.0");
      });
    } else {
      if (timeline.current) {
        timeline.current.kill();
        timeline.current = null;
      }
    }

    return () => {
      if (timeline.current) timeline.current.kill();
    };
  }, [active, camera, onComplete, onLabelChange]);

  // 每一帧更新相机朝向
  useFrame(() => {
    if (active) {
      camera.lookAt(lookAtTarget.current);
    }
  });

  return null;
};
