# Component Model

## Logical Layer

Logical components define behavior independent of vendor parts.

Examples:
- `AND`, `OR`, `NOT`, `XOR`
- `DFF`, `TFF`
- user-defined virtual chips

Logical interfaces are modeled with:
- `NodeDefinition`
- `NodeInstance`
- `PinDefinition`
- `CircuitDefinition`

## Physical Layer

Physical parts define implementation candidates for logical behavior.

Examples:
- `74HC08` for AND
- `74HC74` for D flip-flops
- `74HC74 + 74HC86` strategy for T flip-flop

Physical interfaces are modeled with:
- `PhysicalPart`
- `PhysicalMapping`

## Why Separate Layers

- allows one logical design to target many implementations,
- avoids coupling simulation behavior to single vendor choices,
- supports future cost/availability-aware mapping decisions.