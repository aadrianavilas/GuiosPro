/**
 * Interfaces y Tipos de Datos de Autenticación - GuiosPro
 */

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_email_verified?: boolean;
  is_mfa_enabled?: boolean;
  role?: string;
  organization?: number | null;
  organization_name?: string | null;
  groups?: string[];
  avatar?: string | null;
}

export interface UserProfilePayload {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  avatar?: string | null;
  new_password?: string;
  confirm_password?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  mfa_required: boolean;
  available_mfa_methods?: string[];
  user?: User;
  detail?: string;
  access?: string;
  refresh?: string;
}

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirm?: string;
}

export interface FormErrorState {
  email?: string;
  password?: string;
  general?: string;
}
