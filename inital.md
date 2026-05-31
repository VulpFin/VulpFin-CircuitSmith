You are helping me initialize a new open-source project called VulpFin CircuitSmith (VFCS).

Project goal:
VulpFin CircuitSmith (VFCS) is a digital logic simulator and hardware bridge. It should let users draw logic gates and circuits at the pure logic level, simulate them in real time, package circuits as reusable “virtual chips,” and eventually map those virtual chips to real-world hardware implementations such as 74xx/4000-series ICs, Verilog modules, KiCad schematic exports, DigiKey parts, EasyEDA/LCSC parts, and SnapEDA/SnapMagic symbols/footprints.

The project should NOT try to replace KiCad or EasyEDA at first. Instead, it should become the missing bridge between:
1. logic simulation,
2. reusable chip/module abstraction,
3. HDL export,
4. real-world component matching,
5. schematic/PCB workflow export.

Reference inspiration/tools/repos to study conceptually:
- Logisim Evolution: for educational logic simulation and circuit editing ideas.
- Digital by hneemann: for digital circuit simulation, reusable components, and HDL export concepts.
- KiCad file formats: for future schematic/netlist export.
- DigiKey Product Information API: for future part search and purchasable component lookup.
- SnapEDA/SnapMagic: for future symbol/footprint/3D model linking.
- EasyEDA / LCSC: for future part/library lookup integration.

Do not copy code from those repositories unless licenses are compatible and explicitly documented. For this initial repo setup, only create our own clean implementation and leave integration stubs/interfaces where needed.

Preferred stack:
- Frontend: React + TypeScript + Vite
- UI styling: Tailwind CSS
- Interactive editor: use React Flow if practical, otherwise structure the code so a custom SVG/canvas editor can be added later.
- Backend: optional for now. If adding one, use Python FastAPI or Django only as a placeholder. For the initial repo, prioritize a working frontend simulator.
- Package manager: npm or pnpm, whichever is already configured. Prefer pnpm if starting from scratch.
- Testing: Vitest for TypeScript unit tests.
- Lint/format: ESLint + Prettier.
- Project should be clean, modular, and easy to extend.

Initial repo tasks:
1. Create a clean project structure for VulpFin CircuitSmith (VFCS).
2. Create a frontend app with a dark, technical UI.
3. Add a basic digital logic simulation engine in TypeScript.
4. Add a simple canvas/editor area where the architecture is ready for gates, chips, and wires.
5. Add a starter component palette with:
   - Input
   - Output/LED
   - Clock
   - NOT
   - AND
   - OR
   - NAND
   - NOR
   - XOR
   - XNOR
   - D Flip-Flop
   - T Flip-Flop
6. Add an internal data model for circuits, nodes, pins, nets, wires, and reusable chip definitions.
7. Add initial “Make Chip” architecture, even if the UI is just a placeholder.
8. Add export architecture for:
   - native `.ligic.json`
   - Verilog `.v`
   - future KiCad schematic/netlist export
9. Add placeholder integration modules for:
   - DigiKey search
   - EasyEDA/LCSC search
   - SnapEDA/SnapMagic CAD model lookup
   - KiCad symbol/footprint mapping
10. Add README documentation explaining the purpose, roadmap, architecture, and MVP milestones.

Important concept:
Separate logical components from physical components.

A logical component represents behavior:
- AND gate
- D flip-flop
- T flip-flop
- counter
- user-created virtual chip

A physical component represents a possible implementation:
- 74HC08
- 74HC74
- 74HC86
- CD4013
- CPLD
- FPGA Verilog
- MCU firmware model

Please model this separation from the beginning.

Suggested folders:

/apps/web
  React + TypeScript frontend

/packages/sim-core
  Digital logic simulation engine

/packages/circuit-model
  Shared circuit/project/component data types

/packages/exporters
  Verilog exporter
  Ligic JSON exporter
  Placeholder KiCad exporter

/packages/part-mapper
  Logical-to-physical mapping logic
  Example mappings for 74xx ICs

/packages/integrations
  digikey placeholder
  easyeda placeholder
  snapeda placeholder
  kicad placeholder

