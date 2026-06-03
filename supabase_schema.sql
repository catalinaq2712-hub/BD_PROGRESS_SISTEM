-- Script de Migración y Políticas de Seguridad RLS en Supabase
-- Incluye la funcionalidad de compartir documentos entre usuarios
-- Ejecuta este script en el SQL Editor de tu consola de Supabase (https://supabase.com)

-- 1. Eliminar tablas existentes para garantizar una recreación limpia
DROP TABLE IF EXISTS public.compartidos CASCADE;
DROP TABLE IF EXISTS public.papelera CASCADE;
DROP TABLE IF EXISTS public.documentos CASCADE;
DROP TABLE IF EXISTS public.perfiles CASCADE;
DROP TABLE IF EXISTS public.logs_actividad CASCADE;

-- 2. Crear tabla 'perfiles' (enlazada a los usuarios de Supabase Auth)
CREATE TABLE public.perfiles (
  id uuid NOT NULL,
  nombres text NULL,
  apellidos text NULL,
  tipo_uso text NULL,
  rol text NULL DEFAULT 'usuario'::text,
  estado text NULL DEFAULT 'activo'::text,
  foto_url text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT perfiles_pkey PRIMARY KEY (id),
  CONSTRAINT perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT perfiles_rol_check CHECK (rol IN ('usuario', 'premium', 'admin')),
  CONSTRAINT perfiles_estado_check CHECK (estado IN ('activo', 'suspendido'))
) TABLESPACE pg_default;

-- 3. Crear tabla 'documentos' (con FK a auth.users corregida y ON DELETE CASCADE)
CREATE TABLE public.documentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  nombre text NOT NULL,
  acceso text NULL DEFAULT 'Personal'::text,
  fecha_mod timestamp with time zone NULL DEFAULT now(),
  created_at timestamp with time zone NULL DEFAULT now(),
  contenido jsonb NULL,
  CONSTRAINT documentos_pkey PRIMARY KEY (id),
  CONSTRAINT documentos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 4. Crear tabla 'papelera'
CREATE TABLE public.papelera (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  nombre text NOT NULL,
  acceso text NULL,
  fecha_eliminacion timestamp with time zone NULL DEFAULT now(),
  created_at timestamp with time zone NULL DEFAULT now(),
  contenido jsonb NULL,
  CONSTRAINT papelera_pkey PRIMARY KEY (id),
  CONSTRAINT papelera_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 5. Crear tabla de relaciones para documentos compartidos (compartidos)
CREATE TABLE public.compartidos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL,
  usuario_compartido_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT compartidos_pkey PRIMARY KEY (id),
  CONSTRAINT compartidos_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES public.documentos (id) ON DELETE CASCADE,
  CONSTRAINT compartidos_usuario_compartido_fkey FOREIGN KEY (usuario_compartido_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT compartidos_doc_user_unique UNIQUE (documento_id, usuario_compartido_id)
) TABLESPACE pg_default;

-- 5b. Crear tabla de logs de actividad global
CREATE TABLE public.logs_actividad (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NULL,
  usuario_email text NULL,
  accion text NOT NULL,
  detalles jsonb NULL,
  ip_address text NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT logs_actividad_pkey PRIMARY KEY (id),
  CONSTRAINT logs_actividad_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- 6. Habilitar Seguridad a Nivel de Fila (RLS) en todas las tablas
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papelera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compartidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_actividad ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para 'perfiles' (permitir lectura a usuarios autenticados para poder compartir)
CREATE POLICY "Los usuarios autenticados pueden ver todos los perfiles" 
ON public.perfiles FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios pueden insertar su propio perfil" 
ON public.perfiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil" 
ON public.perfiles FOR UPDATE 
USING (auth.uid() = id);

-- 8. Políticas RLS para 'documentos' (permitir ver si es propio o si está compartido)
CREATE POLICY "Los usuarios pueden ver sus documentos o los compartidos con ellos" 
ON public.documentos FOR SELECT 
USING (
  auth.uid() = usuario_id 
  OR id IN (
    SELECT documento_id FROM public.compartidos
    WHERE usuario_compartido_id = auth.uid()
  )
);

CREATE POLICY "Los usuarios pueden crear sus propios documentos" 
ON public.documentos FOR INSERT 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Los usuarios pueden actualizar sus propios documentos" 
ON public.documentos FOR UPDATE 
USING (auth.uid() = usuario_id);

CREATE POLICY "Los usuarios pueden borrar sus propios documentos" 
ON public.documentos FOR DELETE 
USING (auth.uid() = usuario_id);

-- 9. Políticas RLS para 'papelera'
CREATE POLICY "Los usuarios pueden ver sus propios elementos en la papelera" 
ON public.papelera FOR SELECT 
USING (auth.uid() = usuario_id);

CREATE POLICY "Los usuarios pueden agregar elementos a su papelera" 
ON public.papelera FOR INSERT 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Los usuarios pueden restaurar/borrar elementos de su papelera" 
ON public.papelera FOR DELETE 
USING (auth.uid() = usuario_id);

-- 10. Políticas RLS para la tabla 'compartidos'
CREATE POLICY "Permitir crear compartidos si eres el dueño del documento"
ON public.compartidos FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documentos
    WHERE id = documento_id AND usuario_id = auth.uid()
  )
);

CREATE POLICY "Permitir eliminar compartidos si eres el dueño del documento"
ON public.compartidos FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.documentos
    WHERE id = documento_id AND usuario_id = auth.uid()
  )
);

CREATE POLICY "Permitir ver compartidos a todos los autenticados"
ON public.compartidos FOR SELECT
USING (
  auth.role() = 'authenticated'
);

-- 10b. Políticas RLS para la tabla 'logs_actividad'
CREATE POLICY "Permitir crear logs a usuarios autenticados"
ON public.logs_actividad FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
);

CREATE POLICY "Permitir ver logs únicamente a administradores"
ON public.logs_actividad FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE perfiles.id = auth.uid() AND perfiles.rol = 'admin'
  )
);

-- 11. Trigger y automatización para crear perfiles desde auth.users automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombres, apellidos, tipo_uso, rol, estado, foto_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nombres', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'apellidos', ''),
    COALESCE(new.raw_user_meta_data->>'tipo_uso', 'Personal'),
    COALESCE(new.raw_user_meta_data->>'rol', 'usuario'),
    'activo',
    COALESCE(new.raw_user_meta_data->>'foto_url', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. Sincronizar usuarios existentes de Auth a Perfiles
INSERT INTO public.perfiles (id, nombres, apellidos, tipo_uso, rol, estado)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'nombres', split_part(email, '@', 1)) as nombres,
  COALESCE(raw_user_meta_data->>'apellidos', '') as apellidos,
  COALESCE(raw_user_meta_data->>'tipo_uso', 'Desarrollo') as tipo_uso,
  COALESCE(raw_user_meta_data->>'rol', 'usuario') as rol,
  'activo' as estado
FROM auth.users
ON CONFLICT (id) DO NOTHING;
