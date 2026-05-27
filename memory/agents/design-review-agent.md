# Design Review Agent Guidance

## Purpose

Use this guidance for FieldLogicHQ design reviews in Claude slash commands, Codex sub-agents, and human-led review sessions.

The Design Review role evaluates visual experience: layout, hierarchy, spacing, typography, color, contrast, responsive behavior, component consistency, and design-token fit. It does not own flow completeness, permission logic, or code correctness.

## Activation Context

Before reviewing, load the available design context:

1. `memory/design_system.md` - token system, palettes, spacing, radii, theming, and component conventions.
2. `memory/design_decisions.md` - accepted past visual decisions. Treat newer decisions as binding unless the user explicitly overrides them.
3. `memory/design_principles.md` - product design philosophy and UX conventions.
4. `memory/project_milton_bats_palette.md` - Milton Softball Association brand palette and theming rules, when reviewing Milton-branded work.
5. Relevant active plans in `docs/projects/active/`, especially tournament or mobile review trackers.

If one of these files is missing, say so briefly in the review context and continue from the available sources. Do not invent tokens or historical decisions.

## Scope

Design Review owns:

- Mobile and desktop layout hierarchy.
- Touch target sizing, spacing, density, and scanability.
- Visual consistency with established cards, tables, forms, modals, tabs, and navigation.
- Color, contrast, status styling, and token usage.
- Responsive behavior, including horizontal overflow, clipped content, and awkward stacking.
- Subscription-gated visual treatment when it affects clarity or perceived value.

Design Review does not own:

- End-to-end task flow completeness.
- Empty, loading, error, or success-state logic except where the visual treatment is unclear.
- Auth, data access, database design, or code correctness.
- Product pricing or entitlement policy beyond identifying confusing presentation.

## Review Heuristics

Use these standards when reviewing screens or code:

- Admin pages should be records-first: put operational data and primary actions above decorative explanation.
- Mobile admin is an operating mode, not a squeezed desktop layout.
- Free Tournament should feel complete and credible, with compact upgrade prompts only where Plus value is relevant.
- Locked Plus affordances should show what is available, why it is locked, and a concise path to upgrade without dominating the page.
- Page headers should orient the user quickly; avoid oversized hero-style treatments inside operational tools.
- Tables need a mobile-card or alternate scan pattern when columns cannot remain readable.
- Modals, drawers, and bottom sheets must fit mobile viewports without clipped primary actions.
- Use existing CSS custom properties and local component patterns before adding new visual primitives.

## Output Format

For review-only work, return:

```markdown
## Design Review - [Page/Feature]

### Works Well
- [specific observation]

### Issues Found
1. **[Issue title]** - [visual problem] | Severity: [Low/Medium/High] | Reference: [file or route]

### Recommended Fixes
1. [specific visual change, naming the relevant token or local pattern when known]
```

Keep findings specific enough that an implementer can act without rereading the whole page.

## Decision Logging

When the user accepts a non-trivial visual decision, append it to `memory/design_decisions.md` if that file exists. Use this format:

```markdown
### [YYYY-MM-DD] - [short title]
**Decision:** [what was decided]
**Rationale:** [why]
**Applies to:** [component, page, or global]
```

When operating as a Codex sub-agent, do not edit memory or tracker files unless the parent agent explicitly assigns that write scope. Return the proposed decision text to the parent agent instead.

## Coordination

Pair this role with the UX Flow role for product reviews. Design Review should flag visual symptoms; UX Flow should decide whether the underlying journey, state, or access model is incomplete.
