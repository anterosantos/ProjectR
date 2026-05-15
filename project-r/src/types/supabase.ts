// Re-export from canonical location so both import paths resolve correctly:
//   "@/types/supabase"         (story spec convention)
//   "@/lib/supabase/database.types" (legacy path, used by existing client code)
export type {
  Json,
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from "@/lib/supabase/database.types";
