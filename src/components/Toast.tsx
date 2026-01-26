import { useEffect, useState } from "react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

interface ToastProps {
  messages: ToastMessage[];
  onRemove: (id: string) => void;
}

export function Toast({ messages, onRemove }: ToastProps) {
  return (
    <div className="toast-container">
      {messages.map((msg) => (
        <ToastItem key={msg.id} message={msg} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ message, onRemove }: { message: ToastMessage; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = message.duration || 3000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(message.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [message, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(message.id), 300);
  };

  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
    warning: "⚠",
  };

  return (
    <div className={`toast-item toast-${message.type} ${isExiting ? "toast-exit" : ""}`}>
      <span className="toast-icon">{icons[message.type]}</span>
      <span className="toast-message">{message.message}</span>
      <button className="toast-close" onClick={handleClose}>×</button>
    </div>
  );
}
