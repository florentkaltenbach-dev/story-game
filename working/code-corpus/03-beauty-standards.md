# Beauty Standards — The Ceremony

*What beauty means for this specific project. Not generic UI guidelines — standards derived from the project's identity and purpose.*

---

## The Premise

The Ceremony is a ritual. The interface is the ritual space. Everything visible on screen is part of the ceremony — every pixel participates in the fiction or gets out of the way. The interface must feel like a surface you look *through*, not a tool you look *at*.

---

## 1. The Dark Palette (already established)

The current palette is correct. Do not change it without strong reason.

```
background:    #0a0e17    — the void, the deep ocean, the Antarctic night
surface:       #131a2b    — elevation level 1, cards and panels
surface-light: #1c2640    — elevation level 2, inputs and interactive elements
accent:        #c4a35a    — gold, warmth, the MC's voice, the human element
ice:           #7ba4c7    — cold blue, the players, the expedition
keeper:        #6b9e7a    — green, the AI, something alive but not human
danger:        #8b3a3a    — muted red, for warnings and cost
border:        #1e2d44    — barely visible structure
muted:         #8b9bb4    — secondary text, timestamps, metadata
foreground:    #e8dcc8    — warm off-white, primary text (NOT pure white)
```

### Depth Rules

In dark interfaces, depth is created by **lightening surfaces**, not by adding shadows. Higher elevation = lighter.

| Depth Level | Color | Use |
|-------------|-------|-----|
| 0 (background) | `#0a0e17` | Page background, the void |
| 1 (surface) | `#131a2b` | Cards, panels, sidebars |
| 2 (elevated) | `#1c2640` | Inputs, buttons, interactive elements |
| 3 (floating) | `#243052` | Tooltips, dropdowns, modals (use sparingly) |

**Never use pure black (`#000000`).** Never use pure white (`#ffffff`). The palette is warm and organic — it should feel like firelight, not a terminal.

### Contrast Requirements

- Primary text on background: `#e8dcc8` on `#0a0e17` = 11.2:1 (exceeds WCAG AAA)
- Muted text on background: `#8b9bb4` on `#0a0e17` = 5.8:1 (exceeds WCAG AA)
- Accent on surface: `#c4a35a` on `#131a2b` = 5.1:1 (passes WCAG AA)
- Keeper green on surface: `#6b9e7a` on `#131a2b` = 4.6:1 (passes WCAG AA)

---

## 2. Typography

### The Dual Font System

The app uses two registers:
1. **Narrative text** (Crimson / Georgia / serif): story content, journal entries, Keeper responses, MC narration. This is the ceremony's voice.
2. **Interface text** (Geist / system sans-serif): labels, buttons, timestamps, metadata. This is the frame around the voice.

**Rules:**
- Story content is ALWAYS in narrative font. No exceptions.
- Interface chrome is ALWAYS in sans-serif. No exceptions.
- Never mix the two within a single element.
- Narrative text gets generous line-height (1.8-2.0). This is not a chat app — it's a story being told. White space is breath.
- Interface text is tight (1.2-1.4). It's functional and shouldn't draw attention.

### Text Sizing Hierarchy

| Element | Size | Weight | Font |
|---------|------|--------|------|
| Scene title | 18px (text-lg) | Semibold | Narrative |
| MC narration | 15px | Normal | Narrative |
| Keeper response | 14px (text-sm) | Normal, italic | Narrative |
| Player message | 14px (text-sm) | Normal | Sans |
| Player name | 12px (text-xs) | Medium | Sans |
| Role labels | 10px | Normal, tracking-widest, uppercase | Sans |
| Timestamps | 10px | Normal | Sans |
| System dividers | 12px (text-xs) | Normal, italic | Sans |

### The Narrative Flow

MC narration should feel like reading a book. The left border treatment (already implemented) is correct — it creates a margin, like the gutter of an open page. The text should breathe:

```css
.narrative-text {
  font-family: var(--font-narrative), Georgia, 'Times New Roman', serif;
  line-height: 1.8;
  letter-spacing: 0.01em;
}
```

**Do not compress narrative text.** If the story log feels cramped, the solution is fewer elements on screen, not smaller text.

---

## 3. Message Differentiation

Each role has a distinct visual signature. The current implementation is correct. Preserve these patterns:

