import type { CircuitDefinition } from '@vfcs/circuit-model';
import { describe, expect, it } from 'vitest';
import { exportCircuitAsVerilog } from '../src/verilog.js';

describe('exportCircuitAsVerilog', () => {
  it('exports clock nodes as input ports and emits sequential logic', () => {
    const circuit: CircuitDefinition = {
      id: 'clocked_demo',
      name: 'Clocked Demo',
      nodes: [
        { id: 'clk_src', nodeType: 'CLOCK', position: { x: 0, y: 0 } },
        { id: 'd_src', nodeType: 'INPUT', position: { x: 0, y: 100 } },
        { id: 'dff1', nodeType: 'DFF', position: { x: 120, y: 40 } },
        { id: 'out_led', nodeType: 'OUTPUT', position: { x: 260, y: 40 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'clk_src', pinId: 'OUT' }, to: { nodeId: 'dff1', pinId: 'CLK' } },
        { id: 'w2', from: { nodeId: 'd_src', pinId: 'OUT' }, to: { nodeId: 'dff1', pinId: 'D' } },
        { id: 'w3', from: { nodeId: 'dff1', pinId: 'Q' }, to: { nodeId: 'out_led', pinId: 'IN' } },
      ],
      nets: [],
    };

    const result = exportCircuitAsVerilog(circuit);

    expect(result.content).toContain('input clk_src;');
    expect(result.content).toContain('always @(posedge clk_src) begin');
    expect(result.warnings.some((warning) => warning.includes('CLOCK node clk_src'))).toBe(true);
  });

  it('warns when multiple drivers feed one input pin', () => {
    const circuit: CircuitDefinition = {
      id: 'driver_conflict_demo',
      name: 'Driver Conflict Demo',
      nodes: [
        { id: 'a', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'b', nodeType: 'INPUT', position: { x: 0, y: 60 } },
        { id: 'out1', nodeType: 'OUTPUT', position: { x: 160, y: 30 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'a', pinId: 'OUT' }, to: { nodeId: 'out1', pinId: 'IN' } },
        { id: 'w2', from: { nodeId: 'b', pinId: 'OUT' }, to: { nodeId: 'out1', pinId: 'IN' } },
      ],
      nets: [],
    };

    const result = exportCircuitAsVerilog(circuit);

    expect(result.warnings.some((warning) => warning.includes('has 2 drivers'))).toBe(true);
    expect(result.content).toContain('assign out1 = a;');
  });
});