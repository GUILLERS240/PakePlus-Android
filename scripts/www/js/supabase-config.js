/*
  ÚNICO ARCHIVO QUE NECESITAS CONFIGURAR.
  1. Crea tu proyecto en Supabase.
  2. Ve a Project Settings > API.
  3. Copia Project URL y la clave anon/public.
  4. Pégalos abajo y cambia enabled a true.
  5. Ejecuta supabase/schema.sql una sola vez en SQL Editor.

  IMPORTANTE: NUNCA pongas aquí service_role/secret keys.
*/
window.SUPABASE_CONFIG={
  enabled:false,
  url:'https://TU-PROYECTO.supabase.co',
  anonKey:'TU_ANON_PUBLIC_KEY'
};
