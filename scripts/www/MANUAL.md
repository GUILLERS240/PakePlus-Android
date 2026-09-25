# Manual de configuración de Lumi

## 1. Supabase
1. Crea un proyecto.
2. Ejecuta el SQL de `SUPABASE_SETUP.md`.
3. Copia Project URL y anon/publishable key en `js/config.js`.
4. Activa confirmación de correo si la quieres para producción.
5. Configura SMTP/Email Templates para recuperación.

## 2. OpenRouter
Crea una clave y pégala en `js/config.js` como `OPENROUTER_API_KEY`. No uses una clave de servidor con privilegios. Una app cliente expone la clave, por lo que para producción se recomienda mover la llamada a un backend/edge function; este proyecto mantiene la integración directa porque fue solicitada para Website 2 APK Builder.

## 3. Código secreto
El código es de 8 dígitos. Se valida primero localmente cuando existe una copia hash y después contra Supabase para operaciones sensibles. La recuperación requiere correo de recuperación y genera un nuevo código.

## 4. Cuenta
Registro: correo + contraseña. Logout mantiene la cuenta. El borrado de cuenta solicita confirmación y elimina datos dependientes mediante cascadas/policies.

## 5. Offline
IndexedDB guarda conversaciones/mensajes recientes. Sin internet se pueden consultar chats locales y enviar mensajes a la cola. Al reconectar se sincronizan.

## 6. Website 2 APK Builder
- Orientación: vertical.
- Mínimo Android: 8+.
- JavaScript y almacenamiento web: habilitados.
- Internet: habilitado.
- Notificaciones/almacenamiento: concede los permisos cuando el Builder los solicite.
- No uses un visor que bloquee WebSocket/fetch.

## 7. Prueba
1. Registro.
2. Onboarding.
3. Crear proyecto.
4. Enviar un mensaje con conexión.
5. Desconectar y comprobar historial local.
6. Reconectar y comprobar sincronización.
7. Probar código secreto y recuperación.
8. Probar los tres modos.

## 8. Cline
Abre la carpeta raíz y pídele cambios por archivo. La arquitectura está separada para que Cline pueda modificar módulos sin tocar el HTML principal salvo cuando se necesiten nuevas pantallas/template.

## 9. Novedades de esta actualización
- **Doble proveedor de IA**: OpenRouter (modelos gratuitos, con lista de respaldo) y PlataformIA (spark/radiance/supernova) como respaldo secundario. Orden configurable en `LUMI_CONFIG.AI_PROVIDER_ORDER` (`js/config.js`).
- **Avatar animado**: aparece solo mientras Lumi procesa/responde, 9 expresiones dibujadas en CSS puro (`css/avatar.css`, lógica en `js/avatar.js`), no interactivo.
- **Ánimo diario y celos sutiles**: `js/avatar.js`. Se reinicia cada día, influido por el tono de la conversación; el usuario puede animarla.
- **Recordatorios**: di "recuérdame X a las Y" (`js/reminders.js`, tabla `reminders`).
- **Listas**: di "crea una lista de compras: leche, pan" o "añade X a mi lista de Y" (`js/lists.js`, tabla `lists`). Se pueden consultar desde Ajustes → Datos → «Mis listas».
- **Diario privado de Lumi**: se escribe solo, una vez al día, y nunca se muestra en la interfaz (`js/diary.js`, tabla `lumi_diary`).
- **Modo Solo Escuchar**: se activa/desactiva desde Ajustes (respuestas de 1-3 palabras o un emoji durante un tiempo).
- **Jerga cubana**: interruptor en Ajustes.
- **Plan Gratis/Pro**: límite de tokens diarios configurable desde Supabase (`settings.extra.daily_token_limit`), sin anuncios, solo aviso interno al acercarse al límite (`js/monetization.js`).
- **Código secreto**: tras 5 fallos consecutivos se bloquea y se pide recuperación por correo (`js/security.js`).
- Ejecuta el SQL actualizado de `SUPABASE_SETUP.md` (incluye bloque "si ya tenías las tablas" para no perder datos).
