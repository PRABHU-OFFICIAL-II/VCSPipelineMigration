import React, { useEffect } from 'react';
import './Toast.css';

function Toast({ message, type = 'info', onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className={`toast toast--${type}`}>
      <span className="toast__msg">{message}</span>
      <button className="toast__close" onClick={onClose}>&#x2715;</button>
    </div>
  );
}

export default Toast;
