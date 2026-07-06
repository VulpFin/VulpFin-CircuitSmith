import type { CSSProperties } from 'react';
import type { LogicValue } from '@vfcs/circuit-model';
import { visualSignal, type ChipVisualElement } from '../lib/chipVisuals.js';

interface ChipVisualLayerProps {
  elements: ChipVisualElement[];
  pinValues?: Record<string, LogicValue>;
  preview?: boolean;
}

export function ChipVisualLayer({
  elements,
  pinValues = {},
  preview = false,
}: ChipVisualLayerProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {elements.map((element) => {
        const signal = preview ? (element.bindingPinId ? '1' : '0') : visualSignal(element, pinValues);
        const active = signal === '1';
        const error = signal === 'ERR';
        const fill = error ? '#ff4d4d' : active ? element.color : element.offColor;
        const style: CSSProperties = {
          left: `${element.x}%`,
          top: `${element.y}%`,
          width: `${element.width}%`,
          height: `${element.height}%`,
          background: fill,
          color: element.color,
          transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
          opacity: signal === 'X' || signal === 'Z' ? 0.45 : 1,
          boxShadow: active
            ? `0 0 6px ${element.color}, 0 0 14px ${element.color}99`
            : error
              ? '0 0 8px #ff4d4d'
              : 'inset 0 0 3px rgba(0, 0, 0, 0.65)',
        };

        if (element.type === 'label') {
          return (
            <div
              key={element.id}
              className="absolute flex items-center justify-center overflow-hidden text-center text-[10px] font-semibold leading-none"
              style={{
                ...style,
                background: 'transparent',
                boxShadow: 'none',
                opacity: 1,
              }}
            >
              {element.text || 'LABEL'}
            </div>
          );
        }

        return (
          <div
            key={element.id}
            className="absolute border border-black/50"
            style={{
              ...style,
              borderRadius: element.type === 'led' ? '9999px' : '2px',
              clipPath:
                element.type === 'segment'
                  ? 'polygon(12% 0%, 88% 0%, 100% 50%, 88% 100%, 12% 100%, 0% 50%)'
                  : undefined,
            }}
            title={`${element.bindingPinId ?? 'unbound'}: ${signal}`}
          />
        );
      })}
    </div>
  );
}
