# ENS English · modo aula LAN (sin Internet)

Este modo usa el computador del docente como servidor local. Los estudiantes se conectan al mismo hotspot/router y abren una dirección como `http://192.168.1.20:3000/estudiante`.

## Qué funciona sin Internet

- Interfaz de estudiante y administrador.
- Supabase local: Auth, base de datos, RPC, progreso, grupos y vocabulario.
- Lecciones y persistencia mientras todos permanezcan conectados a la misma red local.
- Creación de estudiantes desde el portal administrativo local.

No depende del Supabase de Internet ni de Vercel durante la clase.

## Preparación previa (hacer en casa una vez)

Instale y deje disponibles antes de ir al aula:

1. Node.js 22.
2. Docker Desktop.
3. Supabase CLI 2.115.0.
4. Dependencias del proyecto con `npm ci`.
5. Las imágenes Docker de Supabase (el primer `supabase start` puede descargarlas).

Luego ejecute:

```bash
npm run lan:prepare
```

La preparación crea la base local, un administrador local y un archivo privado `.ens-lan-admin.json`. No comparta ese archivo.

## En el aula

1. Encienda el hotspot/router local.
2. Conecte el computador del docente a esa red.
3. Conecte los celulares/tabletas de los estudiantes a la misma red.
4. En el proyecto ejecute:

```bash
npm run lan:start
```

El terminal mostrará la URL de estudiante y la URL de administrador.

Ejemplo:

```text
Student URL: http://192.168.1.20:3000/estudiante
Admin URL:   http://192.168.1.20:3000/admin
```

## Muy importante: no perder el progreso

`lan:start` **no reinicia la base de datos**. El progreso se conserva en los volúmenes Docker del computador.

Solo use esto si desea borrar el entorno local y reconstruirlo:

```bash
npm run lan:reset
```

## Elegir manualmente la IP

Si el computador tiene varias interfaces de red:

macOS/Linux:

```bash
ENS_LAN_IP=192.168.1.20 npm run lan:start
```

PowerShell:

```powershell
$env:ENS_LAN_IP="192.168.1.20"; npm run lan:start
```

## Seguridad

Este modo es para una red local privada y controlada del aula. No abra ni redirija al Internet público los puertos 3000 o 54321. El stack local de Supabase está pensado para desarrollo y redes confiables, no como servidor público.

Si los estudiantes no pueden abrir la URL, revise primero:

- que todos estén en la misma red;
- que el hotspot no tenga activado "aislamiento de clientes";
- que el firewall del computador permita Node.js/Docker en red local;
- que los puertos 3000 y 54321 no estén bloqueados.
