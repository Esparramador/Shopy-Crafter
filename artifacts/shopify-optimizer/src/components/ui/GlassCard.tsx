import { ReactNode, memo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
  delay?: number;
  style?: React.CSSProperties;
}

export const GlassCard = memo(function GlassCard({ children, className, hoverEffect = false, delay = 0, style }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.19, 1, 0.22, 1] }}
      className={cn(
        "card rounded-2xl overflow-hidden transition-all duration-300",
        hoverEffect && "card-hover",
        className
      )}
      style={style}
    >
      {children}
    </motion.div>
  );
});
