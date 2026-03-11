interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmModalProps) {
  const accentClass = danger ? "red-500" : "accent";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className={`bg-surface border border-${accentClass}/30 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl ${danger ? "shadow-red-500/5" : ""}`}>
        <h3 className={`narrative-text text-lg ${danger ? "text-red-400" : "text-accent"} mb-2`}>
          {title}
        </h3>
        <div className="text-xs text-muted leading-relaxed mb-4">{message}</div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="text-xs px-4 py-2 bg-surface-light text-muted border border-border rounded hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`text-xs px-4 py-2 rounded border transition-colors ${
              danger
                ? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
                : "bg-accent/20 text-accent border-accent/30 hover:bg-accent/30"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
