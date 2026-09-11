# ENS English — protocol for auditing the existing 531 Learning Units

## Purpose

Audit the authoritative vocabulary corpus **without modifying or querying production while the production-freeze rule is active**, and establish a reproducible baseline before any expansion toward ENS English 1K.

This protocol is intentionally data-source neutral: it can be executed against a local Docker restore, a non-production export, or an authorized isolated copy.

## Known historical baseline — evidence only

Historical technical audit evidence reports:

- 531 Learning Units total;
- 482 `word`;
- 22 `chunk`;
- 13 `phrasal_verb`;
- 10 `expression`;
- 4 `command`;
- 13 collections;
- approximately 275 A1 assignments organized into approximately 52 lessons;
- approximately 266 additional units in the vocabulary bank outside that A1 assignment set.

These figures are **acceptance expectations**, not a replacement for the actual row-level corpus.

## Required non-production export

### A. Canonical vocabulary rows

Export one row per canonical `vocabulary_words` record, including every field that exists in the source schema and at minimum:

- `id`;
- `learning_unit_id`;
- `unit_code`;
- `english`;
- `spanish`;
- `unit_type`;
- `accepted_forms`;
- `category` or equivalent thematic metadata;
- `difficulty`;
- `example_en`;
- `example_es`;
- `priority`;
- `status` if present;
- `archived_at` if present;
- `audio_path` if present.

Do not omit source columns merely because the current Staging schema does not use them yet. Preserve unknown metadata for forensic comparison.

### B. Collection relationships

Export the non-personal relationships needed to reconstruct the 13-collection organization, including:

- collection stable identifier;
- collection title/code/status/level if present;
- Learning Unit identifier;
- explicit position/order;
- relationship status if present.

### C. Route / lesson relationships

Export the non-personal rows needed to reconstruct A1 versions and their assignments, including:

- route stable identifier/code/version/status;
- lesson stable identifier;
- lesson position/order;
- collection reference if present;
- Learning Unit identifier;
- Learning Unit position inside the lesson.

### D. Reference-safety aggregates

A content audit does **not** require raw student attempts or personal student progress.

When needed to decide whether a Learning Unit can ever be physically deleted, export only aggregate reference counts per Learning Unit, for example:

- lesson assignment references;
- practice-attempt references;
- student-progress references;
- other foreign-key/reference counts discovered in the schema.

No names, emails, student codes, auth identities, roster fields or individual progress rows are required for this vocabulary audit.

## Import boundary

The export must first be loaded into an isolated non-production context.

Allowed initial destinations:

- local Docker PostgreSQL / Supabase CLI; or
- the dedicated Staging project only after the import path has been validated locally.

Never overwrite the six existing Staging fixture Learning Units blindly. Use a separate controlled import/restore procedure with count checks, preview and rollback.

## Audit checks

### 1. Exact baseline counts

Verify actual counts by:

- total Learning Units;
- `unit_type`;
- status;
- category;
- collection;
- route;
- lesson;
- assigned vs unassigned units.

Any difference from the historical 531 / 482 / 22 / 13 / 10 / 4 figures must be reported, not silently corrected.

### 2. Stable identifier integrity

Check:

- duplicate `id` — impossible/critical if present;
- duplicate or missing `learning_unit_id`;
- duplicate or missing `unit_code`;
- conflicting rows sharing a supposedly stable identifier;
- identifier changes between relationships and canonical rows.

### 3. Normalized English collisions

Create a review key without changing stored source text, using at least:

- trim outer whitespace;
- Unicode normalization;
- lower/case-fold comparison;
- collapse repeated internal spaces;
- normalize typographic apostrophes for comparison only.

Flag, do not auto-merge:

- exact normalized duplicates;
- singular/plural pairs that may be intentional;
- capitalization-only variants;
- spelling variants;
- word vs chunk collisions;
- base verb vs phrasal-verb/expression relationships.

### 4. Spanish translation quality

Flag:

- empty translation;
- whitespace-only translation;
- obvious placeholder values;
- same English/Spanish value where suspicious;
- conflicting translations for normalized English duplicates;
- translations that change part of speech or intended meaning;
- inconsistent regional variants that should become accepted alternatives rather than duplicate Learning Units.

No translation should be rewritten automatically during the audit.

### 5. Accepted forms

Check:

- malformed JSON/array values;
- empty forms when the unit requires variants;
- duplicate accepted forms after normalization;
- accepted form identical to the canonical value;
- forms that belong to another semantic meaning;
- contractions/apostrophes;
- capitalization and punctuation behavior;
- phrase/chunk answer variants.

### 6. Unit type integrity

Expected historical types:

- `word`;
- `chunk`;
- `phrasal_verb`;
- `expression`;
- `command`.

Flag unknown values and semantically questionable classifications. Do not recast types automatically because changing type can alter pedagogy and answer validation.

### 7. Metadata quality

Audit:

- category consistency;
- difficulty range and missing values;
- priority range and duplicates where order matters;
- example quality and language alignment;
- audio-path presence/absence;
- archival/status consistency;
- obvious placeholders or test markers.

### 8. Collection integrity

Verify:

- exactly which collections exist;
- stable collection identifiers;
- explicit ordering;
- duplicate collection–unit relationships;
- orphan collection relationships;
- units assigned to multiple collections intentionally vs accidentally;
- collection totals.

Historical collection totals for the 275-unit A1 working set can be used as comparison evidence but must be recomputed from the export.

### 9. A1 route integrity

For every retained A1 version:

- route status/version;
- lesson count;
- assignment count;
- distinct Learning Unit count;
- duplicate lesson–unit relations;
- empty lessons;
- ordering gaps/duplicates;
- units assigned to different lessons between versions;
- collection changes;
- orphan route/lesson references.

A1-V1/V2/V3 must remain distinguishable. Do not overwrite one version with another during audit.

### 10. Destructive-action safety

Classify each Learning Unit as:

- safe candidate for physical deletion only if truly unused and unreferenced;
- archive-only because it has history/references;
- active and valid;
- duplicate candidate requiring human decision;
- metadata correction candidate;
- pedagogical review candidate.

No physical deletion is part of this audit.

## Required outputs

Produce all of the following before expansion:

1. immutable raw export copy;
2. SHA-256 fingerprint of the raw export package;
3. normalized audit working copy;
4. exact count report;
5. duplicate-candidate report;
6. identifier-conflict report;
7. translation/accepted-form quality report;
8. collection integrity report;
9. A1 version comparison report;
10. orphan/reference-risk report;
11. proposed corrections separated from raw source;
12. reviewed canonical baseline fingerprint after approved corrections.

## Gate for 531 -> 1000

Do not begin bulk expansion until:

- the actual 531-row source has been obtained in non-production;
- exact counts are reproducible;
- duplicate candidates are reviewed;
- stable IDs are trusted;
- relationship integrity is understood;
- A1 versions are preserved;
- the baseline has a stored fingerprint;
- corrections, if any, are versioned and reversible.

Expansion should then happen in small reviewable batches, with duplicate checks against the certified baseline before each insert.

## Explicit exclusions

This protocol does not authorize:

- production writes;
- production reads while the current freeze remains active;
- import of real students or roster data;
- copying individual student attempts/progress;
- bulk deletion;
- automatic merging of duplicate candidates;
- generation of hundreds of audio files;
- adding the remaining units before the baseline audit is certified.
