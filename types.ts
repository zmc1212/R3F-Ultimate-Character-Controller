export enum Controls {
  forward = 'forward',
  backward = 'backward',
  left = 'left',
  right = 'right',
  jump = 'jump',
  run = 'run',
}

export type AnimationState = 'idle' | 'walk' | 'run' | 'jump' | 'land' | 'Sitting';

export type ControlMode = 'direct' | 'pointToClick';

export interface PlayerData {
  id?: string;
  name?: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  animation: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}