/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "touch-feedback inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-[transform,background-color,border-color,color,opacity,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)] disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:shadow-focus active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm",
        secondary: "bg-secondary text-foreground shadow-xs",
        outline: "border border-border bg-surface text-foreground",
        ghost: "text-foreground",
        destructive: "bg-danger text-white shadow-sm",
        success: "bg-success text-white shadow-sm",
        warning: "bg-warning text-white shadow-sm",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-sm px-3 text-xs",
        lg: "h-12 rounded-lg px-6",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          "data-[state=open]:bg-primary/90",
          "motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md",
          "hover:bg-primary-hover",
          variant === "secondary" && "hover:bg-muted",
          variant === "outline" && "hover:bg-muted",
          variant === "ghost" && "hover:bg-muted",
          variant === "destructive" && "hover:brightness-95",
          variant === "success" && "hover:brightness-95",
          variant === "warning" && "hover:brightness-95"
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
