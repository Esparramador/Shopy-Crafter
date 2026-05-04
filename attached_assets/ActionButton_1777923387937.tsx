// ============================================================
// ACTIONBUTTON - Botón unificado con estados loading/success/error
// ============================================================
//
// Reemplaza CUALQUIER <button> de la app. Maneja automáticamente:
// - Estado loading con spinner
// - Estado success (check verde 1.5s)
// - Estado error (cruz roja + mensaje)
// - Confirmación opcional con modal
// - Coste IA estimado opcional
// ============================================================

import { useState, type ReactNode } from 'react';
import { Loader2, Check, X, Sparkles, AlertTriangle } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonStatus = 'idle' | 'confirming' | 'loading' | 'success' | 'error';

interface ActionButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loadingText?: string;
  successText?: string;
  confirmMessage?: string;
  estimatedCost?: number;
  onAction: () => Promise<unknown>;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-teal-500 hover:bg-teal-400 text-slate-950 border border-teal-500',
  secondary: 'bg-transparent hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600',
  ghost: 'bg-transparent hover:bg-slate-800/50 text-slate-300 border border-transparent',
  danger: 'bg-red-500 hover:bg-red-400 text-white border border-red-500',
  ai: 'bg-gradient-to-r from-violet-500/10 to-teal-500/10 hover:from-violet-500/20 hover:to-teal-500/20 text-violet-300 border border-violet-500/40 hover:border-violet-400',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
};

export function ActionButton({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  loadingText,
  successText,
  confirmMessage,
  estimatedCost,
  onAction,
  disabled = false,
  className = '',
  fullWidth = false,
}: ActionButtonProps) {
  const [status, setStatus] = useState<ButtonStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleClick = async () => {
    if (disabled || status === 'loading') return;

    if (confirmMessage && status !== 'confirming') {
      setStatus('confirming');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      await onAction();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setErrorMessage(msg);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const handleConfirm = () => {
    setStatus('idle');
    setTimeout(() => handleClick(), 0);
  };

  const handleCancel = () => {
    setStatus('idle');
  };

  // Render del botón principal
  const buttonContent = (() => {
    if (status === 'loading') {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{loadingText || 'Procesando...'}</span>
        </>
      );
    }
    if (status === 'success') {
      return (
        <>
          <Check className="w-4 h-4 text-teal-400" />
          <span>{successText || 'Listo'}</span>
        </>
      );
    }
    if (status === 'error') {
      return (
        <>
          <X className="w-4 h-4 text-red-400" />
          <span className="truncate max-w-[180px]" title={errorMessage}>
            {errorMessage || 'Error'}
          </span>
        </>
      );
    }
    return (
      <>
        {variant === 'ai' && !icon && <Sparkles className="w-4 h-4" />}
        {icon}
        <span>{children}</span>
      </>
    );
  })();

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled || status === 'loading'}
        aria-busy={status === 'loading'}
        className={`
          inline-flex items-center justify-center gap-2 rounded-md font-medium
          transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
      >
        {buttonContent}
      </button>

      {/* Modal de confirmación */}
      {status === 'confirming' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={handleCancel}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100 mb-1">
                  Confirmar acción
                </h3>
                <p className="text-sm text-slate-400">{confirmMessage}</p>
                {estimatedCost !== undefined && estimatedCost > 0 && (
                  <p className="text-xs text-violet-300 mt-2 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    Coste IA estimado: €{estimatedCost.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-md transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm bg-teal-500 text-slate-950 font-medium rounded-md hover:bg-teal-400 transition"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
