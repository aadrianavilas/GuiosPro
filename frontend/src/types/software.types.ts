export interface SoftwarePayload {
  name: string;
  version?: string;
  description?: string;
}

export interface SoftwareData extends SoftwarePayload {
  id: number;
  created_at: string;
}

export interface EvaluationPayload {
  name: string;
  software: number;
  organization: number;
  evaluator: number;
}
