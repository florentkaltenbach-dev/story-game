"use client";

import { useState } from "react";
import type { Player, Session, PresetCharacter } from "@/lib/types";
import CharacterSelection from "./CharacterSelection";
import { CornerFrame, Flourish } from "./Ornaments";

type WizardStep = "welcome" | "briefing" | "character_select";

interface OnboardingWizardProps {
  player: Player;
  session: Session;
  availableCharacters: PresetCharacter[];
  claimedCharacterIds: string[];
  onCharacterClaim: (id: string) => void;
}

function WelcomeStep({ session, onNext }: { session: Session; onNext: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/30 to-background" />
      <CornerFrame className="relative z-10 bg-surface border border-border rounded-lg p-8 max-w-lg w-full mx-4 text-center">
        <p className="text-[10px] tracking-[0.4em] uppercase text-muted/60 mb-2">
          You have been summoned to
        </p>
        <h2 className="narrative-text text-2xl text-accent mb-3">
          {session.name}
        </h2>
        <Flourish size="md" className="my-5" />
        <p className="text-sm text-foreground/80 leading-relaxed mb-6 narrative-text">
          Before we begin, you will receive a briefing document
          and choose your character for this expedition.
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
      </CornerFrame>
    </div>
  );
}

function BriefingStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/30 to-background" />
      <CornerFrame className="relative z-10 bg-surface border border-border rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="text-center mb-4">
          <p className="text-[10px] tracking-[0.3em] uppercase text-muted/60 mb-1">
            Briefing Document
          </p>
          <h3 className="narrative-text text-lg text-accent">
            What You Know
          </h3>
        </div>
        <Flourish size="sm" className="mb-5" />
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
            Choose Your Character
          </button>
        </div>
      </CornerFrame>
    </div>
  );
}

function resolveStep(player: Player, userStep: WizardStep | null): WizardStep {
  // If already approved → wizard is done (parent handles this)
  // If user has advanced past welcome/briefing, stay there
  if (userStep === "character_select" || userStep === "briefing") {
    return userStep;
  }
  // Fresh (pending or empty draft) → welcome
  if (player.character.status === "pending" ||
      (player.character.status === "draft" && !player.character.archetype)) {
    return userStep ?? "welcome";
  }
  // Fallback to selection
  return "character_select";
}

export default function OnboardingWizard({
  player,
  session,
  availableCharacters,
  claimedCharacterIds,
  onCharacterClaim,
}: OnboardingWizardProps) {
  const [userStep, setUserStep] = useState<WizardStep | null>(null);
  const step = resolveStep(player, userStep);

  switch (step) {
    case "welcome":
      return <WelcomeStep session={session} onNext={() => setUserStep("briefing")} />;
    case "briefing":
      return <BriefingStep onNext={() => setUserStep("character_select")} />;
    case "character_select":
      return (
        <div className="h-screen flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
            <h1 className="narrative-text text-lg text-accent">The Ceremony</h1>
            <span className="text-xs text-ice font-medium">{player.name}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <CharacterSelection
              characters={availableCharacters}
              claimedIds={claimedCharacterIds}
              onClaim={onCharacterClaim}
              playerName={player.name}
            />
          </div>
        </div>
      );
  }
}
