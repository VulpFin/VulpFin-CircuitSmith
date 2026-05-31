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
});