/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "touch-feedback inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-medium transition-[transform,background-color,border-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)] focus:outline-none focus:shadow-focus",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary-subtle text-foreground",
        neutral: "border-border bg-muted text-foreground",
        success: "border-transparent bg-success-subtle text-success-foreground",
        warning: "border-transparent bg-warning-subtle text-warning-foreground",
        danger: "border-transparent bg-danger-subtle text-danger-foreground",
        info: "border-transparent bg-info-subtle text-info-foreground",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
