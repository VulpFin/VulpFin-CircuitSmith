import {
  LIGIC_SCHEMA,
  type CircuitDefinition,
  type LigicJsonEnvelope,
  type ProjectDefinition,
  withCircuitSchemaMetadata,
} from '@vfcs/circuit-model';

export interface LigicJsonExportResult {
  filename: string;
  content: string;
}

export function exportCircuitAsLigicJson(circuit: CircuitDefinition): LigicJsonExportResult {
  const payload: LigicJsonEnvelope = {
    schema: LIGIC_SCHEMA,
    generatedAt: new Date().toISOString(),
    payloadType: 'circuit',
    circuit: withCircuitSchemaMetadata(circuit),
  };

  return {
    filename: `${circuit.id}.ligic.json`,
    content: JSON.stringify(payload, null, 2),
  };
}

export function exportProjectAsLigicJson(project: ProjectDefinition): LigicJsonExportResult {
  const payload: LigicJsonEnvelope = {
    schema: LIGIC_SCHEMA,
    generatedAt: new Date().toISOString(),
    payloadType: 'project',
    project,
  };

  return {
    filename: `${project.id}.ligic.json`,
    content: JSON.stringify(payload, null, 2),
  };
}
