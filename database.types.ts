export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CartItem = {
  name: string;
  quantity: number;
  price: number;
};

export type MaterialCartStatus = 'pending_approval' | 'approved' | 'collected' | 'rejected';
export type PaymentStatus = 'unpaid' | 'paid';

export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      project_material_carts: {
        Row: {
          id: string;
          project_id: string;
          provider_id: string;
          supplier_id: string | null;
          items: CartItem[];
          total_amount_cfa: number;
          status: MaterialCartStatus;
          payment_status: PaymentStatus;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          provider_id: string;
          supplier_id?: string | null;
          items?: CartItem[];
          total_amount_cfa?: number;
          status?: MaterialCartStatus;
          payment_status?: PaymentStatus;
          approved_at?: string | null;
          approved_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['project_material_carts']['Row']>;
        Relationships: [];
      };
    };
    Views: {
      [key: string]: never;
    };
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: any;
      };
    };
    Enums: {
      [key: string]: string;
    };
    CompositeTypes: {
      [key: string]: never;
    };
  };
}