/docs
  architecture.md
  roadmap.md
  component-model.md
  simulation-engine.md
  export-formats.md

Initial simulator requirements:
- Support digital values:
  - 0
  - 1
  - X for unknown
  - Z for high impedance
  - ERR for conflicting drivers
- Support combinational gate evaluation.
- Support a basic event/update loop.
- Support sequential component state for flip-flops.
- Add basic unit tests for gates and flip-flop behavior.

Data model requirements:
Create TypeScript interfaces/types for:

- LogicValue
- PinDirection
- PinDefinition
- NodeDefinition
- NodeInstance
- Wire
- Net
- CircuitDefinition
- ProjectDefinition
- ComponentDefinition
- ChipDefinition
- PhysicalPart
- PhysicalMapping
- ExportTarget

Example physical mapping:
A T flip-flop can be implemented as:
- a JK flip-flop with J = K = T
- a D flip-flop plus XOR feedback
- Verilog always block
- CPLD/FPGA logic cell

Add a small part mapping database with examples:
- 74HC00: NAND gates
- 74HC02: NOR gates
- 74HC04: NOT gates
- 74HC08: AND gates
- 74HC32: OR gates
- 74HC86: XOR gates
- 74HC74: dual D flip-flop
- 74HC76: JK flip-flop
- CD4013: dual D flip-flop

Verilog export requirements:
For MVP, export simple combinational circuits and basic flip-flops.
Create clean placeholder functions where full support is not implemented yet.
Do not overcomplicate it.

UI requirements:
The initial UI should include:
- App title: VulpFin CircuitSmith (VFCS)
- Left component palette
- Center workspace/canvas
- Right inspector panel
- Bottom simulation/status panel
- Buttons:
  - Run/Pause simulation
  - Step
  - Reset
  - Make Chip
  - Export Ligic JSON
  - Export Verilog
  - Find Real Parts, placeholder for now

Dark theme preferred:
- dark navy/black background
- cyan/blue accents
- orange highlight for active signals if useful
- clean technical interface

Create at least one example circuit:
- T Flip-Flop demo
- Include it as JSON seed/demo data
- Show how it could map to:
  - 74HC74 + 74HC86
  - 74HC76
  - Verilog

README should include:
- What VulpFin CircuitSmith (VFCS) is
- What problem it solves
- What exists today and why VulpFin CircuitSmith (VFCS) is different
- MVP scope
- Long-term roadmap
- How to run the project
- How to run tests
- Project architecture
- Licensing notes
- Integration notes for KiCad, DigiKey, EasyEDA, SnapEDA/SnapMagic

Do not attempt to implement full PCB routing, SPICE simulation, autorouting, or real API calls yet.
Only create clean interfaces and stubs for those.

Branding requirements:

Centralize all branding in one config/constants file.
Do not hardcode the app name, acronym, tagline, or company name throughout the UI.
Use “VulpFin CircuitSmith” for the public display name.
Use “VFCS” for short labels, internal names, package namespaces, and compact UI areas where appropriate.
Use “TG11” as the parent/creator brand.
Update README, package metadata, app title, landing page/header, docs, and example project descriptions to use the new branding.
Keep the architecture generic enough that the product name can change again later by editing only the branding constants/config.

Suggested UI header:
VulpFin CircuitSmith
From logic to living hardware.

Suggested README intro:
VulpFin CircuitSmith, or VFCS, is a logic-to-hardware design workbench by TG11. It begins as a real-time digital logic simulator and grows toward a full bridge between abstract logic design and real hardware workflows. The goal is to let users draw logic, simulate behavior, package circuits as reusable virtual chips, map those chips to real-world parts or HDL, and export into schematic/PCB design tools.

Avoid:

Calling it only a “logic simulator.”
Branding it as a KiCad/EasyEDA replacement.
Overpromising full PCB routing or full EDA replacement in the MVP.
Hardcoding the old name anywhere.

After setup, provide:
1. a summary of created files,
2. how to install dependencies,
3. how to run the dev server,
4. how to run tests,
5. next recommended implementation steps.

Be careful to keep the repo maintainable and not over-engineered. The first goal is a working skeleton with a real simulation core, clean models, and clear extension points.