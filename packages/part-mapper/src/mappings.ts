import type { PhysicalMapping } from '@vfcs/circuit-model';
import { findPartByMpn } from './database.js';

const part = (mpn: string) => {
  const found = findPartByMpn(mpn);
  if (!found) {
    throw new Error(`Missing part mapping for ${mpn}`);
  }
  return found;
};

export const LOGICAL_TO_PHYSICAL_MAPPINGS: PhysicalMapping[] = [
  {
    logicalComponentType: 'NAND',
    options: [
      {
        optionId: 'nand-74hc00',
        title: '74HC00 Quad NAND',
        description: 'Direct NAND implementation using 74HC00.',
        parts: [part('74HC00')],
      },
    ],
  },
  {
    logicalComponentType: 'NOR',
    options: [
      {
        optionId: 'nor-74hc02',
        title: '74HC02 Quad NOR',
        description: 'Direct NOR implementation using 74HC02.',
        parts: [part('74HC02')],
      },
    ],
  },
  {
    logicalComponentType: 'NOT',
    options: [
      {
        optionId: 'not-74hc04',
        title: '74HC04 Hex Inverter',
        description: 'Direct inverter implementation using 74HC04.',
        parts: [part('74HC04')],
      },
    ],
  },
  {
    logicalComponentType: 'AND',
    options: [
      {
        optionId: 'and-74hc08',
        title: '74HC08 Quad AND',
        description: 'Direct AND implementation using 74HC08.',
        parts: [part('74HC08')],
      },
    ],
  },
  {
    logicalComponentType: 'OR',
    options: [
      {
        optionId: 'or-74hc32',
        title: '74HC32 Quad OR',
        description: 'Direct OR implementation using 74HC32.',
        parts: [part('74HC32')],
      },
    ],
  },
  {
    logicalComponentType: 'XOR',
    options: [
      {
        optionId: 'xor-74hc86',
        title: '74HC86 Quad XOR',
        description: 'Direct XOR implementation using 74HC86.',
        parts: [part('74HC86')],
      },
    ],
  },
  {
    logicalComponentType: 'DFF',
    options: [
      {
        optionId: 'dff-74hc74',
        title: '74HC74 D flip-flop',
        description: 'Direct D flip-flop implementation.',
        parts: [part('74HC74')],
      },
      {
        optionId: 'dff-cd4013',
        title: 'CD4013 D flip-flop',
        description: 'Alternative CMOS family D flip-flop implementation.',
        parts: [part('CD4013')],
      },
    ],
  },
  {
    logicalComponentType: 'TFF',
    options: [
      {
        optionId: 'tff-jk-74hc76',
        title: '74HC76 JK flip-flop strategy',
        description: 'Implement TFF by wiring J = K = T on a JK flip-flop.',
        parts: [part('74HC76')],
      },
      {
        optionId: 'tff-dff-xor',
        title: '74HC74 + 74HC86 strategy',
        description: 'Implement TFF as D = Q XOR T using one DFF and one XOR gate.',
        parts: [part('74HC74'), part('74HC86')],
      },
      {
        optionId: 'tff-verilog',
        title: 'Verilog always block strategy',
        description: 'Implement TFF behavior in HDL for FPGA/CPLD/ASIC flow.',
      },
    ],
  },
];

export function getMappingsForLogicalType(logicalComponentType: string): PhysicalMapping[] {
  return LOGICAL_TO_PHYSICAL_MAPPINGS.filter(
    (mapping) => mapping.logicalComponentType.toLowerCase() === logicalComponentType.toLowerCase(),
  );
}