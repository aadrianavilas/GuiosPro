// Tipos de organización — deben coincidir con OrganizationType del backend
export type OrganizationType =
  | 'public'
  | 'private'
  | 'educational'
  | 'ngo'
  | 'other';

export interface OrganizationPayload {
  business_name: string;
  commercial_name?: string;
  organization_type: OrganizationType;
  sector?: string;
  address?: string;
  city: string;
  country: string;
}

export interface OrganizationData extends OrganizationPayload {
  id: number;
  organization_type_display: string;
  created_at: string;
}

export interface OrganizationMeResponse {
  has_organization: boolean;
  organization: OrganizationData | null;
}
