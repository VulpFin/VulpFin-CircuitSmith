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

  it('supports configurable clock frequency parameter mapping', () => {
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

    expect(outputValue(first, 'led_fast')).not.toBe(outputValue(second, 'led_fast'));
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
});
