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
          "flex h-11 w-full rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 shadow-sm transition-[border-color,box-shadow,background-color] duration-[var(--duration-fast)] ease-[var(--easing-standard)] placeholder:text-neutral-400 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:placeholder:text-neutral-500",
          error && "border-danger-500 focus-visible:border-danger-500 focus-visible:ring-danger-500/30 animate-shake",
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
