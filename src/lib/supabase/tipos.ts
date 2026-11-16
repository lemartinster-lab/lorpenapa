/**
 * Tipos de la base de datos para el cliente de Supabase.
 * Escritos a mano a partir de supabase/migrations/. Si cambias el esquema,
 * actualiza también este archivo.
 */

type Tabla<Fila, Insertar, Actualizar = Partial<Insertar>> = {
  Row: Fila;
  Insert: Insertar;
  Update: Actualizar;
  Relationships: [];
};

export type Rol = "owner" | "staff";
export type EstadoReserva = "pending" | "confirmed" | "collected" | "cancelled";

export type FilaTienda = {
  id: string;
  slug: string;
  name: string;
  whatsapp: string | null;
  address: string | null;
  opening_hours: string | null;
  reservation_hours: number;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type FilaMiembro = { shop_id: string; user_id: string; role: Rol; created_at: string };

export type FilaCategoria = { id: string; shop_id: string; name: string; position: number; created_at: string };

export type FilaMarca = { id: string; shop_id: string; name: string; created_at: string };

export type FilaProducto = {
  id: string;
  shop_id: string;
  category_id: string | null;
  brand_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  sale_price_cents: number | null;
  is_new: boolean;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type FilaVariante = {
  id: string;
  shop_id: string;
  product_id: string;
  size: string;
  color: string | null;
  sku: string | null;
  stock: number;
  position: number;
  created_at: string;
  updated_at: string;
};

export type FilaReserva = {
  id: string;
  shop_id: string;
  variant_id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  status: EstadoReserva;
  expires_at: string;
  consent_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      shops: Tabla<
        FilaTienda,
        {
          slug: string;
          name: string;
          whatsapp?: string | null;
          address?: string | null;
          opening_hours?: string | null;
          reservation_hours?: number;
          is_published?: boolean;
        }
      >;
      members: Tabla<FilaMiembro, { shop_id: string; user_id: string; role?: Rol }>;
      categories: Tabla<FilaCategoria, { shop_id: string; name: string; position?: number }>;
      brands: Tabla<FilaMarca, { shop_id: string; name: string }>;
      products: Tabla<
        FilaProducto,
        {
          shop_id: string;
          category_id?: string | null;
          brand_id?: string | null;
          name: string;
          description?: string | null;
          price_cents: number;
          sale_price_cents?: number | null;
          is_new?: boolean;
          is_active?: boolean;
          position?: number;
        }
      >;
      variants: Tabla<
        FilaVariante,
        {
          shop_id: string;
          product_id: string;
          size?: string;
          color?: string | null;
          sku?: string | null;
          stock?: number;
          position?: number;
        }
      >;
      reservations: Tabla<
        FilaReserva,
        {
          shop_id: string;
          variant_id: string;
          code: string;
          customer_name: string;
          customer_phone: string;
          quantity?: number;
          status?: "pending" | "confirmed";
          expires_at: string;
          consent_at: string;
        },
        { status?: EstadoReserva; customer_name?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      disponibilidad: {
        Args: { p_tienda: string };
        Returns: { variant_id: string; disponible: number }[];
      };
      crear_reserva: {
        Args: {
          p_variante: string;
          p_nombre: string;
          p_telefono: string;
          p_cantidad: number;
          p_consentimiento: boolean;
        };
        Returns: { codigo: string; caduca: string }[];
      };
      marcar_recogida: { Args: { p_reserva: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
