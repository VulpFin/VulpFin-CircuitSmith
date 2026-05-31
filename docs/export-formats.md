# Export Formats

## Native `.ligic.json`

Purpose:
- preserves full logical project/circuit data.

Status:
- implemented serializer for circuits and projects.

## Verilog `.v`

Purpose:
- bridge logical design into HDL-based workflows.

MVP support:
- combinational gate translation,
- D flip-flop and T flip-flop always block generation,
- output assignment synthesis.

Future work:
- broader sequential primitives,
- multi-bit buses,
- formal module/chip hierarchy export.

## KiCad Exports

Purpose:
- bridge logical designs into schematic/netlist workflows.

Status:
- placeholder exporter interface and output stub.

Future work:
- symbol mapping,
- footprint mapping,
- netlist emission.