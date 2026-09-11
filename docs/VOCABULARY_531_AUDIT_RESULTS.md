# ENS English — Auditoría inicial del banco productivo de 531 Learning Units

## Alcance y seguridad

Lectura autorizada y estrictamente de solo lectura del Supabase de producción `pgdoxpcwtqjbmqvzihhs`.

Se consultaron exclusivamente las tablas académicas:

- `vocabulary_words`
- `vocabulary_collections`
- `collection_words`
- `learning_routes`
- `learning_route_collections`
- `learning_lessons`
- `learning_lesson_units`

No se consultaron Auth, estudiantes, correos, documentos ni progreso individual. Para la huella de colecciones y rutas se excluyeron `owner_id` y `school_id`.

## Huella congelada

Snapshot SHA-256 maestro:

`dc87a91e25e483b82912d1f42fbe397872d353fd6ac4e7613c6f68681cf46279`

Huellas por tabla:

| Tabla | Filas | SHA-256 |
| --- | ---: | --- |
| `vocabulary_words` | 531 | `9c23a6dc5afc435982f7ddef883f6c741e367c5bc70a521c4f0ff1e2a37020c7` |
| `vocabulary_collections` | 13 | `9ddeef77fd509c9e27c413b66baa7bb955c017d49f9a4ace78809d100bc82218` |
| `collection_words` | 275 | `5a6f33fe7f519e50488dd8e2c8773484d34ccd1d4f8e9fab9377abb966398fc4` |
| `learning_routes` | 3 | `9e0c79cf9b08252ec6ae74daf9a2e9aacfa1ae47181f597f3010bff018402dde` |
| `learning_route_collections` | 39 | `99164cce2a071cb2246a9d5e2b6bb847ade6ed6fa74941ec53b8483ddab30778` |
| `learning_lessons` | 156 | `c82cb12b0fa9374b7492c5910b546c5d23ce7d51120b8af95c2f8faf053ebcbb` |
| `learning_lesson_units` | 825 | `c0f8e5b758c9e0b80edf70bcd558a765d2d608b41d208af454355d7821cd73dc` |

## Inventario real

- 531 Learning Units.
- 13 colecciones activas y públicas.
- 275 relaciones colección–unidad.
- 3 rutas A1.
- 39 relaciones ruta–colección.
- 156 lecciones.
- 825 relaciones lección–unidad.

Distribución de tipos:

- 482 `word`
- 22 `chunk`
- 13 `phrasal_verb`
- 10 `expression`
- 4 `command`

Distribución CEFR:

- 437 A1
- 94 A2

Dificultad:

- 436 nivel 1
- 95 nivel 2

Estado editorial:

- 531 `catalog_status=verified`
- 531 `editorial_status=approved`

Prioridad pedagógica:

- 133 `core`
- 288 `high`
- 110 `medium`

Fuente:

- 531 `ENS Sonsón local catalog`
- versión `2026-08-08`

## Integridad estructural

No se detectaron:

- duplicados por inglés exacto;
- duplicados por inglés normalizado;
- duplicados por par inglés–español normalizado;
- duplicados de `unit_code`;
- duplicados de `learning_unit_id`;
- colisiones entre `accepted_forms` de unidades distintas;
- relaciones huérfanas en colecciones, rutas, lecciones o unidades de lección;
- posiciones duplicadas dentro de una misma colección o lección;
- discrepancias entre `unit_count` de las lecciones y sus unidades reales;
- discrepancias entre `lesson_count` de las rutas y sus lecciones reales.

## Organización pedagógica actual

- 265 Learning Units distintas están actualmente dentro de las colecciones/rutas.
- 266 Learning Units están en el banco pero fuera de toda colección y lección actual.
- Las 13 colecciones suman 275 posiciones porque 10 Learning Units se reutilizan en dos colecciones diferentes.
- Cada ruta tiene 13 colecciones, 52 lecciones, 275 posiciones de unidad y 265 Learning Units distintas.
- `A1-V1` está archivada.
- `A1-V2` y `A1-V3` están publicadas.
- Umbral de dominio de las tres rutas: `0.800`.

Las 10 unidades reutilizadas entre colecciones son:

- `exercise`: Body / Sports
- `home`: Home / Places
- `play`: Daily Routines / Sports
- `study`: Daily Routines / School
- `family`: Family / Personal Information
- `friend`: Personal Information / School
- `read`: Daily Routines / School
- `run`: Daily Routines / Sports
- `school`: Places / School
- `teacher`: Personal Information / School

Esto es reutilización temática, no duplicación del catálogo.

## Reserva fuera de las rutas actuales

Las 266 unidades no asignadas a colecciones se distribuyen así:

- 245 palabras
- 11 phrasal verbs
- 7 expresiones
- 2 chunks
- 1 comando

CEFR de esa reserva:

- 210 A1
- 56 A2

Incluye bloques completos o parciales de gramática, acciones, tiempo, colores, transporte, profesiones, animales, números, compras, comunicación, phrasal verbs y otros contenidos. Por tanto, este grupo debe auditarse como la primera reserva para expansión; no debe tratarse como contenido descartable.

## Brechas editoriales

Campos completos en las 531:

- traducción al español;
- ejemplo en inglés;
- ejemplo en español;
- `visual_hint`;
- `accepted_forms`;
- `topics`;
- `linguistic_category`;
- `pedagogical_review_notes`.

Brechas detectadas:

- 511 sin pronunciación textual;
- 531 sin `audio_path`;
- 531 sin `image_path`;
- 531 sin `part_of_speech`;
- 531 sin `grammatical_role`;
- 531 sin `sense_key`;
- 531 sin `curriculum_block`;
- 531 sin `curriculum_position`;
- 531 sin relaciones explícitas en `related_learning_unit_ids`;
- 232 sin `grammar_tags`.

Estos vacíos no invalidan las unidades existentes; son oportunidades de enriquecimiento editorial progresivo.

## Riesgo de ambigüedad español → inglés

Se detectaron tres traducciones españolas idénticas en Learning Units diferentes:

1. `each` / `every` → `cada`
2. `brown` / `coffee` → `café`
3. `another` / `other` → `otro u otra`

No son duplicados del catálogo. Sin embargo, un ejercicio de recuperación que muestre únicamente la traducción española puede resultar ambiguo. Debe resolverse mediante contexto, pista semántica o una política explícita de respuestas válidas antes de usar esos pares en recall español→inglés.

Estado actual de estos casos:

- `coffee` ya está en `collection-food`.
- `brown`, `each`, `every`, `another` y `other` permanecen fuera de las colecciones actuales.

## Decisión de trabajo

1. No borrar, renombrar IDs ni reidentificar ninguna de las 531 unidades existentes.
2. Tratar las 265 unidades actualmente usadas por rutas como núcleo estable.
3. Auditar primero las 266 unidades no asignadas antes de crear vocabulario nuevo.
4. Resolver las tres ambigüedades de prompt antes de incorporarlas a recall sin contexto.
5. Enriquecer campos editoriales faltantes sin romper referencias ni evidencia histórica.
6. Expandir hacia ENS English 1K por lotes pequeños, revisables y con nueva huella SHA-256 en cada versión.
7. Nunca derivar dominio, XP o progreso académico a partir de esta auditoría editorial.

## Estado de producción

Esta auditoría no realizó escrituras, DDL, cambios de Auth, cambios de usuarios ni modificaciones a las rutas o al catálogo productivo.
