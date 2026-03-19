"use client";

/**
 * Archetype Icons — Art Deco line art for the 7 character archetypes.
 * Each icon uses a consistent 24×24 viewBox with 1px strokes,
 * matching the ornamental weight of existing Ornaments.tsx components.
 */

type ArchetypeIconProps = {
  size?: number;
  className?: string;
};

function IconWrapper({ size = 24, className = "", children }: ArchetypeIconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`text-accent ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Scientist — flask/beaker with liquid */
export function ScientistIcon(props: ArchetypeIconProps) {
  return (
    <IconWrapper {...props}>
      <path d="M9,3 L9,10 L4,20 L20,20 L15,10 L15,3" opacity="0.4" />
      <line x1="8" y1="3" x2="16" y2="3" opacity="0.4" />
      <path d="M7,15 L17,15" opacity="0.2" />
      <circle cx="10" cy="17" r="1" fill="currentColor" opacity="0.2" />
      <circle cx="14" cy="17.5" r="0.8" fill="currentColor" opacity="0.15" />
    </IconWrapper>
  );
}

/** Veteran — shield with chevron */
export function VeteranIcon(props: ArchetypeIconProps) {
  return (
    <IconWrapper {...props}>
      <path d="M12,2 L20,6 L20,12 C20,17 16,21 12,22 C8,21 4,17 4,12 L4,6 Z" opacity="0.4" />
      <polyline points="8,12 12,15 16,12" opacity="0.3" />
      <polyline points="8,9 12,12 16,9" opacity="0.2" />
    </IconWrapper>
  );
}

/** Journalist — notepad with pen */
export function JournalistIcon(props: ArchetypeIconProps) {
  return (
    <IconWrapper {...props}>
      <rect x="5" y="3" width="12" height="18" rx="1" opacity="0.4" />
      <line x1="8" y1="7" x2="14" y2="7" opacity="0.2" />
      <line x1="8" y1="10" x2="14" y2="10" opacity="0.2" />
      <line x1="8" y1="13" x2="12" y2="13" opacity="0.2" />
      <path d="M18,3 L20,1 L22,3 L20,5 Z" opacity="0.3" />
      <line x1="18" y1="5" x2="15" y2="8" opacity="0.25" />
    </IconWrapper>
  );
}

/** Mechanic — gear/cog */
export function MechanicIcon(props: ArchetypeIconProps) {
  return (
    <IconWrapper {...props}>
      <circle cx="12" cy="12" r="4" opacity="0.4" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.2" />
      {/* Gear teeth */}
      {[0, 60, 120, 180, 240, 300].map((angle) => {
        const a = (angle * Math.PI) / 180;
        const r1 = 6, r2 = 9;
        return (
          <line
            key={angle}
            x1={12 + r1 * Math.cos(a)} y1={12 + r1 * Math.sin(a)}
            x2={12 + r2 * Math.cos(a)} y2={12 + r2 * Math.sin(a)}
            strokeWidth="2.5" opacity="0.3"
          />
        );
      })}
    </IconWrapper>
  );
}

/** Agent — eye symbol */
export function AgentIcon(props: ArchetypeIconProps) {
  return (
    <IconWrapper {...props}>
      <path d="M2,12 C5,7 9,5 12,5 C15,5 19,7 22,12 C19,17 15,19 12,19 C9,19 5,17 2,12 Z" opacity="0.4" />
      <circle cx="12" cy="12" r="3" opacity="0.3" />
      <circle cx="12" cy="12" r="1" fill="currentColor" opacity="0.3" />
    </IconWrapper>
  );
}

/** Expert — book/tome */
export function ExpertIcon(props: ArchetypeIconProps) {
  return (
    <IconWrapper {...props}>
      <path d="M4,3 C4,3 8,4 12,4 C16,4 20,3 20,3 L20,19 C20,19 16,20 12,20 C8,20 4,19 4,19 Z" opacity="0.4" />
      <line x1="12" y1="4" x2="12" y2="20" opacity="0.2" />
      <line x1="7" y1="8" x2="11" y2="8" opacity="0.15" />
      <line x1="7" y1="11" x2="11" y2="11" opacity="0.15" />
      <line x1="13" y1="8" x2="17" y2="8" opacity="0.15" />
      <line x1="13" y1="11" x2="17" y2="11" opacity="0.15" />
    </IconWrapper>
  );
}

/** Believer — flame/torch */
export function BelieverIcon(props: ArchetypeIconProps) {
  return (
    <IconWrapper {...props}>
      <path d="M12,2 C12,2 16,6 16,10 C16,13 14,14 12,14 C10,14 8,13 8,10 C8,6 12,2 12,2 Z" opacity="0.4" />
      <path d="M12,6 C12,6 14,8 14,10 C14,11.5 13,12 12,12 C11,12 10,11.5 10,10 C10,8 12,6 12,6 Z" fill="currentColor" opacity="0.15" />
      <line x1="11" y1="14" x2="11" y2="22" opacity="0.35" />
      <line x1="13" y1="14" x2="13" y2="22" opacity="0.35" />
      <line x1="9" y1="22" x2="15" y2="22" opacity="0.3" />
    </IconWrapper>
  );
}

/** Lookup map for dynamic rendering */
export const ARCHETYPE_ICONS: Record<string, React.FC<ArchetypeIconProps>> = {
  scientist: ScientistIcon,
  veteran: VeteranIcon,
  journalist: JournalistIcon,
  mechanic: MechanicIcon,
  agent: AgentIcon,
  expert: ExpertIcon,
  believer: BelieverIcon,
};

/** Renders an archetype icon by name string */
export function ArchetypeIcon({
  archetype,
  ...props
}: ArchetypeIconProps & { archetype: string }) {
  const Icon = ARCHETYPE_ICONS[archetype.toLowerCase()];
  if (!Icon) return null;
  return <Icon {...props} />;
}
