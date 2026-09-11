# ENS English — Revisión lingüística de las 531 Learning Units

## Propósito

Segunda capa de auditoría sobre el snapshot productivo identificado por:

`dc87a91e25e483b82912d1f42fbe397872d353fd6ac4e7613c6f68681cf46279`

Esta revisión no modifica producción. Separa anomalías estructurales de decisiones lingüísticas o pedagógicas que requieren contexto.

## CEFR: clasificación todavía no definitiva

Las 531 Learning Units contienen la nota editorial `cefr_source_pending`.

Por tanto:

- `cefr_target=A1/A2` debe interpretarse hoy como clasificación editorial interna;
- no debe presentarse como clasificación CEFR externamente validada;
- no se deben mover o borrar unidades solo porque una ruta llamada A1 contenga unidades actualmente etiquetadas A2;
- antes de una futura certificación de niveles se necesita una fuente CEFR explícita y versionada.

Dentro de las 265 unidades actualmente usadas por las rutas hay 38 etiquetadas A2. La mayor parte corresponde a dos bloques temáticos completos:

- Direcciones: 11
- Salud: 11

El resto se distribuye entre Descripciones, Lugares, Personas, Acciones y Emociones.

## Casos heurísticos revisados y descartados como errores

### `accepted_forms` que no coincide literalmente con `english`

Se detectaron 11 casos, pero todos son chunks cuyo texto visible termina en `...`, mientras `accepted_forms` conserva correctamente la respuesta sin puntos suspensivos. Ejemplos:

- `I am...` → acepta `I am`
- `I like...` → acepta `I like`
- `Every day...` → acepta `Every day`

Conclusión: no corregir.

### Inglés y español idénticos

Se detectaron 8 casos como `bus`, `chef`, `golf`, `hospital`, `hotel`, `jeans`, `karate` y `taxi`.

Conclusión: préstamos/cognados válidos, no traducciones faltantes.

### Ejemplo que no contiene literalmente la forma base

Dos casos:

- `look after` → `She looks after her little brother.`
- `look for` → `I am looking for my notebook.`

Conclusión: ejemplos correctos con flexión verbal. No corregir.

### `word` con espacios

Tres casos:

- `living room`
- `police officer`
- `traffic light`

Conclusión: son unidades léxicas nominales multi-palabra. Pueden permanecer como `word` si esa es la convención del catálogo; no deben reclasificarse automáticamente como chunks.

## Ambigüedad semántica o de función

17 Learning Units contienen explícitamente `meaning_or_pos_ambiguous`:

- `bank-break` — `break` — descanso
- `bank-left` — `left` — izquierda
- `core-as` — `as` — como
- `core-back` — `back` — atrás o espalda
- `core-be` — `be` — ser o estar
- `core-case` — `case` — caso
- `core-get` — `get` — obtener o llegar
- `core-have` — `have` — tener
- `core-kind` — `kind` — tipo o amable
- `core-like` — `like` — gustar o como
- `core-make` — `make` — hacer o crear
- `core-mean` — `mean` — significar o querer decir
- `core-off` — `off` — apagado o fuera de
- `core-point` — `point` — punto o señalar
- `core-right` — `right` — correcto o derecha
- `core-set` — `set` — conjunto o colocar
- `core-up` — `up` — arriba

Estas unidades no son duplicados. El riesgo aparece cuando una actividad pretende evaluar una sola equivalencia sin aportar contexto suficiente.

## Ambigüedad español → inglés

Tres traducciones españolas coinciden exactamente entre unidades diferentes:

- `each` / `every` → `cada`
- `brown` / `coffee` → `café`
- `another` / `other` → `otro u otra`

Recomendación: no usar el español aislado como único prompt de recall para estos pares. Incorporar contexto, categoría, imagen, oración o una política de respuestas válidas que mantenga la identidad de la Learning Unit.

## Regla pedagógica propuesta

La unidad académica debe seguir siendo la `Learning Unit` identificada por su ID estable. La evaluación debe distinguir entre:

1. evidencia de reconocimiento del significado;
2. evidencia de recuperación de una forma específica;
3. evidencia contextual cuando una forma sea polisémica o comparta traducción con otra unidad.

Un error provocado por una consigna ambigua no debe transformarse en evidencia negativa de dominio.

## Próxima revisión recomendada

Antes de incorporar las 266 unidades de reserva a nuevas rutas:

1. revisar primero las 8 unidades ambiguas que aún no están asignadas a colecciones;
2. mantener las 9 ambiguas ya usadas por rutas sin romper IDs ni historial;
3. añadir contexto a las actividades que las evalúan;
4. resolver el campo `part_of_speech` y/o `sense_key` cuando la identidad semántica lo requiera;
5. conservar `cefr_source_pending` hasta disponer de una fuente CEFR verificable.
