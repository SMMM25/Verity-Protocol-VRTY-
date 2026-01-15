/**
 * Modal Component
 * Polished with Lovable.dev patterns - clean animations and accessibility
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg mx-4 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl',
          'animate-in fade-in slide-in-from-bottom-4 duration-300',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <div className={cn('p-6', !title && 'pt-10')}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
