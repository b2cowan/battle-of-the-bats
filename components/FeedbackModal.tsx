import { AlertCircle, X, CheckCircle, Info } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void; // If provided, shows Cancel button and acts as confirm
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'primary' | 'warning' | 'success' | 'info';
}

export default function FeedbackModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'primary'
}: FeedbackModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertCircle size={24} className="text-danger" />;
      case 'warning': return <AlertCircle size={24} className="text-warning" />;
      case 'success': return <CheckCircle size={24} className="text-success" />;
      default: return <Info size={24} className="text-primary" />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            {getIcon()}
            <h3 style={{ margin: 0 }}>{title}</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '1.5rem', color: 'var(--white-80)', lineHeight: 1.5 }}>
          {message}
        </div>
        <div className="modal-footer" style={{ gap: '0.75rem' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            {onConfirm ? cancelText : 'Close'}
          </button>
          {onConfirm && (
            <button 
              className={`btn btn-${type === 'danger' ? 'danger' : 'primary'}`}
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
