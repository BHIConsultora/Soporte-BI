/**
 * Tipos de la base, con el formato que genera `supabase gen types typescript`.
 * Escritos a mano a partir de `supabase/migrations/`: si Lovable los regenera, el resultado
 * tiene que ser equivalente. Solo están las tablas y funciones que usa el frontend.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Relacion = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Tabla<Row, Relationships extends Relacion[] = []> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

export type Database = {
  public: {
    Tables: {
      cliente: Tabla<{
        id: number;
        nombre: string;
        tipo: Database["public"]["Enums"]["tipo_cliente"];
        tenant_id: string | null;
        dominio: string | null;
        activo: boolean;
        creado_en: string;
      }>;
      area: Tabla<{
        id: number;
        cliente_id: number;
        nombre: string;
        lideres: string[];
        activo: boolean;
      }>;
      tablero: Tabla<{
        id: string;
        cliente_id: number;
        nombre: string;
        paginas: string[];
        powerbi_report_id: string | null;
        activo: boolean;
      }>;
      tablero_area: Tabla<
        {
          tablero_id: string;
          area_id: number;
          cliente_id: number;
        },
        [
          {
            foreignKeyName: "tablero_area_tablero_id_cliente_id_fkey";
            columns: ["tablero_id", "cliente_id"];
            isOneToOne: false;
            referencedRelation: "tablero";
            referencedColumns: ["id", "cliente_id"];
          },
          {
            foreignKeyName: "tablero_area_area_id_cliente_id_fkey";
            columns: ["area_id", "cliente_id"];
            isOneToOne: false;
            referencedRelation: "area";
            referencedColumns: ["id", "cliente_id"];
          },
        ]
      >;
      ticket: Tabla<{
        id: number;
        cliente_id: number;
        tablero_id: string;
        pagina: string | null;
        tipo: Database["public"]["Enums"]["tipo_ticket"];
        descripcion: string;
        urgencia: Database["public"]["Enums"]["urgencia_ticket"];
        estado: Database["public"]["Enums"]["estado_ticket"];
        prioridad: Database["public"]["Enums"]["prioridad_ticket"];
        autor_id: string;
        autor_nombre: string;
        fecha_alta: string;
        ultima_actualizacion: string;
        fecha_resuelto: string | null;
      }>;
      ticket_soporte: Tabla<
        {
          ticket_id: number;
          autor_email: string;
          contexto: Json | null;
          categoria: Database["public"]["Enums"]["tipo_ticket"] | null;
          resumen_ia: string | null;
          procesado_ia: boolean;
          asignado_a: string | null;
          vence_sla: string | null;
        },
        [
          {
            foreignKeyName: "ticket_soporte_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: true;
            referencedRelation: "ticket";
            referencedColumns: ["id"];
          },
        ]
      >;
      historial: Tabla<{
        id: number;
        ticket_id: number;
        tipo: Database["public"]["Enums"]["tipo_historial"];
        autor: string;
        autor_email: string | null;
        autor_es_ia: boolean;
        fecha: string;
        texto: string;
        visible: boolean;
        estado_borrador: Database["public"]["Enums"]["estado_borrador"] | null;
      }>;
      adjunto: Tabla<
        {
          id: string;
          historial_id: number;
          nombre: string;
          tipo_mime: string;
          tamano_bytes: number;
          storage_path: string;
          creado_en: string;
        },
        [
          {
            foreignKeyName: "adjunto_historial_id_fkey";
            columns: ["historial_id"];
            isOneToOne: false;
            referencedRelation: "historial";
            referencedColumns: ["id"];
          },
        ]
      >;
      feriado: Tabla<{
        id: number;
        fecha: string;
        descripcion: string;
      }>;
      solicitud_acceso: Tabla<{
        id: number;
        tenant_id: string;
        dominio: string | null;
        email: string;
        nombre: string;
        fecha: string;
        estado: Database["public"]["Enums"]["estado_solicitud"];
      }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      acceso_actual: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["CompositeTypes"]["acceso_resuelto"];
      };
      elegir_cliente: { Args: { p_cliente_id: number }; Returns: boolean };
      olvidar_cliente_elegido: { Args: Record<PropertyKey, never>; Returns: undefined };
      registrar_solicitud_acceso: { Args: Record<PropertyKey, never>; Returns: undefined };
      crear_ticket: {
        Args: {
          p_tablero_id: string;
          p_tipo: Database["public"]["Enums"]["tipo_ticket"];
          p_descripcion: string;
          p_urgencia: Database["public"]["Enums"]["urgencia_ticket"];
          p_pagina?: string | null;
          p_contexto?: Json | null;
        };
        Returns: number;
      };
    };
    Enums: {
      tipo_ticket:
        | "Dato incorrecto"
        | "El tablero no se actualiza"
        | "Acceso / permisos"
        | "Error visual o de carga"
        | "Pedido de mejora"
        | "Consulta"
        | "Otro";
      urgencia_ticket: "Baja" | "Media" | "Alta" | "Crítica";
      estado_ticket: "Nuevo" | "En análisis" | "Esperando al cliente" | "Resuelto" | "Cerrado";
      prioridad_ticket: "P1" | "P2" | "P3" | "P4";
      tipo_historial: "estado" | "comentario" | "nota_interna" | "borrador_respuesta" | "asignacion" | "prioridad";
      estado_borrador: "pendiente" | "publicado" | "descartado";
      tipo_cliente: "tenant" | "satelite";
      estado_solicitud: "pendiente" | "aprobada" | "rechazada";
      rol_bhi: "soporte" | "admin";
    };
    CompositeTypes: {
      acceso_resuelto: {
        tipo: "bhi" | "cliente" | "elegir_cliente" | "denegado" | "anonimo";
        rol: string | null;
        codigo: string | null;
        cliente_id: number | null;
        areas_lideradas: number[] | null;
        tableros_de_areas: string[] | null;
        clientes: number[] | null;
      };
    };
  };
};
