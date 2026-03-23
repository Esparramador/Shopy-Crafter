import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
  delay?: number;
}

export function GlassCard({ children, className, hoverEffect = false, delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.19, 1, 0.22, 1] }}
      className={cn(
        "glass rounded-2xl overflow-hidden transition-all duration-300",
        hoverEffect && "hover:border-primary/30 hover:shadow-primary/10 hover:-translate-y-1",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
