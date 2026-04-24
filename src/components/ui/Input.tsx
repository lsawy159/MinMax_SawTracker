import * as React from "react"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  /** عند تفعيله يُغيّر لون الحدود للأحمر ويُشغّل انيميشن الاهتزاز */
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        data-error={error ? "true" : undefined}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-xs transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-out)] placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:shadow-focus",
          error && "border-destructive focus-visible:shadow-[0_0_0_3px_hsl(var(--danger)/0.25)] animate-shake",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
