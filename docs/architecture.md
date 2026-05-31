# VFCS Architecture

## Core Layers

1. `circuit-model` defines canonical project, circuit, component, chip, and mapping types.
2. `sim-core` evaluates logical behavior and node state over discrete simulation ticks.
3. `exporters` convert logical circuits into portable formats.
4. `part-mapper` associates logical components to physical implementation options.
5. `integrations` provides boundary interfaces for external catalog/CAD systems.
6. `web` orchestrates authoring and simulation workflows in the UI.

## Data Flow

1. User assembles a `CircuitDefinition` in the editor.
2. `SimulationEngine` resolves inputs and updates gate/sequential outputs.
3. Inspector/status panels display resolved values and mappings.
4. Export actions serialize to Ligic JSON or Verilog.
5. Mapping and integration stubs prepare external toolchain lookups.

## Design Principles

- Keep logical behavior separate from physical part implementation.
- Keep package boundaries clean and small.
- Favor stable interfaces and incremental feature expansion.
- Avoid overfitting MVP to any single downstream EDA vendor.