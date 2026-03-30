import React from "react";

type Variant = "default" | "warning" | "danger" | "success";

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-slate-700 text-slate-200",
  warning: "bg-amber-900/60 text-amber-200",
  danger: "bg-red-900/60 text-red-200",
  success: "bg-emerald-900/60 text-emerald-200",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
