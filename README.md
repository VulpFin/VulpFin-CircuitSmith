# VulpFin CircuitSmith (VFCS)

VulpFin CircuitSmith, or VFCS, is a logic-to-hardware design workbench by TG11. It begins as a real-time digital logic simulator and grows toward a full bridge between abstract logic design and real hardware workflows. The goal is to let users draw logic, simulate behavior, package circuits as reusable virtual chips, map those chips to real-world parts or HDL, and export into schematic/PCB design tools.

## Why This Project Exists

Most tools today are strong in one area:
- education-first logic simulation,
- schematic/PCB authoring,
- HDL development,
- or parts procurement.

VFCS is intentionally different: it is the bridge between these layers, not a replacement for KiCad or EasyEDA.

## Current MVP Scope

This repository currently provides a clean monorepo skeleton with:
- a React + TypeScript + Vite frontend (`apps/web`) with a dark technical UI shell,
- a shared circuit and project data model (`packages/circuit-model`),
- a TypeScript digital simulation engine (`packages/sim-core`) with combinational and sequential support,
- exporters for `.ligic.json`, Verilog, and placeholder KiCad output (`packages/exporters`),
- logical-to-physical mapping seed data for 74xx/4000 families (`packages/part-mapper`),
- integration stubs for DigiKey, EasyEDA/LCSC, SnapEDA/SnapMagic, and KiCad symbol mapping (`packages/integrations`),
- a seeded T flip-flop demo circuit and mapping notes.

## What Exists Today and Why VFCS Is Different

What exists today:
- logic simulators that generally stop at simulation,
- EDA schematic/PCB tools that generally start at physical design,
- HDL tools that do not preserve user-friendly visual abstraction.

How VFCS differs:
- models logical behavior and physical implementation separately from the beginning,
- prepares reusable virtual chips as first-class outputs,
- includes pathing for both HDL export and physical part mapping.

## Architecture Snapshot

- `apps/web`:
  - UI shell with palette, workspace, inspector, status panel, simulator controls.
  - "Make Chip" scaffolding and export actions.
- `packages/circuit-model`:
  - canonical interfaces/types (`LogicValue`, `NodeInstance`, `CircuitDefinition`, `PhysicalMapping`, etc.).
  - centralized branding constants and `createChipDefinitionFromCircuit` architecture helper.
- `packages/sim-core`:
  - logic value handling (`0`, `1`, `X`, `Z`, `ERR`),
  - gate evaluation,
  - step-based update loop,
  - DFF/TFF sequential state handling,
  - unit tests with Vitest.
- `packages/exporters`:
  - Ligic JSON exporter,
  - MVP Verilog exporter,
  - KiCad exporter placeholder.
- `packages/part-mapper`:
  - part database and mapping options (including TFF -> 74HC76 or 74HC74 + 74HC86 or Verilog).
- `packages/integrations`:
  - stable placeholder APIs for future connector work.

## Logical vs Physical Separation

Logical components represent behavior:
- gates,
- flip-flops,
- counters,
- user-defined chips.

Physical components represent implementation options:
- 74HC08 / 74HC74 / 74HC86,
- CD4013,
- HDL targets,
- programmable logic devices.

The data model and part-mapper package keep these as separate concepts from day one.

## T Flip-Flop Demo

Seed file:
- `apps/web/src/data/t-flip-flop-demo.ligic.json`

The demo includes mapping examples for:
- `74HC74 + 74HC86`,
- `74HC76`,
- Verilog strategy.

## Getting Started

### Install dependencies

```bash
pnpm install
```

### Run the web app

```bash
pnpm dev
```

### Run tests

```bash
pnpm test
```

### Build workspace packages

```bash
pnpm build
```

## Lint and Format

```bash
pnpm lint
pnpm format
```

## Export Notes

Current supported export path:
- `.ligic.json` (native project/circuit serialization),
- `.v` (MVP Verilog generation for core gates and flip-flops).

Planned:
- KiCad schematic/netlist export with symbol/footprint mapping.

## Integration Notes

The integration package contains API-compatible placeholders for:
- DigiKey search,
- EasyEDA/LCSC search,
- SnapEDA/SnapMagic model lookup,
- KiCad symbol/footprint mapping.

No external API calls are implemented yet.

## Roadmap (High Level)

1. strengthen interactive editor graph operations (node add/delete/connect).
2. add richer net resolution and deterministic scheduling.
3. support virtual chip authoring UI and library management.
4. improve Verilog coverage and formalize `.ligic.json` schema versions.
5. connect integration adapters and part normalization.
6. add schematic/netlist exporters.

## Licensing Notes

This repository uses clean-room implementation only. Inspiration from existing tools is conceptual. No third-party source code is copied into this project.

When external formats/APIs are integrated, compatible licenses and terms must be reviewed and documented per connector/exporter.