-- Crear tabla de listas de compras
CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL, -- 'active' o 'completed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Crear tabla de artículos de compras
CREATE TABLE IF NOT EXISTS public.shopping_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID REFERENCES public.shopping_lists(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1 NOT NULL,
  estimated_unit_price NUMERIC DEFAULT 0 NOT NULL,
  actual_unit_price NUMERIC,
  is_completed BOOLEAN DEFAULT FALSE NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

-- Otorgar permisos de API de Supabase
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopping_lists TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopping_lists TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopping_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopping_items TO authenticated;

-- Crear políticas de seguridad para listas de compras
CREATE POLICY "Users can view their own shopping lists" ON public.shopping_lists
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shopping lists" ON public.shopping_lists
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shopping lists" ON public.shopping_lists
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shopping lists" ON public.shopping_lists
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Crear políticas de seguridad para artículos de compras
CREATE POLICY "Users can view their own shopping items" ON public.shopping_items
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shopping items" ON public.shopping_items
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shopping items" ON public.shopping_items
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shopping items" ON public.shopping_items
FOR DELETE TO authenticated USING (auth.uid() = user_id);