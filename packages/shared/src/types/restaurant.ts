import type { RestaurantStatus } from '../constants/index';

export interface Restaurant {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  contactNumber: string;
  address: string;
  category: string | null;
  description: string | null;
  logoUrl: string | null;
  vatPercentage: number;
  serviceChargePercentage: number;
  taxPercentage: number;
  status: RestaurantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface RestaurantPublic {
  id: string;
  name: string;
  slug: string;
  contactNumber: string;
  address: string;
  category: string | null;
  description: string | null;
  logoUrl: string | null;
  vatPercentage: number;
  serviceChargePercentage: number;
  taxPercentage: number;
}
