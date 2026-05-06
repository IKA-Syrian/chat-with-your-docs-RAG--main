import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base — precise typography, focused-ring uses the warm accent glow
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-tight transition-[background,color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        // Primary: the warm amber. Used for the ONE clear next action on a surface.
        default:
          "bg-accent text-accent-ink shadow-[inset_0_-1px_0_oklch(var(--accent-deep)/0.35)] hover:bg-accent-hi",
        // A high-contrast filled variant in ink (used for hero CTAs in brand surfaces)
        ink:
          "bg-ink text-bg shadow-[inset_0_-1px_0_oklch(var(--ink)/0.6)] hover:bg-ink-soft",
        destructive:
          "bg-bad text-bg hover:bg-bad/90",
        // Outline: hairline, neutral. The default for secondary actions.
        outline:
          "border border-rule bg-surface text-ink hover:bg-surface-2 hover:border-rule-strong",
        secondary:
          "bg-surface-2 text-ink hover:bg-surface-2/70",
        // Ghost: no surface; great for compact toolbars and pill nav
        ghost:
          "text-ink-soft hover:text-ink hover:bg-surface-2",
        // Link: serif emphasis with an accented underline
        link:
          "text-accent-deep underline-offset-4 decoration-accent/40 hover:underline hover:decoration-accent",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6 text-[0.95rem]",
        xl: "h-12 rounded-lg px-7 text-base",
        icon: "h-9 w-9",
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
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
