import type { PhysicalPart } from '@vfcs/circuit-model';

export const PHYSICAL_PART_DATABASE: PhysicalPart[] = [
  {
    id: '74HC00',
    manufacturerPartNumber: '74HC00',
    family: '74HC',
    packageType: 'DIP/SOIC',
    description: 'Quad 2-input NAND gate',
    capabilities: ['NAND', 'combinational'],
  },
  {
    id: '74HC02',
    manufacturerPartNumber: '74HC02',
    family: '74HC',
    packageType: 'DIP/SOIC',
    description: 'Quad 2-input NOR gate',
    capabilities: ['NOR', 'combinational'],
  },
  {
    id: '74HC04',
    manufacturerPartNumber: '74HC04',
    family: '74HC',
    packageType: 'DIP/SOIC',
    description: 'Hex inverter',
    capabilities: ['NOT', 'combinational'],
  },
  {
    id: '74HC08',
    manufacturerPartNumber: '74HC08',
    family: '74HC',
    packageType: 'DIP/SOIC',
    description: 'Quad 2-input AND gate',
    capabilities: ['AND', 'combinational'],
  },
  {
    id: '74HC32',
    manufacturerPartNumber: '74HC32',
    family: '74HC',
    packageType: 'DIP/SOIC',
    description: 'Quad 2-input OR gate',
    capabilities: ['OR', 'combinational'],
  },
  {
    id: '74HC86',
    manufacturerPartNumber: '74HC86',
    family: '74HC',
    packageType: 'DIP/SOIC',
    description: 'Quad 2-input XOR gate',
    capabilities: ['XOR', 'combinational'],
  },
  {
    id: '74HC74',
    manufacturerPartNumber: '74HC74',
    family: '74HC',
    packageType: 'DIP/SOIC',
    description: 'Dual D-type flip-flop',
    capabilities: ['DFF', 'sequential'],
  },
  {
    id: '74HC76',
    manufacturerPartNumber: '74HC76',
    family: '74HC',
    packageType: 'DIP/SOIC',
    description: 'Dual JK flip-flop',
    capabilities: ['JKFF', 'sequential'],
  },
  {
    id: 'CD4013',
    manufacturerPartNumber: 'CD4013',
    family: '4000',
    packageType: 'DIP/SOIC',
    description: 'Dual D-type flip-flop',
    capabilities: ['DFF', 'sequential'],
  },
];

export function findPartByMpn(mpn: string): PhysicalPart | undefined {
  return PHYSICAL_PART_DATABASE.find(
    (part) => part.manufacturerPartNumber.toLowerCase() === mpn.toLowerCase(),
  );
}