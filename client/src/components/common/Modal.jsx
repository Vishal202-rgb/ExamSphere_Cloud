import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, subtitle, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Dialog Content */}
      <div 
        className={`relative w-full ${maxWidth} bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl p-6 z-10 animate-in fade-in zoom-in-95 duration-200 text-slate-100 max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  );
}
