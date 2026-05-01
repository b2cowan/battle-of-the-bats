# Playoff Wizard & Bracket Builder Specification

This document outlines the intended functionality and technical architecture of the Playoff Wizard and its custom Bracket Builder component.

## 1. Objective
The Playoff Wizard is designed to automate the creation of complex playoff structures while allowing administrators to manually refine the resulting matches before saving them to the database.

## 2. Configuration Modes
The wizard supports three primary crossover/seeding strategies:

### A. Standard Crossover (2 Pools Only)
- **Logic**: Typically cross-seeds the top teams (e.g., 1st Pool A vs. 2nd Pool B).
- **Automation**: Pre-populates matchups with standard seed placeholders (e.g., "1st Pool A", "2nd Pool B").
- **UI**: A single, unified bracket canvas.

### B. Top vs. Bottom Reseed (Global)
- **Logic**: Seeds all teams in the division into a single global ranking.
- **Automation**: Pre-populates with global seed placeholders (e.g., "Seed #1", "Seed #8").
- **UI**: A single, unified bracket canvas.

### C. No Crossover (Split Pool Championship)
- **Logic**: Each pool operates as its own independent tournament.
- **Independent Config**: Users can set different qualifying team counts per pool (e.g., Pool A has 8 teams/QF, Pool B has 4 teams/SF).
- **UI**: **Sectional Layout**. The builder must render distinct, vertically stacked brackets for each pool, each with its own header (e.g., "Pool Gold Playoffs").
- **Consistency**: Matchup codes within these split brackets should be simple (e.g., `SF1`, `FIN`) rather than prefixed, as they are visually and logically separated by their pool section.

## 3. Workflow
1.  **Configure**: Admin selects the crossover mode and qualifying team counts.
2.  **Generate**: Admin clicks **"Configure Brackets"**. This triggers the `generatePreview` function which builds the `templatePreview` array.
3.  **Refine**: The `BracketBuilder` renders the template. Admin can:
    - Drag and drop matchups to reorder rounds.
    - Change team placeholders or resolved team names.
    - Assign dates, times, and diamonds.
4.  **Save**: Admin clicks **"Save Playoff Games"**. This converts the builder state into `Game` records in the database with `isPlayoff: true`.

## 4. Technical Architecture
- **State Source**: `templatePreview` is the master array of objects passed from the Wizard to the Builder.
- **Metadata**: Every matchup object in the builder **MUST** preserve a `pool` property. This property is used to group matches into the sectional layout in "No Crossover" mode.
- **Deduplication**: When rendering dropdowns, the builder must de-duplicate options (especially `Winner SF1` labels) to prevent React key collisions when multiple pools use identical codes.
- **Composite Keys**: When finding existing games during regeneration, use `code + pool` as a composite key to ensure settings are preserved for the correct game in the correct pool.

## 5. UI Requirements (Aesthetics)
- **Split Mode**: Must use the `poolSection` and `poolHeader` CSS classes to create clear visual separation.
- **Responsiveness**: The builder uses a horizontal `canvas` layout for rounds (columns). In split mode, each pool gets its own canvas.
- **Micro-interactions**: Use `SortableContext` for smooth drag-and-drop and the `Trophy` icon for pool headers.
