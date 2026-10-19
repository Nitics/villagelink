// Shapes used inside the app (mapped from the Supabase tables in data.ts).

export type Plan = 'free' | 'verified' | 'featured';

export interface Confirmation {
  at: number; // ms since epoch
  open: boolean;
  note: string;
}

export interface Business {
  id: string;
  name: string;
  category: string; // fuel, spaza, clinic, ...
  typeLabel: string;
  town: string;
  address: string;
  phone: string;
  whatsapp: string;
  openingHours: string;
  hoursChecked: string; // yyyy-mm-dd
  sellsOnline: boolean;
  plan: Plan;
  latitude: number | null;
  longitude: number | null;
  description: string;
  isActive: boolean;
  createdAt: string;
  confirmation: Confirmation | null;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  price: number;
  unit: string;
  inStock: boolean;
}

export type ListingKind = 'goods' | 'produce' | 'service';

export interface Listing {
  id: string;
  kind: ListingKind;
  title: string;
  price: number;
  unit: string;
  town: string;
  sellerName: string;
  phone: string;
  note: string;
  ownerId: string;
  createdAt: number;
}

export interface StudyGroup {
  id: string;
  subject: string;
  grade: string;
  title: string;
  place: string;
  isOnline: boolean;
  nextSession: string;
  town: string;
  contact: string;
  ownerId: string;
  members: string[];
}

export interface Report {
  at: number;
  open: boolean;
}

export type OrderStatus = 'sent' | 'accepted' | 'ready' | 'done' | 'declined' | 'cancelled';

export interface OrderItem {
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  businessId: string;
  shopName: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  method: 'collect' | 'delivery';
  deliveryAddress: string;
  note: string;
  status: OrderStatus;
  total: number;
  at: number;
  items: OrderItem[];
}

export interface PlanRequest {
  id: string;
  businessName: string;
  town: string;
  plan: Plan;
  contactName: string;
  phone: string;
  details: string;
  status: 'new' | 'done';
  at: number;
  userId: string;
}

export type Status = 'confirmed' | 'expected' | 'unverified' | 'closedConfirmed' | 'closed';
