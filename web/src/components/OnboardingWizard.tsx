"use client";

import { useState } from "react";
import type { Player, Session, CharacterSheet } from "@/lib/types";
import CharacterCreation from "./CharacterCreation";

type WizardStep = "welcome" | "briefing" | "character" | "waiting";

interface OnboardingWizardProps {
  player: Player;
  session: Session;
  onCharacterUpdate: (fields: Partial<CharacterSheet>) => void;
  onCharacterSubmit: () => void;
}

function WelcomeStep({ session, onNext }: { session: Session; onNext: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/30 to-background" />
      <div className="relative z-10 bg-surface border border-border rounded-lg p-8 max-w-lg w-full mx-4 text-center">
        <p className="text-[10px] tracking-[0.4em] uppercase text-muted/60 mb-2">
          You have been summoned to
        </p>
        <h2 className="narrative-text text-2xl text-accent mb-3">
          {session.name}
        </h2>
        <div className="h-px bg-border my-5" />
        <p className="text-sm text-foreground/80 leading-relaxed mb-6 narrative-text">
          Before we begin, you will receive a briefing document
          and create your character for this expedition.
        </p>
        {session.players.length > 1 && (
          <p className="text-xs text-muted/70 mb-6">
            {session.players.map((p) => p.name).join(", ")} are gathering.
          </p>
        )}
        <button
          onClick={onNext}
          className="px-6 py-2.5 bg-accent/20 text-accent border border-accent/30 rounded text-sm tracking-wide hover:bg-accent/30 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function BriefingStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/30 to-background" />
      <div className="relative z-10 bg-surface border border-border rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="text-center mb-4">
          <p className="text-[10px] tracking-[0.3em] uppercase text-muted/60 mb-1">
            Briefing Document
          </p>
          <h3 className="narrative-text text-lg text-accent">
            What You Know
          </h3>
        </div>
        <div className="h-px bg-border mb-5" />
        <div className="narrative-text text-sm text-foreground/85 leading-relaxed space-y-4 max-h-[50vh] overflow-y-auto px-2">
          <p>
            In 1930, a geological survey of Antarctica led by Professor William Dyer
            of Miskatonic University encountered something extraordinary in the mountains
            beyond Lake&rsquo;s Camp. His published account was dismissed as delirium
            brought on by extreme conditions.
          </p>
          <p>
            Now, in 1933, a new expedition has been organized. Dr. Harold Starkweather,
            who read Dyer&rsquo;s private account, believes every word. Professor James Moore,
            the expedition&rsquo;s co-sponsor, thinks there&rsquo;s a rational explanation.
          </p>
          <p>
            You have been recruited for the Starkweather-Moore Expedition. The destination:
            the Antarctic interior, beyond where Dyer&rsquo;s survey ended. The official purpose:
            geological and biological research. The unofficial purpose depends on who you ask.
          </p>
          <p className="text-muted/70 italic">
            You should know: nothing about this expedition is straightforward.
            Everyone has their reasons for being here. Including you.
          </p>
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={onNext}
            className="px-6 py-2.5 bg-accent/20 text-accent border border-accent/30 rounded text-sm tracking-wide hover:bg-accent/30 transition-colors"
          >
            Create Your Character
          </button>
        </div>
      </div>
    </div>
  );
}

function WaitingStep({ player }: { player: Player }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/30 to-background" />
      <div className="relative z-10 bg-surface border border-border rounded-lg p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-4">
          <span className="relative flex h-3 w-3 mx-auto">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-40 animate-ping" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-accent" />
          </span>
        </div>
        <h3 className="narrative-text text-lg text-accent mb-2">
          Awaiting Review
        </h3>
        <p className="text-sm text-foreground/70 mb-1">
          Your personnel record has been submitted, {player.name}.
        </p>
        <p className="text-xs text-muted/60">
          The MC is reviewing your character. You&rsquo;ll be notified when approved.
        </p>
      </div>
    </div>
  );
}

function resolveStep(player: Player, userStep: WizardStep | null): WizardStep {
  // If MC sent back for revision, go to character step
  if (player.character.status === "draft" && player.character.revisionComment) {
    return "character";
  }
  // Submitted → waiting
  if (player.character.status === "submitted") {
    return "waiting";
  }
  // If user has advanced past welcome/briefing, stay there
  if (userStep === "character" || userStep === "briefing") {
    return userStep;
  }
  // Fresh (pending or empty draft) → welcome
  if (player.character.status === "pending" ||
      (player.character.status === "draft" && !player.character.archetype)) {
    return userStep ?? "welcome";
  }
  // In-progress draft → character
  return "character";
}

export default function OnboardingWizard({
  player,
  session,
  onCharacterUpdate,
  onCharacterSubmit,
}: OnboardingWizardProps) {
  const [userStep, setUserStep] = useState<WizardStep | null>(null);
  const step = resolveStep(player, userStep);

  switch (step) {
    case "welcome":
      return <WelcomeStep session={session} onNext={() => setUserStep("briefing")} />;
    case "briefing":
      return <BriefingStep onNext={() => setUserStep("character")} />;
    case "character":
      return (
        <div className="h-screen flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
            <h1 className="narrative-text text-lg text-accent">The Ceremony</h1>
            <span className="text-xs text-ice font-medium">{player.name}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <CharacterCreation
              player={player}
              session={session}
              onUpdate={onCharacterUpdate}
              onSubmit={onCharacterSubmit}
            />
          </div>
        </div>
      );
    case "waiting":
      return <WaitingStep player={player} />;
  }
}
