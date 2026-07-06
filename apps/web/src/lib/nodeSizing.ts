import type { NodeInstance, Position } from '@vfcs/circuit-model';

export interface WorkspaceSize {
  width: number;
  height: number;
}

export interface NodeSize {
  width: number;
  height: number;
}

export interface NodeSizeBounds {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}

export const WORKSPACE_MIN_WIDTH = 640;
export const WORKSPACE_MIN_HEIGHT = 360;
export const WORKSPACE_DEFAULT_WIDTH = 900;
export const WORKSPACE_DEFAULT_HEIGHT = 900;
export const WORKSPACE_MAX_WIDTH = 16000;
export const WORKSPACE_MAX_HEIGHT = 16000;

const PRIMITIVE_BOUNDS: NodeSizeBounds = {
  minWidth: 32,
  maxWidth: 520,
  minHeight: 32,
  maxHeight: 520,
  defaultWidth: 136,
  defaultHeight: 78,
};

const CHIP_BOUNDS: NodeSizeBounds = {
  minWidth: 36,
  maxWidth: 640,
  minHeight: 32,
  maxHeight: 640,
  defaultWidth: 136,
  defaultHeight: 78,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function nodeSizeBounds(node: NodeInstance): NodeSizeBounds {
  return node.nodeType === 'CHIP' ? CHIP_BOUNDS : PRIMITIVE_BOUNDS;
}

export function defaultNodeSizeForType(nodeType: string): NodeSize {
  const bounds = nodeType === 'CHIP' ? CHIP_BOUNDS : PRIMITIVE_BOUNDS;
  return {
    width: bounds.defaultWidth,
    height: bounds.defaultHeight,
  };
}

export function nodeSize(node: NodeInstance): NodeSize {
  const bounds = nodeSizeBounds(node);
  const widthRaw = Number(node.parameters?.width ?? bounds.defaultWidth);
  const heightRaw = Number(node.parameters?.height ?? bounds.defaultHeight);

  return {
    width: Number.isFinite(widthRaw)
      ? clamp(Math.round(widthRaw), bounds.minWidth, bounds.maxWidth)
      : bounds.defaultWidth,
    height: Number.isFinite(heightRaw)
      ? clamp(Math.round(heightRaw), bounds.minHeight, bounds.maxHeight)
      : bounds.defaultHeight,
  };
}

export function clampNodeToWorkspace(position: Position, workspaceSize: WorkspaceSize, size: NodeSize): Position {
  return {
    x: clamp(position.x, 0, Math.max(0, workspaceSize.width - size.width)),
    y: clamp(position.y, 0, Math.max(0, workspaceSize.height - size.height)),
  };
}
