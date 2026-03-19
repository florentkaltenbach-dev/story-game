"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Player, Session, CharacterSheet } from "@/lib/types";

export interface Archetype {
  name: string;
  motivation: string;
  skills: string;
  vulnerability: string;
}

interface CharacterCreationProps {
  player: Player;
  session: Session;
  archetypes: Archetype[];
  onUpdate: (fields: Partial<CharacterSheet>) => void;
  onSubmit: () => void;
}

export default function CharacterCreation({
  player,
  session,
  archetypes,
  onUpdate,
  onSubmit,
}: CharacterCreationProps) {
  const character = player.character;
  const readOnly = character.status === "submitted" || character.status === "approved";

  const [archetype, setArchetype] = useState(character.archetype);
  const [customArchetype, setCustomArchetype] = useState(
    archetypes.some((a) => a.name === character.archetype) ? "" : character.archetype
  );
  const [background, setBackground] = useState(character.background);
  const [motivation, setMotivation] = useState(character.motivation);
  const [fear, setFear] = useState(character.fear);
  const [qualities, setQualities] = useState<string[]>(character.qualities);
  const [qualityInput, setQualityInput] = useState("");
  const [relationships, setRelationships] = useState<string[]>(character.relationships);
  const [relationshipInput, setRelationshipInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync from props when character updates externally (e.g. SSE)
  useEffect(() => {
    setArchetype(character.archetype);
    setCustomArchetype(
      archetypes.some((a) => a.name === character.archetype) ? "" : character.archetype
    );
    setBackground(character.background);
    setMotivation(character.motivation);
    setFear(character.fear);
    setQualities(character.qualities);
    setRelationships(character.relationships);
  }, [character]);

  const isOther = archetype === "__other__" || (!archetypes.some((a) => a.name === archetype) && archetype !== "");
  const selectedArchetype = archetypes.find((a) => a.name === archetype);

  // Resolve the effective archetype value
  const resolvedArchetype = isOther ? customArchetype : archetype;

  // Validation: minimum required fields
  const canSubmit = resolvedArchetype.trim() !== "" && background.trim() !== "" && motivation.trim() !== "";

  // Debounced auto-save (2s)
  const debouncedSave = useCallback(
    (fields: Partial<CharacterSheet>) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSaving(true);
        onUpdate(fields);
        setTimeout(() => setSaving(false), 500);
      }, 2000);
    },
    [onUpdate]
  );

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // Trigger auto-save on field changes (skip if read-only)
  useEffect(() => {
    if (readOnly) return;
    debouncedSave({
      archetype: resolvedArchetype,
      background,
      motivation,
      fear,
      qualities,
      relationships,
    });
  }, [archetype, customArchetype, background, motivation, fear, qualities, relationships, readOnly, isOther, debouncedSave, resolvedArchetype]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!resolvedArchetype.trim()) newErrors.archetype = "Role is required";
    if (!background.trim()) newErrors.background = "Background is required";
    if (!motivation.trim()) newErrors.motivation = "Motivation is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      onSubmit();
    } finally {
      // Small delay for visual feedback
      setTimeout(() => setSubmitting(false), 500);
    }
  }

  function addQuality() {
    const q = qualityInput.trim();
    if (q && !qualities.includes(q)) {
      setQualities([...qualities, q]);
      setQualityInput("");
    }
  }

  function removeQuality(q: string) {
    setQualities(qualities.filter((x) => x !== q));
  }

  function addRelationship() {
    const r = relationshipInput.trim();
    if (r) {
      setRelationships([...relationships, r]);
      setRelationshipInput("");
    }
  }

  function removeRelationship(idx: number) {
    setRelationships(relationships.filter((_, i) => i !== idx));
  }

  const otherPlayers = session.players.filter((p) => p.id !== player.id);

  return (
    <div className="flex flex-col h-full border-l border-border bg-surface overflow-y-auto">
      {/* Dossier header */}
      <div className="px-5 pt-5 pb-3 border-b border-border relative">
        <p className="text-[11px] tracking-[0.35em] uppercase text-muted/70 mb-0.5 font-mono">
          Starkweather-Moore Expedition
        </p>
        <h3 className="text-sm text-accent tracking-wide" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          Personnel Record
        </h3>
        <p className="text-xs text-muted/60 italic mt-0.5">Confidential</p>

        {/* Status indicator */}
        <div className="absolute top-3 right-4">
          {saving && (
            <span className="text-[11px] text-muted/60 tracking-wider">saving...</span>
          )}
        </div>
      </div>

      {/* Revision comment banner */}
      {character.revisionComment && character.status === "draft" && (
        <div className="mx-4 mt-3 px-3 py-2 border border-amber-500/30 rounded bg-amber-500/5">
          <p className="text-[11px] tracking-[0.2em] uppercase text-amber-500/85 font-mono mb-1">
            Revision Requested
          </p>
          <p className="text-xs text-foreground/80 italic">{character.revisionComment}</p>
        </div>
      )}

      {/* Status watermarks */}
      {character.status === "submitted" && (
        <div className="mx-4 mt-3 px-3 py-2 border border-accent/30 rounded bg-accent/5 text-center">
          <span className="text-xs tracking-[0.3em] uppercase text-accent/85 font-mono">
            Submitted &mdash; Awaiting Review
          </span>
        </div>
      )}
      {character.status === "approved" && (
        <div className="mx-4 mt-3 px-3 py-2 border border-keeper/30 rounded bg-keeper/5 text-center">
          <span className="text-xs tracking-[0.3em] uppercase text-keeper/85 font-mono">
            Approved
          </span>
        </div>
      )}

      {/* Form fields */}
      <div className="px-5 py-4 space-y-5 flex-1">
        {/* Character Name (display only — uses player.name) */}
        <div>
          <label className="dossier-label">Name</label>
          <p className="text-sm text-foreground/80" style={{ fontFamily: "Georgia, serif" }}>
            {player.name}
          </p>
        </div>

        {/* Archetype */}
        <div>
          <label className="dossier-label">
            Role / Archetype <span className="text-red-400/70">*</span>
          </label>
          {readOnly ? (
            <p className="text-sm text-foreground/80">{character.archetype || "\u2014"}</p>
          ) : (
            <>
              <select
                value={isOther && archetype !== "__other__" ? "__other__" : archetype}
                onChange={(e) => {
                  setArchetype(e.target.value);
                  if (e.target.value !== "__other__") setCustomArchetype("");
                  if (errors.archetype) setErrors((prev) => ({ ...prev, archetype: "" }));
                }}
                className={`w-full bg-surface-light border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent/50 ${
                  errors.archetype ? "border-red-400/50" : "border-border"
                }`}
              >
                <option value="">Select a role...</option>
                {archetypes.map((a) => (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
                <option value="__other__">Other (custom)</option>
              </select>
              {(archetype === "__other__" || isOther) && (
                <input
                  type="text"
                  value={customArchetype}
                  onChange={(e) => {
                    setCustomArchetype(e.target.value);
                    if (errors.archetype) setErrors((prev) => ({ ...prev, archetype: "" }));
                  }}
                  placeholder="Your role..."
                  className="w-full mt-2 bg-surface-light border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent/50"
                />
              )}
              {errors.archetype && (
                <p className="text-xs text-red-400/80 mt-1">{errors.archetype}</p>
              )}
            </>
          )}

          {/* Archetype description */}
          {selectedArchetype && (
            <div className="mt-2 px-3 py-2 bg-surface-light/50 border-l-2 border-accent/30 rounded-r text-xs space-y-1">
              <p className="text-foreground/80 italic">&ldquo;{selectedArchetype.motivation}&rdquo;</p>
              <p className="text-muted/70">
                <span className="text-muted/85">Skills:</span> {selectedArchetype.skills}
              </p>
              <p className="text-muted/70">
                <span className="text-muted/85">Vulnerability:</span> {selectedArchetype.vulnerability}
              </p>
            </div>
          )}
        </div>

        {/* Background */}
        <div>
          <label className="dossier-label">
            Background & Expertise <span className="text-red-400/70">*</span>
          </label>
          <p className="dossier-prompt">Prior experience relevant to Antarctic service</p>
          {readOnly ? (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{background || "\u2014"}</p>
          ) : (
            <>
              <textarea
                value={background}
                onChange={(e) => {
                  setBackground(e.target.value);
                  if (errors.background) setErrors((prev) => ({ ...prev, background: "" }));
                }}
                rows={3}
                className={`dossier-textarea ${errors.background ? "!border-red-400/50" : ""}`}
              />
              {errors.background && (
                <p className="text-xs text-red-400/80 mt-1">{errors.background}</p>
              )}
            </>
          )}
        </div>

        {/* Motivation */}
        <div>
          <label className="dossier-label">
            Why did you accept this post? <span className="text-red-400/70">*</span>
          </label>
          <p className="dossier-prompt">The real answer, not the polite one</p>
          {readOnly ? (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{motivation || "\u2014"}</p>
          ) : (
            <>
              <textarea
                value={motivation}
                onChange={(e) => {
                  setMotivation(e.target.value);
                  if (errors.motivation) setErrors((prev) => ({ ...prev, motivation: "" }));
                }}
                rows={3}
                className={`dossier-textarea ${errors.motivation ? "!border-red-400/50" : ""}`}
              />
              {errors.motivation && (
                <p className="text-xs text-red-400/80 mt-1">{errors.motivation}</p>
              )}
            </>
          )}
        </div>

        {/* Fear */}
        <div>
          <label className="dossier-label">What are you afraid of?</label>
          <p className="dossier-prompt">Not monsters &mdash; something human</p>
          {readOnly ? (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{fear || "\u2014"}</p>
          ) : (
            <textarea
              value={fear}
              onChange={(e) => setFear(e.target.value)}
              rows={2}
              className="dossier-textarea"
            />
          )}
        </div>

        {/* Qualities */}
        <div>
          <label className="dossier-label">Qualities</label>
          <p className="dossier-prompt">Describe yourself in qualities, not numbers</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {qualities.map((q) => (
              <span key={q} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 border border-accent/20 rounded text-xs text-accent/90">
                {q}
                {!readOnly && (
                  <button onClick={() => removeQuality(q)} className="text-accent/60 hover:text-accent ml-0.5">&times;</button>
                )}
              </span>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <input
                type="text"
                value={qualityInput}
                onChange={(e) => setQualityInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQuality(); } }}
                placeholder="Add a quality..."
                className="flex-1 bg-surface-light border border-border rounded px-3 py-1 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent/50"
              />
              <button
                onClick={addQuality}
                disabled={!qualityInput.trim()}
                className="text-xs px-2 py-1 text-accent/80 hover:text-accent transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Connections */}
        <div>
          <label className="dossier-label">Connections</label>
          <p className="dossier-prompt">
            Links to others in the expedition
            {otherPlayers.length > 0 && (
              <span className="text-muted/60">
                {" "}&mdash; {otherPlayers.map((p) => p.name).join(", ")}
              </span>
            )}
          </p>
          <div className="space-y-1.5 mb-2">
            {relationships.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/70">
                <span className="text-accent/50 mt-0.5">&bull;</span>
                <span className="flex-1">{r}</span>
                {!readOnly && (
                  <button onClick={() => removeRelationship(i)} className="text-muted/50 hover:text-foreground text-xs flex-shrink-0">&times;</button>
                )}
              </div>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <input
                type="text"
                value={relationshipInput}
                onChange={(e) => setRelationshipInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRelationship(); } }}
                placeholder="e.g. Studied under Moore at Columbia"
                className="flex-1 bg-surface-light border border-border rounded px-3 py-1 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent/50"
              />
              <button
                onClick={addRelationship}
                disabled={!relationshipInput.trim()}
                className="text-xs px-2 py-1 text-accent/80 hover:text-accent transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!readOnly && (
        <div className="px-5 py-4 border-t border-border space-y-2">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full py-2 bg-accent/20 text-accent border border-accent/30 rounded text-sm tracking-wide hover:bg-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit for Approval"}
          </button>
          {!canSubmit && (
            <p className="text-xs text-muted/60 text-center">
              Fill in role, background, and motivation to submit
            </p>
          )}
          {canSubmit && (
            <p className="text-xs text-muted/60 text-center">
              Changes are saved automatically
            </p>
          )}
        </div>
      )}
    </div>
  );
}
