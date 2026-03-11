"use client";

import type { GameWidget, InventoryItem, NpcDossierData, EnvironmentData, StatusData, CustomData } from "@/lib/types";
import InventoryWidget from "./InventoryWidget";
import NpcDossierWidget from "./NpcDossierWidget";
import EnvironmentWidget from "./EnvironmentWidget";
import StatusWidget from "./StatusWidget";
import CustomWidget from "./CustomWidget";

interface WidgetRendererProps {
  widget: GameWidget;
}

export default function WidgetRenderer({ widget }: WidgetRendererProps) {
  switch (widget.kind) {
    case "inventory":
      return <InventoryWidget items={widget.data as InventoryItem[]} />;
    case "npc_dossier":
      return <NpcDossierWidget npc={widget.data as NpcDossierData} />;
    case "environment":
      return <EnvironmentWidget environment={widget.data as EnvironmentData} />;
    case "status":
      return <StatusWidget status={widget.data as StatusData} />;
    case "custom":
      return <CustomWidget custom={widget.data as CustomData} />;
    default:
      return <p className="text-xs text-muted/60">Unknown widget type</p>;
  }
}
