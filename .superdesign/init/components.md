# Shared UI Components

## Button — `src/components/ui/button.tsx`

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-base disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[oklch(0.40_0.18_25)] hover:shadow-md hover:shadow-primary/20",
        destructive: "bg-destructive text-white hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/20",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground hover:shadow-sm",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
        premium: "bg-gradient-to-br from-primary to-[oklch(0.45_0.20_25)] text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-px",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot.Root : "button"
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
```

## Card — `src/components/ui/card.tsx`

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva(
  "bg-card text-card-foreground flex flex-col gap-6 rounded-2xl border py-8 transition-base",
  {
    variants: {
      variant: {
        default: "shadow-sm hover:shadow-md",
        glass: "glass shadow-sm hover:shadow-md",
        elevated: "shadow-depth-2 hover:shadow-depth-3",
        interactive: "shadow-sm hover:shadow-depth-2 hover:-translate-y-px cursor-pointer",
        premium: "gradient-border shadow-depth-2 hover:shadow-depth-3 hover-glow",
        spotlight: "shadow-sm hover:shadow-md relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-b before:from-primary/5 before:to-transparent before:pointer-events-none",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

// Sub-components: Card, CardHeader (px-8), CardTitle, CardDescription, CardAction, CardContent (px-8), CardFooter (px-8)
```

## Input — `src/components/ui/input.tsx`

```tsx
const inputVariants = cva(
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none",
  {
    variants: {
      variant: {
        default: "transition-base hover:border-primary/50 focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-[3px]",
        filled: "transition-base bg-muted/50 border-transparent hover:bg-muted/70 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-[3px]",
        premium: "transition-base hover:border-primary/50 focus-visible:border-primary focus-visible:shadow-[0_0_15px_oklch(0.55_0.22_25/0.2)] focus-visible:ring-primary/20 focus-visible:ring-[3px]",
      },
    },
    defaultVariants: { variant: "default" },
  }
)
```

## Badge — `src/components/ui/badge.tsx`

```tsx
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 transition-fast overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:scale-[1.02]",
        secondary: "bg-secondary text-secondary-foreground hover:scale-[1.02]",
        destructive: "bg-destructive text-white hover:scale-[1.02]",
        outline: "border-border text-foreground hover:scale-[1.02]",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:scale-[1.02]",
        link: "text-primary underline-offset-4 hover:underline",
        gradient: "bg-gradient-to-r from-primary to-[oklch(0.65_0.18_30)] text-white hover:shadow-md hover:shadow-primary/20 hover:scale-[1.02]",
        subtle: "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 hover:scale-[1.02]",
      },
      size: {
        sm: "px-1.5 py-0 text-[10px]",
        default: "px-2 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

## Avatar — `src/components/ui/avatar.tsx`

```tsx
// Radix UI Avatar with size variants: sm (size-6), default (size-8), lg (size-10)
// Sub-components: Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount
// AvatarBadge: positioned bottom-right with ring-2 ring-background
// AvatarGroup: -space-x-2 overlapping avatars
```

## Skeleton — `src/components/ui/skeleton.tsx`

```tsx
function Skeleton({ className, ...props }) {
  return <div data-slot="skeleton" className={cn("bg-accent rounded-md animate-shimmer-premium", className)} {...props} />
}
```

## Other UI Components (shadcn/ui based)
- **Dialog** (`dialog.tsx`) — Radix Dialog with overlay + content animations
- **DropdownMenu** (`dropdown-menu.tsx`) — Radix DropdownMenu with scale-in animation
- **Sheet** (`sheet.tsx`) — Radix Dialog for mobile drawer
- **Popover** (`popover.tsx`) — Radix Popover
- **Tabs** (`tabs.tsx`) — Radix Tabs
- **Select** (`select.tsx`) — Radix Select
- **Textarea** (`textarea.tsx`) — Standard textarea
- **Separator** (`separator.tsx`) — Horizontal/vertical separator
- **ScrollArea** (`scroll-area.tsx`) — Radix ScrollArea
- **Label** (`label.tsx`) — Form label
- **Switch** (`switch.tsx`) — Toggle switch
- **Sonner** (`sonner.tsx`) — Toast notifications
- **Form** (`form.tsx`) — React Hook Form integration
- **AlertDialog** (`alert-dialog.tsx`) — Confirmation dialogs
- **Command** (`command.tsx`) — Command palette (cmdk)
- **CitySelector** (`city-selector.tsx`) — Brazilian city selector with IBGE API
