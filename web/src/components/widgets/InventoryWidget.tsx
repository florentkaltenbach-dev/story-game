"use client";

import type { InventoryItem } from "@/lib/types";

interface InventoryWidgetProps {
  items: InventoryItem[];
}

export default function InventoryWidget({ items }: InventoryWidgetProps) {
  if (items.length === 0) {
    return <p className="text-xs text-muted/60 italic">No items yet</p>;
  }

  // Group by category
  const grouped = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const cat = item.category || "General";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  return (
    <div className="space-y-3">
      {[...grouped.entries()].map(([category, catItems]) => (
        <div key={category}>
          {grouped.size > 1 && (
            <p className="dossier-label text-[10px] mb-1.5">{category}</p>
          )}
          <div className="space-y-1.5">
            {catItems.map((item, i) => (
              <div key={`${item.name}-${i}`} className="flex items-start gap-2">
                <span className="text-accent/50 text-xs mt-0.5">&bull;</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-foreground/90 font-mono">{item.name}</span>
                    {item.quantity != null && item.quantity > 1 && (
                      <span className="text-[10px] text-accent/80 bg-accent/10 px-1.5 py-0.5 rounded-full">
                        &times;{item.quantity}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted/70 mt-0.5 leading-relaxed">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
