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

  it('exports mux and register building blocks', () => {
    const circuit: CircuitDefinition = {
      id: 'blocks_demo',
      name: 'Blocks Demo',
      nodes: [
        { id: 'clk', nodeType: 'CLOCK', position: { x: 0, y: 0 } },
        { id: 'sel', nodeType: 'INPUT', position: { x: 0, y: 80 } },
        { id: 'vcc', nodeType: 'VCC', position: { x: 0, y: 160 } },
        { id: 'gnd', nodeType: 'GND', position: { x: 0, y: 240 } },
        { id: 'mux1', nodeType: 'MUX2', position: { x: 180, y: 80 } },
        { id: 'reg1', nodeType: 'REGISTER8', position: { x: 360, y: 80 } },
        { id: 'out1', nodeType: 'OUTPUT', position: { x: 560, y: 80 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'gnd', pinId: 'OUT' }, to: { nodeId: 'mux1', pinId: 'A' } },
        { id: 'w2', from: { nodeId: 'vcc', pinId: 'OUT' }, to: { nodeId: 'mux1', pinId: 'B' } },
        { id: 'w3', from: { nodeId: 'sel', pinId: 'OUT' }, to: { nodeId: 'mux1', pinId: 'SEL' } },
        { id: 'w4', from: { nodeId: 'mux1', pinId: 'OUT' }, to: { nodeId: 'reg1', pinId: 'D0' } },
        { id: 'w5', from: { nodeId: 'clk', pinId: 'OUT' }, to: { nodeId: 'reg1', pinId: 'CLK' } },
        { id: 'w6', from: { nodeId: 'vcc', pinId: 'OUT' }, to: { nodeId: 'reg1', pinId: 'LOAD' } },
        { id: 'w7', from: { nodeId: 'gnd', pinId: 'OUT' }, to: { nodeId: 'reg1', pinId: 'CLR' } },
        { id: 'w8', from: { nodeId: 'reg1', pinId: 'Q0' }, to: { nodeId: 'out1', pinId: 'IN' } },
      ],
      nets: [],
    };

    const result = exportCircuitAsVerilog(circuit);

    expect(result.content).toContain('assign mux1_OUT = (sel) ? 1\'b1 : 1\'b0;');
    expect(result.content).toContain('always @(posedge clk or posedge 1\'b0) begin');
    expect(result.content).toContain('reg reg1_Q0');
  });
});
