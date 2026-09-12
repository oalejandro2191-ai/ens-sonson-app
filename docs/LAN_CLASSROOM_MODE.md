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

Antes de jornadas importantes o de cualquier mantenimiento, cree un respaldo lógico:

```bash
npm run lan:backup
```

El comando crea dentro de `backups/`:

- un archivo `.dump` con el estado de las tablas académicas e institucionales y las cuentas Auth locales;
- un manifiesto `.json` con fecha, tamaño y SHA-256 para detectar archivos dañados.

La carpeta `backups/` y `.ens-lan-admin.json` están excluidos de Git. Trate ambos como información privada del piloto.

### Restaurar un respaldo

La restauración es destructiva y exige confirmación explícita:

```bash
npm run lan:restore -- backups/ens-lan-classroom-AAAA-MM-DD....dump --confirm-restore
```

Antes de tocar la base, el comando crea automáticamente otro respaldo con la etiqueta `pre-restore`. Después reconstruye el esquema local validado y restaura los datos. También genera un recibo `.restored.json` con la huella del respaldo usado.

El restore solo acepta archivos dentro de la carpeta local `backups/` y solo opera sobre el contenedor `supabase_db_ens-sonson-local`.

> El respaldo cubre el estado de base de datos y Auth local. Los archivos del código y contenidos versionados continúan protegidos por Git. Si en el futuro se almacenan archivos binarios subidos por usuarios en Supabase Storage local, deberá añadirse una copia específica del volumen de objetos antes de considerar esos archivos cubiertos por este mecanismo.

Solo use esto si desea borrar el entorno local y reconstruirlo desde los fixtures, sin restaurar un respaldo:

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
