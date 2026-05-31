# Simulation Engine

## Supported Logic Values

- `0`: logic low
- `1`: logic high
- `X`: unknown
- `Z`: high impedance / undriven
- `ERR`: conflicting driven values

## Engine Behavior

- source nodes (`INPUT`, `CLOCK`) are evaluated first,
- combinational gate network is iterated until stability or pass limit,
- sequential nodes (`DFF`, `TFF`) update on rising clock edges,
- output nodes capture incoming values for display/inspection.

## Extensibility

- new node definitions can be added to the default library,
- sequential components can define dedicated state transition logic,
- net scheduling can evolve to event-queue based simulation.