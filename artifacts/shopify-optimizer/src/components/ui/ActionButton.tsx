import * as React from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, X, Sparkles, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ActionButtonStatus = "idle" | "confirming" | "loading" | "success" | "error";
type ActionButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "ai";
type ActionButtonSize = "sm" | "md" | "lg";

export interface ActionButtonProps {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  icon?: React.ReactNode;
  loadingText?: string;
  successText?: string;
  confirmMessage?: string;
  estimatedCost?: number;
  onAction: () => Promise<void>;
  disabled?: boolean;
  tooltip?: string;
  className?: string;
  children: React.ReactNode;
}

const variantStyles: Record<ActionButtonVariant, string> = {
  primary:
    "bg-[#14b8a6] text-[#0a0a0a] border border-[#14b8a6]/40 hover:bg-[#0d9488] font-semibold",
  secondary:
    "bg-transparent border border-[#334155] text-[#cbd5e1] hover:bg-[#1e293b]",
  ghost:
    "bg-transparent border-none text-[#cbd5e1] hover:text-white hover:bg-white/5",
  danger:
    "bg-[#ef4444] text-white border border-[#ef4444]/40 hover:bg-[#dc2626] font-semibold",
  ai:
    "bg-gradient-to-r from-[#14b8a6]/10 to-[#8b5cf6]/10 border border-[#8b5cf6]/40 text-[#c4b5fd] hover:border-[#8b5cf6]/70 hover:from-[#14b8a6]/20 hover:to-[#8b5cf6]/20 font-semibold",
};

const sizeStyles: Record<ActionButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-md gap-1.5",
  md: "px-4 py-2 text-sm rounded-lg gap-2",
  lg: "px-6 py-3 text-base rounded-lg gap-2.5",
};

const SLOW_THRESHOLD_MS = 5000;
const SUCCESS_DISPLAY_MS = 1500;
const ERROR_DISPLAY_MS = 1500;

export function ActionButton({
  variant = "primary",
  size = "md",
  icon,
  loadingText,
  successText,
  confirmMessage,
  estimatedCost,
  onAction,
  disabled = false,
  tooltip,
  className,
  children,
}: ActionButtonProps) {
  const [status, setStatus] = React.useState<ActionButtonStatus>("idle");
  const [isSlow, setIsSlow] = React.useState(false);
  const timersRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const mountedRef = React.useRef<boolean>(true);

  const trackTimer = React.useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  }, []);

  const clearAllTimers = React.useCallback(() => {
    for (const id of timersRef.current) clearTimeout(id);
    timersRef.current.clear();
  }, []);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const executeAction = React.useCallback(async () => {
    clearAllTimers();
    setStatus("loading");
    setIsSlow(false);

    trackTimer(() => {
      if (mountedRef.current) setIsSlow(true);
    }, SLOW_THRESHOLD_MS);

    try {
      await onAction();
      clearAllTimers();
      if (!mountedRef.current) return;
      setStatus("success");
      trackTimer(() => {
        if (mountedRef.current) {
          setStatus("idle");
          setIsSlow(false);
        }
      }, SUCCESS_DISPLAY_MS);
    } catch (err: any) {
      clearAllTimers();
      if (!mountedRef.current) return;
      const message = err?.message || "Error desconocido";
      setStatus("error");
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      trackTimer(() => {
        if (mountedRef.current) {
          setStatus("idle");
          setIsSlow(false);
        }
      }, ERROR_DISPLAY_MS);
    }
  }, [onAction, clearAllTimers, trackTimer]);

  const handleClick = React.useCallback(() => {
    if (status !== "idle") return;
    if (confirmMessage) {
      setStatus("confirming");
    } else {
      executeAction();
    }
  }, [status, confirmMessage, executeAction]);

  const handleConfirm = React.useCallback(() => {
    executeAction();
  }, [executeAction]);

  const handleCancelConfirm = React.useCallback(() => {
    setStatus("idle");
  }, []);

  const handleRetry = React.useCallback(() => {
    clearAllTimers();
    setStatus("idle");
    setTimeout(() => executeAction(), 0);
  }, [executeAction, clearAllTimers]);

  const isDisabled = disabled || status === "loading" || status === "success";

  const renderIcon = () => {
    switch (status) {
      case "loading":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "success":
        return <Check className="h-4 w-4 text-emerald-400" />;
      case "error":
        return <X className="h-4 w-4 text-red-400" />;
      default:
        if (variant === "ai" && !icon) return <Sparkles className="h-4 w-4" />;
        return icon || null;
    }
  };

  const renderText = () => {
    switch (status) {
      case "loading":
        return (
          <span className="flex flex-col items-start leading-tight">
            <span>{loadingText || children}</span>
            {isSlow && (
              <span className="text-[10px] opacity-60 mt-0.5">
                Tomando más de lo esperado...
              </span>
            )}
          </span>
        );
      case "success":
        return successText || children;
      case "error":
        return (
          <button
            type="button"
            className="cursor-pointer underline underline-offset-2 bg-transparent border-none p-0 text-inherit font-inherit"
            onClick={(e) => {
              e.stopPropagation();
              handleRetry();
            }}
            aria-label="Reintentar acción"
          >
            Reintentar
          </button>
        );
      default:
        return children;
    }
  };

  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14b8a6]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0a0a0a]",
          variantStyles[variant],
          sizeStyles[size],
          isDisabled && "opacity-60 pointer-events-none",
          status === "loading" && "opacity-85",
          status === "success" && "border-emerald-500/50 bg-emerald-500/10",
          status === "error" && "border-red-500/50 bg-red-500/10",
          className,
        )}
        disabled={isDisabled}
        onClick={handleClick}
        title={tooltip}
        aria-busy={status === "loading"}
        aria-disabled={isDisabled}
      >
        {renderIcon()}
        {renderText()}
      </button>

      <AlertDialog
        open={status === "confirming"}
        onOpenChange={(open) => {
          if (!open) handleCancelConfirm();
        }}
      >
        <AlertDialogContent className="bg-[#111318] border-[#1e293b] text-[#e2e8f0]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Confirmar acción
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#94a3b8]">
              {confirmMessage}
              {estimatedCost != null && (
                <span className="block mt-2 text-[#c4b5fd] font-medium">
                  Coste estimado: €{estimatedCost.toFixed(2)} en créditos IA
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1e293b] border-[#334155] text-[#cbd5e1] hover:bg-[#334155]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#14b8a6] text-[#0a0a0a] hover:bg-[#0d9488] font-semibold"
              onClick={handleConfirm}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ActionButton;
