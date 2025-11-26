export enum Controls {
  forward = 'forward',
  backward = 'backward',
  left = 'left',
  right = 'right',
  jump = 'jump',
  run = 'run',
}

export type AnimationState = 'idle' | 'walk' | 'run' | 'jump' | 'land';

export type ControlMode = 'direct' | 'pointToClick';