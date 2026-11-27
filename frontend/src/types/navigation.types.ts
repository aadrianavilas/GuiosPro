export interface NavigationOption {
  id: number;
  name: string;
  icon: string;
  path: string;
  order: number;
}

export interface NavigationModule {
  id: number;
  name: string;
  icon: string | null;
  order: number;
  options: NavigationOption[];
}
