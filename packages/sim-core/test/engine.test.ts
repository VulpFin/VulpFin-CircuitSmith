import type { CircuitDefinition, LogicValue } from '@vfcs/circuit-model';
import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../src/engine.js';

function outputValue(snapshot: ReturnType<SimulationEngine['getSnapshot']>, nodeId: string): LogicValue {
  return (snapshot.nodeStates[nodeId]?.value as LogicValue) ?? 'X';
}

describe('SimulationEngine', () => {
  it('evaluates combinational AND logic', () => {
    const circuit: CircuitDefinition = {
      id: 'and-demo',
      name: 'AND Demo',
      nodes: [
        { id: 'inA', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'inB', nodeType: 'INPUT', position: { x: 0, y: 50 } },
        { id: 'g1', nodeType: 'AND', position: { x: 120, y: 20 } },
        { id: 'led', nodeType: 'OUTPUT', position: { x: 240, y: 20 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'inA', pinId: 'OUT' }, to: { nodeId: 'g1', pinId: 'A' } },
        { id: 'w2', from: { nodeId: 'inB', pinId: 'OUT' }, to: { nodeId: 'g1', pinId: 'B' } },
        { id: 'w3', from: { nodeId: 'g1', pinId: 'OUT' }, to: { nodeId: 'led', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit);

    engine.setInput('inA', '1');
    engine.setInput('inB', '1');
    let snapshot = engine.step();
    expect(outputValue(snapshot, 'led')).toBe('1');

    engine.setInput('inB', '0');
    snapshot = engine.step();
    expect(outputValue(snapshot, 'led')).toBe('0');
  });

  it('settles combinational outputs after input changes without advancing time', () => {
    const circuit: CircuitDefinition = {
      id: 'settle-demo',
      name: 'Settle Demo',
      nodes: [
        { id: 'inA', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'inB', nodeType: 'INPUT', position: { x: 0, y: 50 } },
        { id: 'g1', nodeType: 'AND', position: { x: 120, y: 20 } },
        { id: 'led', nodeType: 'OUTPUT', position: { x: 240, y: 20 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'inA', pinId: 'OUT' }, to: { nodeId: 'g1', pinId: 'A' } },
        { id: 'w2', from: { nodeId: 'inB', pinId: 'OUT' }, to: { nodeId: 'g1', pinId: 'B' } },
        { id: 'w3', from: { nodeId: 'g1', pinId: 'OUT' }, to: { nodeId: 'led', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit);
    engine.setInput('inA', '1');
    engine.setInput('inB', '1');
    const snapshot = engine.settle();

    expect(snapshot.tick).toBe(0);
    expect(snapshot.timeSeconds).toBe(0);
    expect(outputValue(snapshot, 'led')).toBe('1');
  });

  it('toggles T flip-flop output on rising clock edges when T=1', () => {
    const circuit: CircuitDefinition = {
      id: 'tff-demo',
      name: 'TFF Demo',
      nodes: [
        { id: 'tin', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'clk', nodeType: 'INPUT', position: { x: 0, y: 50 } },
        { id: 'tff', nodeType: 'TFF', position: { x: 120, y: 20 } },
        { id: 'led', nodeType: 'OUTPUT', position: { x: 240, y: 20 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'tin', pinId: 'OUT' }, to: { nodeId: 'tff', pinId: 'T' } },
        { id: 'w2', from: { nodeId: 'clk', pinId: 'OUT' }, to: { nodeId: 'tff', pinId: 'CLK' } },
        { id: 'w3', from: { nodeId: 'tff', pinId: 'Q' }, to: { nodeId: 'led', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit);
    engine.setInput('tin', '1');

    engine.setInput('clk', '0');
    let snapshot = engine.step();
    expect(outputValue(snapshot, 'led')).toBe('0');

    engine.setInput('clk', '1');
    snapshot = engine.step();
    expect(outputValue(snapshot, 'led')).toBe('1');

    engine.setInput('clk', '0');
    snapshot = engine.step();
    expect(outputValue(snapshot, 'led')).toBe('1');

    engine.setInput('clk', '1');
    snapshot = engine.step();
    expect(outputValue(snapshot, 'led')).toBe('0');
  });

  it('captures D input on rising clock for D flip-flop', () => {
    const circuit: CircuitDefinition = {
      id: 'dff-demo',
      name: 'DFF Demo',
      nodes: [
        { id: 'din', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'clk', nodeType: 'INPUT', position: { x: 0, y: 50 } },
        { id: 'dff', nodeType: 'DFF', position: { x: 120, y: 20 } },
        { id: 'led', nodeType: 'OUTPUT', position: { x: 240, y: 20 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'din', pinId: 'OUT' }, to: { nodeId: 'dff', pinId: 'D' } },
        { id: 'w2', from: { nodeId: 'clk', pinId: 'OUT' }, to: { nodeId: 'dff', pinId: 'CLK' } },
        { id: 'w3', from: { nodeId: 'dff', pinId: 'Q' }, to: { nodeId: 'led', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit);
    engine.setInput('clk', '0');
    engine.setInput('din', '0');
    engine.step();

    engine.setInput('din', '1');
    engine.setInput('clk', '1');
    let snapshot = engine.step();
    expect(outputValue(snapshot, 'led')).toBe('1');

    engine.setInput('din', '0');
    engine.setInput('clk', '0');
    engine.step();
    engine.setInput('clk', '1');
    snapshot = engine.step();
    expect(outputValue(snapshot, 'led')).toBe('0');
  });

  it('reports floating input diagnostics when gate pins are unconnected', () => {
    const circuit: CircuitDefinition = {
      id: 'floating-demo',
      name: 'Floating Input Demo',
      nodes: [
        { id: 'inA', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'g1', nodeType: 'AND', position: { x: 120, y: 20 } },
      ],
      wires: [{ id: 'w1', from: { nodeId: 'inA', pinId: 'OUT' }, to: { nodeId: 'g1', pinId: 'A' } }],
      nets: [
        {
          id: 'net_1',
          wireIds: ['w1'],
          driverPins: [{ nodeId: 'inA', pinId: 'OUT' }],
          loadPins: [{ nodeId: 'g1', pinId: 'A' }],
        },
      ],
    };

    const engine = new SimulationEngine(circuit);
    const snapshot = engine.step();

    const floatingWarnings = snapshot.diagnostics.filter((item) => item.code === 'floating-input');
    expect(floatingWarnings.length).toBeGreaterThan(0);
  });

  it('reports conflicting driver diagnostics on shared input nets', () => {
    const circuit: CircuitDefinition = {
      id: 'conflict-demo',
      name: 'Conflict Demo',
      nodes: [
        { id: 'a', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'b', nodeType: 'INPUT', position: { x: 0, y: 80 } },
        { id: 'out', nodeType: 'OUTPUT', position: { x: 180, y: 40 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'a', pinId: 'OUT' }, to: { nodeId: 'out', pinId: 'IN' } },
        { id: 'w2', from: { nodeId: 'b', pinId: 'OUT' }, to: { nodeId: 'out', pinId: 'IN' } },
      ],
      nets: [
        {
          id: 'net_1',
          wireIds: ['w1'],
          driverPins: [{ nodeId: 'a', pinId: 'OUT' }],
          loadPins: [{ nodeId: 'out', pinId: 'IN' }],
        },
        {
          id: 'net_2',
          wireIds: ['w2'],
          driverPins: [{ nodeId: 'b', pinId: 'OUT' }],
          loadPins: [{ nodeId: 'out', pinId: 'IN' }],
        },
      ],
    };

    const engine = new SimulationEngine(circuit);
    engine.setInput('a', '1');
    engine.setInput('b', '0');
    const snapshot = engine.step();

    const conflictErrors = snapshot.diagnostics.filter((item) => item.code === 'conflicting-drivers');
    expect(conflictErrors.length).toBeGreaterThan(0);
    expect(outputValue(snapshot, 'out')).toBe('ERR');
  });

  it('accepts matching multiple drivers on the same input pin', () => {
    const circuit: CircuitDefinition = {
      id: 'shared-driver-demo',
      name: 'Shared Driver Demo',
      nodes: [
        { id: 'a', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'b', nodeType: 'INPUT', position: { x: 0, y: 80 } },
        { id: 'out', nodeType: 'OUTPUT', position: { x: 180, y: 40 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'a', pinId: 'OUT' }, to: { nodeId: 'out', pinId: 'IN' } },
        { id: 'w2', from: { nodeId: 'b', pinId: 'OUT' }, to: { nodeId: 'out', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit);
    engine.setInput('a', '1');
    engine.setInput('b', '1');
    const snapshot = engine.step();

    expect(snapshot.diagnostics.some((item) => item.code === 'conflicting-drivers')).toBe(false);
    expect(outputValue(snapshot, 'out')).toBe('1');
  });

  it('advances CLOCK nodes using real simulated frequency time', () => {
    const circuit: CircuitDefinition = {
      id: 'clock-param-demo',
      name: 'Clock Param Demo',
      nodes: [
        {
          id: 'clk_fast',
          nodeType: 'CLOCK',
          parameters: { frequencyHz: 10_000_000_000 },
          position: { x: 0, y: 0 },
        },
        { id: 'led_fast', nodeType: 'OUTPUT', position: { x: 140, y: 0 } },
      ],
      wires: [{ id: 'w1', from: { nodeId: 'clk_fast', pinId: 'OUT' }, to: { nodeId: 'led_fast', pinId: 'IN' } }],
      nets: [
        {
          id: 'net_1',
          wireIds: ['w1'],
          driverPins: [{ nodeId: 'clk_fast', pinId: 'OUT' }],
          loadPins: [{ nodeId: 'led_fast', pinId: 'IN' }],
        },
      ],
    };

    const engine = new SimulationEngine(circuit);
    const first = engine.step();
    const second = engine.step();

    expect(first.timeSeconds).toBeCloseTo(5e-11, 14);
    expect(second.timeSeconds).toBeCloseTo(1e-10, 14);
    expect(outputValue(first, 'led_fast')).toBe('1');
    expect(outputValue(second, 'led_fast')).toBe('0');
  });

  it('simulates custom CHIP instances using pin bindings', () => {
    const chipInternal: CircuitDefinition = {
      id: 'chip_and_internal',
      name: 'AND Chip Internal',
      nodes: [
        { id: 'in0', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'in1', nodeType: 'INPUT', position: { x: 0, y: 80 } },
        { id: 'and0', nodeType: 'AND', position: { x: 120, y: 40 } },
        { id: 'out0', nodeType: 'OUTPUT', position: { x: 240, y: 40 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'in0', pinId: 'OUT' }, to: { nodeId: 'and0', pinId: 'A' } },
        { id: 'w2', from: { nodeId: 'in1', pinId: 'OUT' }, to: { nodeId: 'and0', pinId: 'B' } },
        { id: 'w3', from: { nodeId: 'and0', pinId: 'OUT' }, to: { nodeId: 'out0', pinId: 'IN' } },
      ],
      nets: [],
    };

    const circuit: CircuitDefinition = {
      id: 'chip_top',
      name: 'Chip Top',
      nodes: [
        { id: 'a', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'b', nodeType: 'INPUT', position: { x: 0, y: 80 } },
        {
          id: 'chip1',
          nodeType: 'CHIP',
          chipRefId: 'chip_and_2',
          position: { x: 140, y: 30 },
          parameters: {
            pinBindings: {
              A: { sourceNodeId: 'in0', direction: 'input' },
              B: { sourceNodeId: 'in1', direction: 'input' },
              Y: { sourceNodeId: 'out0', direction: 'output' },
            },
          },
        },
        { id: 'led', nodeType: 'OUTPUT', position: { x: 280, y: 40 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'a', pinId: 'OUT' }, to: { nodeId: 'chip1', pinId: 'A' } },
        { id: 'w2', from: { nodeId: 'b', pinId: 'OUT' }, to: { nodeId: 'chip1', pinId: 'B' } },
        { id: 'w3', from: { nodeId: 'chip1', pinId: 'Y' }, to: { nodeId: 'led', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit, {
      chipLibrary: [
        {
          id: 'chip_and_2',
          name: 'AND2',
          version: '0.1.0',
          publicPins: [
            { id: 'A', name: 'A', direction: 'input' },
            { id: 'B', name: 'B', direction: 'input' },
            { id: 'Y', name: 'Y', direction: 'output' },
          ],
          internalCircuit: chipInternal,
        },
      ],
    });

    engine.setInput('a', '1');
    engine.setInput('b', '1');
    let snapshot = engine.step();
    expect(outputValue(snapshot, 'led')).toBe('1');

    engine.setInput('b', '0');
    snapshot = engine.step();
    expect(outputValue(snapshot, 'led')).toBe('0');
  });

  it('keeps unbound custom chip outputs high-Z instead of poisoning bound outputs', () => {
    const chipInternal: CircuitDefinition = {
      id: 'partial_binding_internal',
      name: 'Partial Binding Internal',
      nodes: [
        { id: 'in0', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'out0', nodeType: 'OUTPUT', position: { x: 180, y: 0 } },
        { id: 'unused_and', nodeType: 'AND', position: { x: 80, y: 120 } },
        { id: 'unused_out', nodeType: 'OUTPUT', position: { x: 180, y: 120 } },
      ],
      wires: [
        { id: 'w_signal', from: { nodeId: 'in0', pinId: 'OUT' }, to: { nodeId: 'out0', pinId: 'IN' } },
        { id: 'w_unused', from: { nodeId: 'unused_and', pinId: 'OUT' }, to: { nodeId: 'unused_out', pinId: 'IN' } },
      ],
      nets: [],
    };

    const circuit: CircuitDefinition = {
      id: 'partial_binding_top',
      name: 'Partial Binding Top',
      nodes: [
        { id: 'src', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'chip1', nodeType: 'CHIP', chipRefId: 'partial_binding_chip', position: { x: 140, y: 0 } },
        { id: 'sink', nodeType: 'OUTPUT', position: { x: 300, y: 0 } },
      ],
      wires: [
        { id: 'w_in', from: { nodeId: 'src', pinId: 'OUT' }, to: { nodeId: 'chip1', pinId: 'A' } },
        { id: 'w_out', from: { nodeId: 'chip1', pinId: 'Y' }, to: { nodeId: 'sink', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit, {
      chipLibrary: [
        {
          id: 'partial_binding_chip',
          name: 'Partial Binding Chip',
          version: '0.1.0',
          publicPins: [
            { id: 'A', name: 'A', direction: 'input' },
            { id: 'FLOATING', name: 'FLOATING', direction: 'output' },
            { id: 'Y', name: 'Y', direction: 'output' },
          ],
          internalCircuit: chipInternal,
          metadata: {
            pinBindings: {
              A: { sourceNodeId: 'in0', direction: 'input' },
              FLOATING: { direction: 'output' },
              Y: { sourceNodeId: 'out0', direction: 'output' },
            },
          },
        },
      ],
    });

    engine.setInput('src', '1');
    const snapshot = engine.settle();

    expect(outputValue(snapshot, 'sink')).toBe('1');
    expect(snapshot.nodeOutputs.chip1.Y).toBe('1');
    expect(snapshot.nodeOutputs.chip1.FLOATING).toBe('Z');
  });

  it('settles nested chip outputs that pass through gates into downstream chips', () => {
    const bufferInternal: CircuitDefinition = {
      id: 'buffer_internal',
      name: 'Buffer Internal',
      nodes: [
        { id: 'in0', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'out0', nodeType: 'OUTPUT', position: { x: 180, y: 0 } },
      ],
      wires: [{ id: 'w_signal', from: { nodeId: 'in0', pinId: 'OUT' }, to: { nodeId: 'out0', pinId: 'IN' } }],
      nets: [],
    };
    const wrapperInternal: CircuitDefinition = {
      id: 'chip_gate_chip_internal',
      name: 'Chip Gate Chip Internal',
      nodes: [
        { id: 'in0', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'buf_a', nodeType: 'CHIP', chipRefId: 'test_buffer', position: { x: 120, y: 0 } },
        { id: 'not0', nodeType: 'NOT', position: { x: 260, y: 0 } },
        { id: 'buf_b', nodeType: 'CHIP', chipRefId: 'test_buffer', position: { x: 400, y: 0 } },
        { id: 'out0', nodeType: 'OUTPUT', position: { x: 540, y: 0 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'in0', pinId: 'OUT' }, to: { nodeId: 'buf_a', pinId: 'IN' } },
        { id: 'w2', from: { nodeId: 'buf_a', pinId: 'OUT' }, to: { nodeId: 'not0', pinId: 'IN' } },
        { id: 'w3', from: { nodeId: 'not0', pinId: 'OUT' }, to: { nodeId: 'buf_b', pinId: 'IN' } },
        { id: 'w4', from: { nodeId: 'buf_b', pinId: 'OUT' }, to: { nodeId: 'out0', pinId: 'IN' } },
      ],
      nets: [],
    };
    const circuit: CircuitDefinition = {
      id: 'chip_gate_chip_top',
      name: 'Chip Gate Chip Top',
      nodes: [
        { id: 'src', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'wrapper', nodeType: 'CHIP', chipRefId: 'chip_gate_chip', position: { x: 140, y: 0 } },
        { id: 'sink', nodeType: 'OUTPUT', position: { x: 300, y: 0 } },
      ],
      wires: [
        { id: 'w_in', from: { nodeId: 'src', pinId: 'OUT' }, to: { nodeId: 'wrapper', pinId: 'IN' } },
        { id: 'w_out', from: { nodeId: 'wrapper', pinId: 'OUT' }, to: { nodeId: 'sink', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit, {
      chipLibrary: [
        {
          id: 'test_buffer',
          name: 'Test Buffer',
          version: '0.1.0',
          publicPins: [
            { id: 'IN', name: 'IN', direction: 'input' },
            { id: 'OUT', name: 'OUT', direction: 'output' },
          ],
          internalCircuit: bufferInternal,
          metadata: {
            pinBindings: {
              IN: { sourceNodeId: 'in0', direction: 'input' },
              OUT: { sourceNodeId: 'out0', direction: 'output' },
            },
          },
        },
        {
          id: 'chip_gate_chip',
          name: 'Chip Gate Chip',
          version: '0.1.0',
          publicPins: [
            { id: 'IN', name: 'IN', direction: 'input' },
            { id: 'OUT', name: 'OUT', direction: 'output' },
          ],
          internalCircuit: wrapperInternal,
          metadata: {
            pinBindings: {
              IN: { sourceNodeId: 'in0', direction: 'input' },
              OUT: { sourceNodeId: 'out0', direction: 'output' },
            },
          },
        },
      ],
    });

    engine.setInput('src', '1');
    const snapshot = engine.settle();

    expect(outputValue(snapshot, 'sink')).toBe('0');
    expect(snapshot.nodeOutputs.wrapper.OUT).toBe('0');
  });

  it('supports custom CHIP outputs bound directly to internal output pins', () => {
    const chipInternal: CircuitDefinition = {
      id: 'chip_full_adder_internal',
      name: 'Full Adder Chip Internal',
      nodes: [
        { id: 'a_in', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'b_in', nodeType: 'INPUT', position: { x: 0, y: 80 } },
        { id: 'cin_in', nodeType: 'INPUT', position: { x: 0, y: 160 } },
        { id: 'adder', nodeType: 'FULL_ADDER', position: { x: 160, y: 80 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'a_in', pinId: 'OUT' }, to: { nodeId: 'adder', pinId: 'A' } },
        { id: 'w2', from: { nodeId: 'b_in', pinId: 'OUT' }, to: { nodeId: 'adder', pinId: 'B' } },
        { id: 'w3', from: { nodeId: 'cin_in', pinId: 'OUT' }, to: { nodeId: 'adder', pinId: 'CIN' } },
      ],
      nets: [],
    };

    const circuit: CircuitDefinition = {
      id: 'chip_full_adder_top',
      name: 'Full Adder Chip Top',
      nodes: [
        { id: 'a', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'b', nodeType: 'INPUT', position: { x: 0, y: 80 } },
        { id: 'cin', nodeType: 'INPUT', position: { x: 0, y: 160 } },
        {
          id: 'chip1',
          nodeType: 'CHIP',
          chipRefId: 'chip_full_adder',
          position: { x: 160, y: 80 },
        },
        { id: 'sum', nodeType: 'OUTPUT', position: { x: 320, y: 40 } },
        { id: 'cout', nodeType: 'OUTPUT', position: { x: 320, y: 120 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'a', pinId: 'OUT' }, to: { nodeId: 'chip1', pinId: 'A' } },
        { id: 'w2', from: { nodeId: 'b', pinId: 'OUT' }, to: { nodeId: 'chip1', pinId: 'B' } },
        { id: 'w3', from: { nodeId: 'cin', pinId: 'OUT' }, to: { nodeId: 'chip1', pinId: 'CIN' } },
        { id: 'w4', from: { nodeId: 'chip1', pinId: 'SUM' }, to: { nodeId: 'sum', pinId: 'IN' } },
        { id: 'w5', from: { nodeId: 'chip1', pinId: 'COUT' }, to: { nodeId: 'cout', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit, {
      chipLibrary: [
        {
          id: 'chip_full_adder',
          name: 'Full Adder',
          version: '0.1.0',
          publicPins: [
            { id: 'A', name: 'A', direction: 'input' },
            { id: 'B', name: 'B', direction: 'input' },
            { id: 'CIN', name: 'CIN', direction: 'input' },
            { id: 'SUM', name: 'SUM', direction: 'output' },
            { id: 'COUT', name: 'COUT', direction: 'output' },
          ],
          internalCircuit: chipInternal,
          metadata: {
            pinBindings: {
              A: { sourceNodeId: 'a_in', direction: 'input' },
              B: { sourceNodeId: 'b_in', direction: 'input' },
              CIN: { sourceNodeId: 'cin_in', direction: 'input' },
              SUM: { sourceNodeId: 'adder', sourcePinId: 'SUM', direction: 'output' },
              COUT: { sourceNodeId: 'adder', sourcePinId: 'COUT', direction: 'output' },
            },
            visualElements: [
              {
                id: 'carry_lamp',
                type: 'led',
                sourceNodeId: 'adder',
                sourcePinId: 'COUT',
              },
            ],
          },
        },
      ],
    });

    engine.setInput('a', '1');
    engine.setInput('b', '1');
    engine.setInput('cin', '1');
    const snapshot = engine.settle();

    expect(outputValue(snapshot, 'sum')).toBe('1');
    expect(outputValue(snapshot, 'cout')).toBe('1');
    expect(snapshot.nodeOutputs.chip1.__visual_carry_lamp).toBe('1');
  });

  it('allows parent chip visuals to bind to nested child chip visual outputs', () => {
    const leafCircuit: CircuitDefinition = {
      id: 'visual_leaf_internal',
      name: 'Visual Leaf Internal',
      nodes: [{ id: 'leaf_in', nodeType: 'INPUT', position: { x: 0, y: 0 } }],
      wires: [],
      nets: [],
    };
    const parentCircuit: CircuitDefinition = {
      id: 'visual_parent_internal',
      name: 'Visual Parent Internal',
      nodes: [
        { id: 'parent_in', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'child', nodeType: 'CHIP', chipRefId: 'visual_leaf', position: { x: 120, y: 0 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'parent_in', pinId: 'OUT' }, to: { nodeId: 'child', pinId: 'A' } },
      ],
      nets: [],
    };
    const circuit: CircuitDefinition = {
      id: 'visual_parent_top',
      name: 'Visual Parent Top',
      nodes: [
        { id: 'src', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'parent', nodeType: 'CHIP', chipRefId: 'visual_parent', position: { x: 120, y: 0 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'src', pinId: 'OUT' }, to: { nodeId: 'parent', pinId: 'A' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit, {
      chipLibrary: [
        {
          id: 'visual_leaf',
          name: 'Visual Leaf',
          version: '0.1.0',
          publicPins: [{ id: 'A', name: 'A', direction: 'input' }],
          internalCircuit: leafCircuit,
          metadata: {
            pinBindings: {
              A: { sourceNodeId: 'leaf_in', direction: 'input' },
            },
            visualElements: [
              {
                id: 'lamp',
                type: 'led',
                sourceNodeId: 'leaf_in',
                sourcePinId: 'OUT',
              },
            ],
          },
        },
        {
          id: 'visual_parent',
          name: 'Visual Parent',
          version: '0.1.0',
          publicPins: [{ id: 'A', name: 'A', direction: 'input' }],
          internalCircuit: parentCircuit,
          metadata: {
            pinBindings: {
              A: { sourceNodeId: 'parent_in', direction: 'input' },
            },
            visualElements: [
              {
                id: 'imported_lamp',
                type: 'led',
                sourceNodeId: 'child',
                sourcePinId: '__visual_lamp',
              },
            ],
          },
        },
      ],
    });

    engine.setInput('src', '1');
    let snapshot = engine.settle();
    expect(snapshot.nodeOutputs.parent.__visual_imported_lamp).toBe('1');

    engine.setInput('src', '0');
    snapshot = engine.settle();
    expect(snapshot.nodeOutputs.parent.__visual_imported_lamp).toBe('0');
  });

  it('diagnoses a chip definition that contains itself', () => {
    const circuit: CircuitDefinition = {
      id: 'recursive-chip-top',
      name: 'Recursive Chip Top',
      nodes: [
        { id: 'src', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'chip1', nodeType: 'CHIP', chipRefId: 'loop_chip', position: { x: 140, y: 0 } },
        { id: 'out', nodeType: 'OUTPUT', position: { x: 280, y: 0 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'src', pinId: 'OUT' }, to: { nodeId: 'chip1', pinId: 'A' } },
        { id: 'w2', from: { nodeId: 'chip1', pinId: 'Y' }, to: { nodeId: 'out', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit, {
      chipLibrary: [
        {
          id: 'loop_chip',
          name: 'Loop Chip',
          version: '0.1.0',
          publicPins: [
            { id: 'A', name: 'A', direction: 'input' },
            { id: 'Y', name: 'Y', direction: 'output' },
          ],
          internalCircuit: {
            id: 'loop-chip-internals',
            name: 'Loop Chip Internals',
            nodes: [
              {
                id: 'self',
                nodeType: 'CHIP',
                chipRefId: 'loop_chip',
                position: { x: 0, y: 0 },
              },
            ],
            wires: [],
            nets: [],
          },
        },
      ],
    });

    const snapshot = engine.step();

    expect(snapshot.diagnostics.some((item) => item.code === 'recursive-chip-definition')).toBe(true);
  });

  it('captures LED node state as output sink', () => {
    const circuit: CircuitDefinition = {
      id: 'led-sink-demo',
      name: 'LED Sink Demo',
      nodes: [
        { id: 'in1', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'led', nodeType: 'LED', position: { x: 160, y: 0 } },
      ],
      wires: [{ id: 'w1', from: { nodeId: 'in1', pinId: 'OUT' }, to: { nodeId: 'led', pinId: 'IN' } }],
      nets: [],
    };

    const engine = new SimulationEngine(circuit);
    engine.setInput('in1', '1');
    const snapshot = engine.step();
    expect(outputValue(snapshot, 'led')).toBe('1');
  });

  it('falls back to interface node order for legacy chips without pin bindings', () => {
    const chipInternal: CircuitDefinition = {
      id: 'legacy_buf_internal',
      name: 'Legacy Buffer Internal',
      nodes: [
        { id: 'in0', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'out0', nodeType: 'OUTPUT', position: { x: 160, y: 0 } },
      ],
      wires: [{ id: 'w1', from: { nodeId: 'in0', pinId: 'OUT' }, to: { nodeId: 'out0', pinId: 'IN' } }],
      nets: [],
    };

    const circuit: CircuitDefinition = {
      id: 'legacy_chip_top',
      name: 'Legacy Chip Top',
      nodes: [
        { id: 'src', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'chip1', nodeType: 'CHIP', chipRefId: 'legacy_buf', position: { x: 120, y: 0 } },
        { id: 'sink', nodeType: 'OUTPUT', position: { x: 260, y: 0 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'src', pinId: 'OUT' }, to: { nodeId: 'chip1', pinId: 'IN' } },
        { id: 'w2', from: { nodeId: 'chip1', pinId: 'OUT' }, to: { nodeId: 'sink', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit, {
      chipLibrary: [
        {
          id: 'legacy_buf',
          name: 'Legacy Buf',
          version: '0.0.1',
          publicPins: [
            { id: 'IN', name: 'IN', direction: 'input' },
            { id: 'OUT', name: 'OUT', direction: 'output' },
          ],
          internalCircuit: chipInternal,
        },
      ],
    });

    engine.setInput('src', '1');
    const snapshot = engine.step();
    expect(outputValue(snapshot, 'sink')).toBe('1');
  });

  it('supports fixed power rails using VCC and GND nodes', () => {
    const circuit: CircuitDefinition = {
      id: 'power-rails-demo',
      name: 'Power Rails Demo',
      nodes: [
        { id: 'vcc', nodeType: 'VCC', position: { x: 0, y: 0 } },
        { id: 'gnd', nodeType: 'GND', position: { x: 0, y: 80 } },
        { id: 'out_hi', nodeType: 'OUTPUT', position: { x: 200, y: 0 } },
        { id: 'out_lo', nodeType: 'OUTPUT', position: { x: 200, y: 80 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'vcc', pinId: 'OUT' }, to: { nodeId: 'out_hi', pinId: 'IN' } },
        { id: 'w2', from: { nodeId: 'gnd', pinId: 'OUT' }, to: { nodeId: 'out_lo', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit);
    const snapshot = engine.step();

    expect(outputValue(snapshot, 'out_hi')).toBe('1');
    expect(outputValue(snapshot, 'out_lo')).toBe('0');
  });

  it('evaluates mux, decoder, and adder building blocks', () => {
    const circuit: CircuitDefinition = {
      id: 'building-blocks-demo',
      name: 'Building Blocks Demo',
      nodes: [
        { id: 'vcc', nodeType: 'VCC', position: { x: 0, y: 0 } },
        { id: 'gnd', nodeType: 'GND', position: { x: 0, y: 80 } },
        { id: 'sel', nodeType: 'INPUT', position: { x: 0, y: 160 } },
        { id: 'mux', nodeType: 'MUX2', position: { x: 160, y: 0 } },
        { id: 'decoder', nodeType: 'DECODER2TO4', position: { x: 160, y: 120 } },
        { id: 'adder', nodeType: 'FULL_ADDER', position: { x: 160, y: 240 } },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'gnd', pinId: 'OUT' }, to: { nodeId: 'mux', pinId: 'A' } },
        { id: 'w2', from: { nodeId: 'vcc', pinId: 'OUT' }, to: { nodeId: 'mux', pinId: 'B' } },
        { id: 'w3', from: { nodeId: 'sel', pinId: 'OUT' }, to: { nodeId: 'mux', pinId: 'SEL' } },
        { id: 'w4', from: { nodeId: 'vcc', pinId: 'OUT' }, to: { nodeId: 'decoder', pinId: 'A0' } },
        { id: 'w5', from: { nodeId: 'gnd', pinId: 'OUT' }, to: { nodeId: 'decoder', pinId: 'A1' } },
        { id: 'w6', from: { nodeId: 'vcc', pinId: 'OUT' }, to: { nodeId: 'decoder', pinId: 'EN' } },
        { id: 'w7', from: { nodeId: 'vcc', pinId: 'OUT' }, to: { nodeId: 'adder', pinId: 'A' } },
        { id: 'w8', from: { nodeId: 'vcc', pinId: 'OUT' }, to: { nodeId: 'adder', pinId: 'B' } },
        { id: 'w9', from: { nodeId: 'vcc', pinId: 'OUT' }, to: { nodeId: 'adder', pinId: 'CIN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit);
    engine.setInput('sel', '0');
    let snapshot = engine.step();
    expect(snapshot.nodeOutputs.mux.OUT).toBe('0');
    expect(snapshot.nodeOutputs.decoder.Y1).toBe('1');
    expect(snapshot.nodeOutputs.adder.SUM).toBe('1');
    expect(snapshot.nodeOutputs.adder.COUT).toBe('1');

    engine.setInput('sel', '1');
    snapshot = engine.step();
    expect(snapshot.nodeOutputs.mux.OUT).toBe('1');
  });

  it('evaluates a 4-bit ripple-carry adder made from full adders', () => {
    const nodes: CircuitDefinition['nodes'] = [
      { id: 'gnd', nodeType: 'GND', position: { x: 0, y: 0 } },
      { id: 'cout', nodeType: 'OUTPUT', position: { x: 620, y: 320 } },
    ];
    const wires: CircuitDefinition['wires'] = [
      { id: 'w_cin_0', from: { nodeId: 'gnd', pinId: 'OUT' }, to: { nodeId: 'fa0', pinId: 'CIN' } },
      { id: 'w_carry_0', from: { nodeId: 'fa0', pinId: 'COUT' }, to: { nodeId: 'fa1', pinId: 'CIN' } },
      { id: 'w_carry_1', from: { nodeId: 'fa1', pinId: 'COUT' }, to: { nodeId: 'fa2', pinId: 'CIN' } },
      { id: 'w_carry_2', from: { nodeId: 'fa2', pinId: 'COUT' }, to: { nodeId: 'fa3', pinId: 'CIN' } },
      { id: 'w_cout', from: { nodeId: 'fa3', pinId: 'COUT' }, to: { nodeId: 'cout', pinId: 'IN' } },
    ];

    for (let bit = 0; bit < 4; bit += 1) {
      nodes.push(
        { id: `a${bit}`, nodeType: 'INPUT', position: { x: 0, y: bit * 80 + 40 } },
        { id: `b${bit}`, nodeType: 'INPUT', position: { x: 160, y: bit * 80 + 40 } },
        { id: `fa${bit}`, nodeType: 'FULL_ADDER', position: { x: 340, y: bit * 80 + 40 } },
        { id: `sum${bit}`, nodeType: 'OUTPUT', position: { x: 620, y: bit * 80 + 40 } },
      );
      wires.push(
        { id: `w_a_${bit}`, from: { nodeId: `a${bit}`, pinId: 'OUT' }, to: { nodeId: `fa${bit}`, pinId: 'A' } },
        { id: `w_b_${bit}`, from: { nodeId: `b${bit}`, pinId: 'OUT' }, to: { nodeId: `fa${bit}`, pinId: 'B' } },
        {
          id: `w_sum_${bit}`,
          from: { nodeId: `fa${bit}`, pinId: 'SUM' },
          to: { nodeId: `sum${bit}`, pinId: 'IN' },
        },
      );
    }

    const circuit: CircuitDefinition = {
      id: 'ripple-adder-4',
      name: '4-bit Ripple Adder',
      nodes,
      wires,
      nets: [],
    };

    const engine = new SimulationEngine(circuit);
    engine.setInput('a0', '1');
    engine.setInput('a1', '1');
    engine.setInput('a2', '1');
    engine.setInput('b0', '1');

    let snapshot = engine.settle();
    expect(outputValue(snapshot, 'sum0')).toBe('0');
    expect(outputValue(snapshot, 'sum1')).toBe('0');
    expect(outputValue(snapshot, 'sum2')).toBe('0');
    expect(outputValue(snapshot, 'sum3')).toBe('1');
    expect(outputValue(snapshot, 'cout')).toBe('0');

    engine.setInput('a3', '1');
    snapshot = engine.settle();
    expect(outputValue(snapshot, 'sum0')).toBe('0');
    expect(outputValue(snapshot, 'sum1')).toBe('0');
    expect(outputValue(snapshot, 'sum2')).toBe('0');
    expect(outputValue(snapshot, 'sum3')).toBe('0');
    expect(outputValue(snapshot, 'cout')).toBe('1');
  });

  it('passes 8-bit bus bits through join/split and captures probe hex', () => {
    const wires = Array.from({ length: 8 }, (_, index) => ({
      id: `w_in_${index}`,
      from: { nodeId: index % 2 === 0 ? 'vcc' : 'gnd', pinId: 'OUT' },
      to: { nodeId: 'join', pinId: `D${index}` },
    })).concat(
      Array.from({ length: 8 }, (_, index) => ({
        id: `w_out_${index}`,
        from: { nodeId: 'join', pinId: `Q${index}` },
        to: { nodeId: 'probe', pinId: `D${index}` },
      })),
    );

    const circuit: CircuitDefinition = {
      id: 'bus-demo',
      name: 'Bus Demo',
      nodes: [
        { id: 'vcc', nodeType: 'VCC', position: { x: 0, y: 0 } },
        { id: 'gnd', nodeType: 'GND', position: { x: 0, y: 80 } },
        { id: 'join', nodeType: 'BUS_JOIN8', position: { x: 160, y: 20 } },
        { id: 'probe', nodeType: 'BUS_PROBE8', position: { x: 320, y: 20 } },
      ],
      wires,
      nets: [],
    };

    const snapshot = new SimulationEngine(circuit).step();

    expect(snapshot.nodeOutputs.join.Q0).toBe('1');
    expect(snapshot.nodeOutputs.join.Q1).toBe('0');
    expect(snapshot.nodeStates.probe.bits).toBe('10101010');
    expect(snapshot.nodeStates.probe.hex).toBe('55');
  });

  it('loads and clears an 8-bit register on clock edges', () => {
    const dataWires = Array.from({ length: 8 }, (_, index) => ({
      id: `w_d_${index}`,
      from: { nodeId: index === 0 ? 'vcc' : 'gnd', pinId: 'OUT' },
      to: { nodeId: 'reg', pinId: `D${index}` },
    }));

    const circuit: CircuitDefinition = {
      id: 'register-demo',
      name: 'Register Demo',
      nodes: [
        { id: 'vcc', nodeType: 'VCC', position: { x: 0, y: 0 } },
        { id: 'gnd', nodeType: 'GND', position: { x: 0, y: 80 } },
        { id: 'clk', nodeType: 'INPUT', position: { x: 0, y: 160 } },
        { id: 'load', nodeType: 'INPUT', position: { x: 0, y: 240 } },
        { id: 'clr', nodeType: 'INPUT', position: { x: 0, y: 320 } },
        { id: 'reg', nodeType: 'REGISTER8', position: { x: 180, y: 120 } },
      ],
      wires: [
        ...dataWires,
        { id: 'w_clk', from: { nodeId: 'clk', pinId: 'OUT' }, to: { nodeId: 'reg', pinId: 'CLK' } },
        { id: 'w_load', from: { nodeId: 'load', pinId: 'OUT' }, to: { nodeId: 'reg', pinId: 'LOAD' } },
        { id: 'w_clr', from: { nodeId: 'clr', pinId: 'OUT' }, to: { nodeId: 'reg', pinId: 'CLR' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit);
    engine.setInput('clk', '0');
    engine.setInput('load', '1');
    engine.setInput('clr', '0');
    engine.step();
    engine.setInput('clk', '1');
    let snapshot = engine.step();

    expect(snapshot.nodeOutputs.reg.Q0).toBe('1');
    expect(snapshot.nodeOutputs.reg.Q1).toBe('0');

    engine.setInput('clr', '1');
    snapshot = engine.step();
    expect(snapshot.nodeOutputs.reg.Q0).toBe('0');
  });

  it('supports tri-state buffers and high-Z bus sharing', () => {
    const circuit: CircuitDefinition = {
      id: 'tri-state-demo',
      name: 'Tri-State Demo',
      nodes: [
        { id: 'data_a', nodeType: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'en_a', nodeType: 'INPUT', position: { x: 0, y: 80 } },
        { id: 'data_b', nodeType: 'INPUT', position: { x: 0, y: 160 } },
        { id: 'en_b', nodeType: 'INPUT', position: { x: 0, y: 240 } },
        { id: 'tri_a', nodeType: 'TRISTATE_BUFFER', position: { x: 180, y: 40 } },
        { id: 'tri_b', nodeType: 'TRISTATE_BUFFER', position: { x: 180, y: 200 } },
        { id: 'bus', nodeType: 'OUTPUT', position: { x: 380, y: 120 } },
      ],
      wires: [
        { id: 'w_data_a', from: { nodeId: 'data_a', pinId: 'OUT' }, to: { nodeId: 'tri_a', pinId: 'DATA' } },
        { id: 'w_en_a', from: { nodeId: 'en_a', pinId: 'OUT' }, to: { nodeId: 'tri_a', pinId: 'EN' } },
        { id: 'w_data_b', from: { nodeId: 'data_b', pinId: 'OUT' }, to: { nodeId: 'tri_b', pinId: 'DATA' } },
        { id: 'w_en_b', from: { nodeId: 'en_b', pinId: 'OUT' }, to: { nodeId: 'tri_b', pinId: 'EN' } },
        { id: 'w_bus_a', from: { nodeId: 'tri_a', pinId: 'OUT' }, to: { nodeId: 'bus', pinId: 'IN' } },
        { id: 'w_bus_b', from: { nodeId: 'tri_b', pinId: 'OUT' }, to: { nodeId: 'bus', pinId: 'IN' } },
      ],
      nets: [],
    };

    const engine = new SimulationEngine(circuit);
    engine.setInput('data_a', '1');
    engine.setInput('data_b', '0');
    engine.setInput('en_a', '0');
    engine.setInput('en_b', '0');
    let snapshot = engine.settle();
    expect(outputValue(snapshot, 'bus')).toBe('Z');

    engine.setInput('en_a', '1');
    snapshot = engine.settle();
    expect(outputValue(snapshot, 'bus')).toBe('1');

    engine.setInput('en_b', '1');
    snapshot = engine.settle();
    expect(outputValue(snapshot, 'bus')).toBe('ERR');
  });
});
