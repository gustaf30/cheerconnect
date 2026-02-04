import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "transition-all duration-200 hover:border-primary/50 focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-[3px] dark:bg-input/30",
        filled: "bg-muted/50 border-transparent hover:bg-muted/70 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-[3px] transition-all duration-200",
        premium: "transition-all duration-300 hover:border-primary/50 focus-visible:border-primary focus-visible:shadow-[0_0_15px_oklch(0.55_0.22_25/0.2)] focus-visible:ring-primary/20 focus-visible:ring-[3px] dark:bg-input/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Input({
  className,
  type,
  variant,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Input, inputVariants }
