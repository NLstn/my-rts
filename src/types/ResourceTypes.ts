/**
 * Resource type definitions for the game
 */

export type ResourceType =
  | 'wood'
  | 'food'
  | 'stone'
  | 'gold'
  | 'iron'
  | 'tools';

export const BASIC_RESOURCES: ResourceType[] = ['wood', 'food', 'stone'];
export const ADVANCED_RESOURCES: ResourceType[] = ['gold', 'iron', 'tools'];

export interface ResourceCost {
  wood?: number;
  food?: number;
  stone?: number;
  gold?: number;
  iron?: number;
  tools?: number;
}

export interface ResourceInventory {
  wood: number;
  food: number;
  stone: number;
  gold: number;
  iron: number;
  tools: number;
}

export const RESOURCE_NAMES: Record<ResourceType, string> = {
  wood: 'Wood',
  food: 'Food',
  stone: 'Stone',
  gold: 'Gold',
  iron: 'Iron',
  tools: 'Tools',
};

export const RESOURCE_COLORS: Record<ResourceType, string> = {
  wood: '#8B4513',
  food: '#FFD700',
  stone: '#808080',
  gold: '#FFD700',
  iron: '#4A4A4A',
  tools: '#C0C0C0',
};
