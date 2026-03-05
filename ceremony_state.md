# The Ceremony — Project State

*Living document. Carried through the conversation. Updated as we go.*

---

## Identity

- **Name:** TBD — the community hub needs a name
- **Spirit:** Campfire meets theater. Intimate rituals, curated for an audience.
- **Core idea:** AI-powered interactive adventure stories run as live ceremonies with voice + text companion
- **The whole act is the ceremony** — MC, Keeper, players, even the AI. Everyone is part of it.

---

## Roles

| Role | Description | Sees |
|------|-------------|------|
| **MC (you)** | The storyteller. Human voice. Dungeon master. | MC Dashboard: story architecture, world state, narrative threads, all player stats. NOT player-to-Keeper private channels. |
| **The Keeper** | AI agent. Backstage crew + players' confessional. The only entity with full picture. | EVERYTHING. All layers. All private channels. |
| **Players (up to 5)** | Co-op participants. Any character type. | Own character sheet, shared story, group channels, private Keeper channel. |

---

## Tech Stack

| Component | Tech | Status |
|-----------|------|--------|
| Voice | Jitsi Meet (self-hosted, Docker) | To deploy |
| Text companion | Next.js web app | To build |
| AI brain | Claude API (console.anthropic.com credits) | Available |
| Embeddings | Hugging Face free tier (semantic search) | To evaluate |
| Memory engine | Node.js file system | To build |
| Infrastructure | Hetzner Cloud, Docker, Caddy | Existing |

---

## Memory Architecture — The File System (5 Levels)

| Level | Name | Contents |
|-------|------|----------|
| 1 | **Plot State** | Current scene, what just happened, immediate context |
| 2 | **Character State** | Every character's stats, relationships, motivations, secrets. Updated after every meaningful interaction |
| 3 | **Narrative Threads** | Active foreshadowing, unresolved tensions, planted details. Tagged with plant-date and expected payoff |
| 4 | **Thematic Layer** | Deeper patterns, what the story is actually about, recurring symbols, motifs, tonal shifts |
| 5 | **World State** | Living world beyond the players. Offscreen events, NPC movements, rippling consequences |

### Permission Layers

| Layer | Who sees it |
|-------|------------|
| **MC layer** | Story architecture, world state, narrative threads, all player stats |
| **Player layer** | Own character, shared story, group channels |
| **Keeper layer** | Everything — the only full-picture entity |

### Memory per Player

Each player has a dedicated memory slice:
- Personal history (everything they did and saw)
- Their knowledge state (fog of knowledge — what they know)
- Relationship map from their perspective

---

## Messaging System

| Channel | Who | Purpose |
|---------|-----|---------|
| **All channel** | Everyone + MC + Keeper | Shared story, announcements |
| **Group channels** | Player-created subsets | Scheming, alliances, planning |
| **Private to Keeper** | Each player individually | Secret actions, questions, hidden rolls |
| **MC to Keeper** | MC only | Backstage: request lore, generate text, manage session |

---

## Interfaces

### MC Dashboard (only MC sees)

- Live query the file system ("what did the players miss in the ice cave?")
- Generate on demand ("give me a description of what they find in the journal")
- Override and inject — plant clues, change NPC behavior, trigger events
- Dice engine — Keeper decides roll, emulated behind the screen
- Session state at a glance — all five memory levels visible

### Player Board (each player sees their own)

**Private space:**
- Character sheet (full detail, editable only in chreation phase)
- Personal notes — suspicions, plans, theories
- Personal history — everything they've done and seen
- Secret messages from MC or Keeper

**Shared space:**
- Current scene description
- Dice rolls and outcomes
- Party inventory / shared resources
- Story log — scrollable transcript

**Hidden space (system tracks, nobody sees directly):**
- Knowledge fog — what this player knows vs doesn't
- Relationship map from their perspective

---

## The Ingestion Pipeline (Source Text → Playable Story)

**Input:** Any free web resource (Project Gutenberg, wikis, CC worldbuilding docs, free RPG systems)

### Step 1 — Fetch
Point at URL(s). System downloads and stores raw text.

### Step 2 — Extract Storytelling DNA
AI analyzes source for:
- Tone and atmosphere markers
- Pacing structure (e.g. Lovecraft: slow academic buildup → environmental dread → cosmic reveal)
- World rules (explicit and implied)
- Location descriptions and geography
- Character archetypes present in the source
- Creature/entity lore
- Implied mechanics
- Narrative techniques used (foreshadowing patterns, POV style, tension curves)

### Step 3 — Generate Config File
Package extracted DNA into structured config:
```
config/
  story.json      — genre, tone, atmosphere, pacing template, act structure
  world.json      — lore, locations, environmental rules, discovery triggers
  characters.json — NPC templates, archetypes, relationship patterns
  mechanics.json  — stat system, dice rules, skill checks, resource systems
  techniques.json — narrative techniques, foreshadowing rules, pacing curves
```

### Step 4 — Human Review
MC reviews and tweaks the config. Adjust, add, remove. The AI extracted; the human curates.

### Step 5 — Initialize Memory
Config populates the file system's 5 levels. World state is seeded. NPC states initialized. Narrative thread placeholders planted. The Keeper is now ready to run.

---