| Role | Visual Signature | Rationale |
|------|-----------------|-----------|
| **MC (Narrator)** | Left border in accent gold, subtle gold background tint, uppercase label "THE NARRATOR" | The MC is the human voice. Gold = warmth, authority, the campfire. |
| **Keeper** | Left border in keeper green, subtle green tint, italic text, uppercase label "THE KEEPER" | The Keeper is the AI presence. Green = alive but not human. Italic = a different register of speech. |
| **Player** | No border, ice-blue name, plain text | Players are the most natural voice. Least decoration. Their words speak for themselves. |
| **System** | Centered, horizontal rules on both sides, muted italic | System messages are infrastructure. They divide, they don't narrate. |

**The Keeper's italic is load-bearing.** It signals that this voice is different from the MC's narration and from the players' actions. Don't remove it.

---

## 4. Animation and Motion

### Principle: Atmosphere, not decoration

Animations should feel like the world breathing, not like UI reacting. The current `animate-ping` on the session status dot is correct — it's a slow pulse, like a heartbeat.

**Allowed animations:**
- Pulse on status indicators (slow, ~2s cycle)
- Fade-in on new messages (150ms, ease-out)
- Smooth scroll to latest message
- Scene transitions (subtle opacity shift, 300ms)

**Forbidden animations:**
- Slide-in from sides
- Bounce effects
- Skeleton loaders (use a quiet "..." or nothing)
- Loading spinners (if the Keeper is thinking, say so in text: *"The Keeper considers..."*)
- Hover effects that move elements

**The Keeper's response should appear like something emerging from silence — a fade, not a pop.**

---

## 5. Layout Principles

### The Story Takes Center Stage

The story log is the largest element. Everything else serves it.

```
┌──────────────────────────────────────────────────┐
│ Header (thin: title, session name, players)       │
├──────────────────────────────────────────────────┤
│ Scene (compact: location | title + description)   │
├──────────────────────────────────────────────────┤
│ Channel tabs (minimal)                            │
├────────────────────────────────┬─────────────────┤
│                                │                 │
│     STORY LOG                  │  Side panel     │
│     (takes all remaining       │  (journal,      │
│      vertical space)           │   session       │
│                                │   info)         │
│                                │                 │
├────────────────────────────────┴─────────────────┤
│ Input (single line, grows on multiline)           │
└──────────────────────────────────────────────────┘
```

**Rules:**
- The story log never competes for space. If the side panel obscures it on small screens, the side panel hides.
- The input is always visible. Always at the bottom. Never auto-hidden.
- The scene display is compact — it's context, not content. One or two lines.
- Headers are thin. They identify, they don't decorate.

### Information Density

The MC dashboard can be denser than the player view. The MC needs data at a glance. The player needs immersion.

- **Player view:** Minimal chrome. The story is the interface.
- **MC dashboard:** Structured data is welcome. Labels, counters, state indicators. But still dark, still atmospheric — a control room, not a spreadsheet.

---

## 6. The Negative Space Rule

What you DON'T show is as important as what you show.

- Memory levels in the MC sidebar currently say "Not yet initialized" — this is correct. Don't fill empty space with placeholder data.
- When the story hasn't begun, the log says "The story has not yet begun..." — this is correct. A single italic line is better than a loading state.
- When the Keeper is silent, silence is visible. Don't fill the gap with a spinner.

**Empty states should be poetic, not technical.** "No messages" is a technical fact. "The story has not yet begun..." is an invitation.

---

## 7. Beauty as Absence

The most beautiful interfaces in this space (Owlbear Rodeo, iA Writer, Bear) share one quality: they remove everything that isn't essential. Every border, every label, every icon is a cost. The test for inclusion is: "Does this serve the story?"

**Before adding any UI element, ask:**
1. Can the player understand without this?
2. Does this break immersion?
3. Is there a way to communicate this through the story log instead of through chrome?

If the answer to (1) is yes, don't add it.
If the answer to (2) is yes, don't add it.
If the answer to (3) is yes, prefer that.

---

## 8. Specific Anti-Patterns

| Anti-Pattern | Why It's Wrong | What To Do Instead |
|-------------|----------------|-------------------|
| Emoji in the UI | Breaks the 1930s Antarctic atmosphere | Use text, symbols (diamond ◆), or nothing |
| Rounded avatar circles | This isn't a social media app | Names in text, color-coded by role |
| Card grids / dashboard tiles | Breaks the narrative flow | Vertical scroll, story log is the primary pattern |
| Toast notifications | Jarring, breaks immersion | Inline system messages in the story log |
| Modal dialogs | Interrupts the ceremony | Inline panels, slide-out drawers at most |
| Bright accent colors | Competes with the story | Muted palette, accent only for the MC's voice |
| Loading skeletons | Too modern, too app-like | Quiet empty states or subtle pulse |
| Tooltips with arrows | Tooltip chrome is visual noise | If something needs explanation, it's too complex |
