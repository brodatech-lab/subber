import type { ButtonHTMLAttributes, FC } from 'react'
import { tv, type VariantProps } from 'tailwind-variants'

const button = tv({
  base: 'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[background-color,transform,opacity] duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/70 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
  variants: {
    intent: {
      primary: 'bg-brand text-on-brand hover:bg-brand-strong',
      secondary: 'bg-surface-raised text-foreground hover:bg-surface-hover',
      ghost: 'text-muted hover:bg-surface-hover hover:text-foreground',
      danger: 'text-danger hover:bg-danger/10',
    },
    size: {
      sm: 'h-7 px-2.5 text-xs',
      md: 'h-8 px-3 text-[13px]',
      lg: 'h-10 px-5 text-sm',
      icon: 'size-8',
    },
    active: { true: 'bg-surface-hover text-foreground' },
    full: { true: 'w-full' },
  },
  defaultVariants: { intent: 'secondary', size: 'md' },
})

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>

export const Button: FC<ButtonProps> = ({ intent, size, active, full, className, type = 'button', ...rest }) => (
  <button type={type} className={button({ intent, size, active, full, class: className })} {...rest} />
)
