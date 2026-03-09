# Code Quality Corpus — The Ceremony

*Actionable reference for grading code derived from the designs.*
*Organized by domain. Each file is independently consultable.*

---

## Keeper Dispatch

`KEEPER-DISPATCH-v1.md` — the initialization prompt for the Keeper agent. Versioned. Paste as first message when starting a Keeper build session. Track efficacy: if the Keeper drifts, tighten constraints and increment version.

## Files in This Corpus

| File | Domain | Purpose |
|------|--------|---------|
| `01-examples-analysis.md` | Competitive landscape | 5+ real platforms analyzed: what they built, what worked, what failed |
| `02-architecture-patterns.md` | Technical patterns | Real-time, state management, AI context assembly — with code patterns |
| `03-beauty-standards.md` | Aesthetic & UX | What beauty means for this specific project — derived from model analysis |
| `04-keeper-engineering.md` | AI integration | Prompt architecture, caching, token economy — Claude API specifics |
| `05-code-principles.md` | Code quality | Actionable rules for grading every file written |
| `06-api-features-audit.md` | API calibration | Every Claude API feature categorized for the Keeper's use |

## How to Use

When writing or reviewing code for The Ceremony:
1. Check `05-code-principles.md` for every PR
2. Check the relevant domain file for architectural decisions
3. Check `03-beauty-standards.md` when touching UI
4. Check `04-keeper-engineering.md` when touching AI integration

The corpus is a living reference. Update it when patterns prove wrong.
