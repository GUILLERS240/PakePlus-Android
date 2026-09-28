# Incognito

Aplicación móvil de chat anónimo preparada para Capacitor, hecha únicamente con HTML5 + CSS3 + JavaScript vanilla.

## Estructura
- `index.html` — interfaz completa.
- `css/` — tema, onboarding, app y chat.
- `js/` — navegación, onboarding, app, chat, notificaciones, iconos y puente REST de Supabase.
- `supabase/schema.sql` — esquema, RLS y trigger de perfiles.
- `js/supabase-config.js` — único archivo de credenciales que debes configurar.

## Configurar Supabase
1. Crea un proyecto en Supabase.
2. En **Project Settings > API**, copia `Project URL` y la clave `anon/public`.
3. Abre `js/supabase-config.js`.
4. Coloca ambos valores y cambia `enabled:false` por `enabled:true`.
5. Ejecuta `supabase/schema.sql` completo en **SQL Editor**.
6. Para este modelo sin correo, el registro genera internamente un identificador como `usuario@incognito.local`. En Auth, usa el proveedor Email de Supabase y configura la confirmación de email según el flujo que quieras para tu APK.

**Nunca** uses `service_role`/secret keys en `supabase-config.js` ni dentro del APK.

## Probar sin Supabase
Abre `index.html` directamente o usa `npx serve`. El modo demo funciona en memoria.

## Capacitor
El proyecto no depende de frameworks ni CDNs. Puedes copiar la carpeta `incognito` como `www` de un proyecto Capacitor y ejecutar:

```bash
npm install
npx cap add android
npx cap sync
npx cap open android
```

## Funciones visuales incluidas
- Onboarding de 6 slides con swipe.
- Login/registro.
- Descubrimiento aleatorio.
- Apertura directa del chat.
- Identidad Incógnito/amigo.
- Mensajes, respuestas simuladas y estado escribiendo.
- Envío visual de fotos mediante selector del dispositivo.
- Notificaciones internas.
- Solicitudes de amistad.
- Perfil editable, foto, bio y edad.
- Safe areas, responsive móvil y desktop, reduced motion.


## Corrección visual v1.2.0
- Onboarding reconstruido para móvil vertical: cada slide ocupa exactamente el viewport disponible y no usa scroll horizontal para posicionar contenido.
- Swipe táctil real: el slide sigue el dedo, con transición spring al completar o cancelar el gesto.
- Stagger real del icono, título y descripción.
- Shell de hasta 480 px en escritorio, centrado, redondeado y con sombra.
- Safe-area insets aplicados a onboarding, autenticación, app, chat y navegación inferior.
- Overlay de rotación cuando el dispositivo está en landscape.
- Transiciones principales con las curvas cubic-bezier solicitadas.
- Notificación interna dentro del app-shell, 9999, blur, avatar, badge, barra de progreso de 5 s y swipe-up.
- Modo demo configurable desde Ajustes.
- Corregido el selector de fotos del chat (`chat-photo-input`).
- Soporte `prefers-reduced-motion`.
