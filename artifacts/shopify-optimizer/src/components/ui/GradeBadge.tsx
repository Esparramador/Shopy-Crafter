import { memo } from "react";
import { cn, getGradeColor } from "@/lib/utils";

export const GradeBadge = memo(function GradeBadge({ grade, className }: { grade?: string | null; className?: string }) {
  const displayGrade = grade || "N/A";
  
  return (
    <div className={cn(
      "inline-flex items-center justify-center font-display font-bold w-10 h-10 rounded-xl border-2",
      getGradeColor(displayGrade),
      className
    )}>
      {displayGrade}
    </div>
  );
});
