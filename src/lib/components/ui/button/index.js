import { tv } from 'tailwind-variants';

export { default as Button } from './button.svelte';

// The same shadcn-svelte variants can style native controls with screen-specific layout.
export const buttonVariants = tv({
  base: 'select-none transition-colors disabled:opacity-50',
  variants: {
    variant: {
      default: 'rounded-lg border border-solid border-transparent bg-primary text-primary-foreground font-semibold shadow-xs hover:brightness-95',
      outline: 'rounded-lg border border-solid border-border bg-card text-foreground font-semibold shadow-xs hover:bg-muted',
      ghost: 'rounded-lg border-0 bg-transparent text-foreground hover:bg-muted',
      link: 'border-0 bg-transparent text-foreground font-semibold underline-offset-4 hover:underline'
    },
    size: {
      default: 'min-h-11 px-4 py-2',
      sm: 'min-h-9 px-3 py-1.5',
      icon: 'size-11 shrink-0 p-0',
      inline: 'px-0'
    }
  },
  defaultVariants: { variant: 'default', size: 'default' }
});
