
export enum Controls {
  forward = 'forward',
  backward = 'backward',
  left = 'left',
  right = 'right',
  jump = 'jump',
  run = 'run',
}

export type AnimationState = 'idle' | 'walk' | 'run' | 'jump' | 'land' | 'Sitting' | 'RunJump' | 'Falling' | 'OpenDoor' | 'PickingUp' | 'Flying' | 'Dance' | 'Wave';

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

export interface InventoryItem {
    id: string;
    name: string;
    icon: string;
    description?: string;
}
