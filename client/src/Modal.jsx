import { useEffect } from "react";
import "./modal.css";

export default function Modal({
  open,
  title = "",
  message = "",
  type = "info",
  onConfirm,
  onCancel,
  onClose,
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = () => onClose?.();
  const stop = (e) => e.stopPropagation();

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" onClick={stop}>
        {title && <h3 className="modal-title">{title}</h3>}
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          {type === "confirm" && (
            <button className="modal-btn ghost" onClick={onCancel || onClose}>
              Cancel
            </button>
          )}
          <button
            className="modal-btn"
            onClick={() => {
              onConfirm?.();
              onClose?.();
            }}
          >
            {type === "confirm" ? "Confirm" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
