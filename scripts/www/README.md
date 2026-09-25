# Lumi
Proyecto web puro HTML/CSS/JS para empaquetar con Website 2 APK Builder. Está pensado para Android 8+, navegador de escritorio y una evolución posterior con Cline.

## Estado
- UI completa de chat, sidebar, proyectos, modos, ajustes, onboarding y autenticación.
- IndexedDB + localStorage para funcionamiento local/offline.
- Integración Supabase mediante `js/supabase.js` y una capa local compatible con la API mínima usada por Lumi.
- OpenRouter con streaming SSE, reintentos y fallback.
- RLS y SQL de tablas incluidos en `SUPABASE_SETUP.md`.
- No se incluyen claves reales.

## Importante sobre el SDK
El ZIP contiene `js/supabase.js` como adaptador local de Supabase basado en `fetch`/WebSocket, para que el proyecto no dependa de un CDN durante el uso offline. Si quieres usar el SDK oficial `@supabase/supabase-js`, sustituye ese archivo por la compilación UMD local correspondiente y conserva `js/supabase.js` como capa de la aplicación. La documentación oficial confirma que el cliente de navegador se inicializa con URL + key. urlDocumentación oficial de inicialización de Supabase JShttps://supabase.com/docs/reference/javascript/initializing

## OpenRouter
La configuración usa por defecto `deepseek/deepseek-r1:free`, que OpenRouter identifica como endpoint gratuito; los endpoints gratuitos están sujetos a límites. urlDeepSeek R1 Free en OpenRouterhttps://openrouter.ai/deepseek/deepseek-r1%3Afree

## Inicio rápido
1. Abre `index.html` en un servidor local (recomendado; algunas funciones web requieren HTTPS/localhost).
2. Copia tus credenciales a `js/config.js`.
3. Ejecuta el SQL de `SUPABASE_SETUP.md`.
4. Configura recuperación de contraseña/código en Supabase.
5. Prueba en navegador.
6. Importa el proyecto en Website 2 APK Builder y configura pantalla vertical, almacenamiento/notificaciones según el flujo del Builder.

## Estructura
Consulta `MANUAL.md` para la lista completa y el orden recomendado de configuración (incluye la sección "Novedades de esta actualización": doble proveedor de IA, avatar, ánimo, recordatorios, listas, diario, modo solo escuchar, jerga cubana y planes).