## Character Creation Workflow

### Step 1 — Preset Context
System shows the player what world they're entering. Brief atmospheric intro (generated from config). No spoilers. Players can explore the initial universe and its flavor to get inspiration for their character.

### Step 2 — Keeper Conversation
The Keeper walks the player through character creation as a conversation. Questions shaped by the preset. For Mountains of Madness: "Who are you? What brought you to this expedition? What is your mission? What does your character provide for the expedition party?"

### Step 3 — Stat Generation
Based on conversation, Keeper proposes stats. Player adjusts. Assisted dice rolls where the player does not want to decide.

### Step 4 — Character File
System generates character file, slots into memory engine at Level 2. Player's private memory slice initialized.

### Step 5 — MC Approval
MC reviews character. Can request adjustments for story balance.

---

## Session Flow (The Ceremony)

### Pre-session
- MC preps with Keeper: reviews unresolved threads, plans chapter beats
- File system generates "previously on..." summary for players
- Players review their character state

### Opening
- TBD — the opening ritual. How do we cross from ordinary life into the story space?

### Play
- MC narrates via voice
- MC queries Keeper via dashboard for generated text, lore lookups, NPC dialogue
- Players interact via text companion: actions, dice rolls, messaging
- File system updates continuously across all 5 levels
- Hidden layer tracks per-player knowledge and stat distortion

### Closing
- TBD — the closing ritual. How do we leave the story space?
- Keeper writes session summary
- All 5 memory levels updated
- Unresolved threads flagged for MC review
- "Next time on..." teaser generated

### Between sessions
- Players can review their notes, character state
- MC preps next chapter with Keeper
- File system maintains full state

---

## Community Features (To Design)

- **Onboarding:** Journey from "what is this?" to ready-to-play. TBD.
- **Story archive / showcase:** Completed ceremonies preserved and presentable. The theater element — others can read/experience finished stories.

---

## First Ceremony — Mountains of Madness

- **Premise:** Second expedition — new team goes back despite the warning
- **Era:** 1930s (like the original)
- **Players:** 5 participants, experience level novice
- **Characters:** Any type (academics, sailors, journalists, guides, etc.)
- **Mechanics:** No dice. No numerical stats. AI resolves actions through judgment, not randomness. Characters described in qualities, not numbers. MC may write light framework underneath.
- **Player interface:** Journal, not character sheet. Who you are, what you've seen, what you carry, how you're feeling. Updated by Keeper in prose.
- **MC interface:** Structured data underneath. Tables, tags, searchable. Prep and conduct from data, present to players as narrative.
- **Episodes:** Weekly chapters

---

## Token Economy Design

**Principle:** Small precise queries, not big dumps.

**Per-turn Keeper context (~1,500 tokens target):**
- ~500 tokens — system prompt (Keeper identity + preset tone)
- ~300 tokens — current scene state (Level 1)
- ~200 tokens — active characters present (Level 2, filtered)
- ~200 tokens — relevant threads (Level 3, only triggered ones)
- ~100 tokens — MC's latest instruction
- ~variable — player action to respond to

**Compression:** After each scene, raw exchange compressed into state update. Raw text archived. Keeper works from summaries.

**Caching:** Static content (world lore, character baselines, preset DNA) loaded once, reused. Only deltas refreshed per turn.

**Smart routing:** Before each Keeper call, system asks "what does the Keeper need to know right now?" and assembles minimal relevant context.

---

## REMAINING WALKTHROUGHS

### ✅ Completed
1. ~~Overall architecture and tech stack~~
2. ~~Memory system (5 levels + permissions)~~
3. ~~Messaging system~~
4. ~~Interfaces (MC dashboard + player board)~~
5. ~~Ingestion pipeline (source → config)~~
6. ~~Character creation workflow~~
7. ~~Session flow overview~~
8. ~~Roles and permissions~~
9. ~~First ceremony premise (Mountains of Madness)~~

### 🔲 MC delivers separately
**10. Dice & mechanics system** — MC writes this. Integrate when ready.

### 🔲 Still to walk through

**11. Keeper prompt architecture**
How exactly does the Keeper query the file system each turn? What goes into its context window? How do we keep it from going shallow? The prompt engineering that makes the whole thing work.

**12. MC-Keeper interaction patterns**
Specific commands/queries the MC uses during live sessions. The backstage vocabulary.

**13. PvP mechanics**
How does the Keeper manage competing player interests? Resolution systems. Fairness. Secrets.

**14. NPC system**
How are NPCs generated, remembered, evolved? When does the MC voice them vs the Keeper?

**15. Onboarding flow**
First-time player journey. From invitation to first ceremony.

**16. Story archive / showcase**
How are finished stories preserved? What format? How does the theater element work?

**17. Hugging Face integration**
Semantic search setup. What embeddings model? How does it connect to the memory engine?

**18. Deployment plan**
Docker compose for the full stack. Domain, SSL, Jitsi config.

**19. Mountains of Madness — first preset**
Actually run the ingestion pipeline on Lovecraft. Build the first config. Design the first ceremony.

**20. API cost modeling**
Estimate Claude API usage per session. Budget for a weekly campaign.

---

*Last updated: This conversation, March 5, 2026*
*Next: Walk through items 9–20 one by one*
