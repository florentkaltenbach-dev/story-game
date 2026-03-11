"use client";

import { useState } from "react";

export type NpcVoiceOwner = "keeper" | "mc";

export interface NpcEntry {
  key: string;           // memory file key (slug)
  name: string;
  role: string;
  description: string;
  agenda?: string;
  voicedBy: NpcVoiceOwner;
  status: string;        // "mentioned" | "active" | "departed" etc.
  source: "memory" | "config"; // where this NPC came from
}

interface NpcPanelProps {
  npcs: NpcEntry[];
  onSave: (npc: NpcEntry) => void;
  onCreate: (npc: Omit<NpcEntry, "source">) => void;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function NpcCard({
  npc,
  onSave,
}: {
  npc: NpcEntry;
  onSave: (npc: NpcEntry) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(npc);

  function handleSave() {
    onSave(draft);
    setEditing(false);
  }

  function handleCancel() {
    setDraft(npc);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="p-3 bg-surface-light/50 border border-accent/20 rounded space-y-2">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
          placeholder="Name"
        />
        <input
          value={draft.role}
          onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
          placeholder="Role"
        />
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={2}
          className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-foreground resize-none"
          placeholder="Description"
        />
        <input
          value={draft.agenda ?? ""}
          onChange={(e) => setDraft({ ...draft, agenda: e.target.value || undefined })}
          className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
          placeholder="Agenda (hidden from players)"
        />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted">Voice:</span>
          <select
            value={draft.voicedBy}
            onChange={(e) => setDraft({ ...draft, voicedBy: e.target.value as NpcVoiceOwner })}
            className="bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
          >
            <option value="keeper">Keeper</option>
            <option value="mc">MC</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted">Status:</span>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            className="bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
          >
            <option value="mentioned">Mentioned</option>
            <option value="active">Active</option>
            <option value="departed">Departed</option>
            <option value="dead">Dead</option>
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            className="px-3 py-1 text-[10px] bg-accent/20 text-accent border border-accent/30 rounded hover:bg-accent/30 transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1 text-[10px] text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2.5 bg-surface-light/30 border border-border/40 rounded group">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-foreground/90 font-medium truncate">
              {npc.name}
            </span>
            <span className={`text-[9px] px-1 py-0.5 rounded ${
              npc.voicedBy === "mc"
                ? "bg-accent/15 text-accent"
                : "bg-keeper/15 text-keeper"
            }`}>
              {npc.voicedBy === "mc" ? "MC" : "AI"}
            </span>
          </div>
          <p className="text-[10px] text-muted/80 mt-0.5 truncate">{npc.role}</p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-[10px] text-muted/50 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
        >
          edit
        </button>
      </div>
      {npc.description && (
        <p className="text-[10px] text-foreground/60 mt-1 line-clamp-2">
          {npc.description}
        </p>
      )}
      <div className="flex items-center gap-2 mt-1.5">
        <span className={`text-[9px] px-1 py-0.5 rounded ${
          npc.status === "active" ? "bg-green-500/15 text-green-400" :
          npc.status === "departed" ? "bg-orange-500/15 text-orange-400" :
          npc.status === "dead" ? "bg-red-500/15 text-red-400" :
          "bg-muted/10 text-muted/60"
        }`}>
          {npc.status}
        </span>
        {npc.source === "config" && (
          <span className="text-[9px] text-muted/40">preset</span>
        )}
      </div>
    </div>
  );
}

function CreateNpcForm({ onCreate, onCancel }: { onCreate: (npc: Omit<NpcEntry, "source">) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [agenda, setAgenda] = useState("");
  const [voicedBy, setVoicedBy] = useState<NpcVoiceOwner>("keeper");

  function handleCreate() {
    if (!name.trim()) return;
    onCreate({
      key: slugify(name.trim()),
      name: name.trim(),
      role: role.trim(),
      description: description.trim(),
      agenda: agenda.trim() || undefined,
      voicedBy,
      status: "active",
    });
    setName("");
    setRole("");
    setDescription("");
    setAgenda("");
  }

  return (
    <div className="p-3 bg-surface-light/50 border border-accent/20 rounded space-y-2">
      <p className="text-[10px] text-accent/80 font-medium uppercase tracking-wider">New NPC</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
        placeholder="Name"
        autoFocus
      />
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
        placeholder="Role"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-foreground resize-none"
        placeholder="Description"
      />
      <input
        value={agenda}
        onChange={(e) => setAgenda(e.target.value)}
        className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
        placeholder="Agenda (hidden from players)"
      />
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted">Voice:</span>
        <select
          value={voicedBy}
          onChange={(e) => setVoicedBy(e.target.value as NpcVoiceOwner)}
          className="bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
        >
          <option value="keeper">Keeper</option>
          <option value="mc">MC</option>
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className="px-3 py-1 text-[10px] bg-accent/20 text-accent border border-accent/30 rounded hover:bg-accent/30 transition-colors disabled:opacity-50"
        >
          Create
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-[10px] text-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function NpcPanel({ npcs, onSave, onCreate }: NpcPanelProps) {
  const [showCreate, setShowCreate] = useState(false);

  const activeNpcs = npcs.filter((n) => n.status !== "dead" && n.status !== "departed");
  const inactiveNpcs = npcs.filter((n) => n.status === "dead" || n.status === "departed");

  return (
    <div className="space-y-2">
      {npcs.length === 0 && !showCreate && (
        <p className="text-xs text-muted/60 italic">No NPCs in memory yet.</p>
      )}

      {activeNpcs.map((npc) => (
        <NpcCard key={npc.key} npc={npc} onSave={onSave} />
      ))}

      {inactiveNpcs.length > 0 && (
        <div className="pt-1">
          <p className="text-[10px] text-muted/50 uppercase tracking-wider mb-1">Inactive</p>
          {inactiveNpcs.map((npc) => (
            <NpcCard key={npc.key} npc={npc} onSave={onSave} />
          ))}
        </div>
      )}

      {showCreate ? (
        <CreateNpcForm
          onCreate={(npc) => {
            onCreate(npc);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-1.5 text-[10px] text-muted/60 hover:text-accent border border-dashed border-border/40 hover:border-accent/30 rounded transition-colors"
        >
          + Add NPC
        </button>
      )}
    </div>
  );
}
