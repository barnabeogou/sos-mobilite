import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'sos' | 'success';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition select-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]';

const variants: Record<Variant, string> = {
  primary: 'bg-electric-500 text-white shadow-glow hover:bg-electric-400',
  secondary: 'border border-white/10 bg-night-800 text-white hover:border-electric-500/50 hover:bg-night-700',
  ghost: 'text-silver-200 hover:bg-white/5 hover:text-white',
  danger: 'border border-alert-500/40 bg-alert-500/10 text-alert-400 hover:bg-alert-500/20',
  sos: 'bg-alert-500 text-white hover:bg-alert-400 shadow-[0_10px_30px_-10px_rgba(227,6,19,0.8)]',
  success: 'bg-emerald-500 text-night-950 hover:bg-emerald-400',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[15px]',
  lg: 'h-14 px-6 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(base, variants[variant], sizes[size], block && 'w-full', className)}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  block,
  className,
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; icon?: ReactNode; block?: boolean }) {
  return (
    <Link className={clsx(base, variants[variant], sizes[size], block && 'w-full', className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/** Lien externe / tel: / wa.me avec l'apparence d'un bouton. */
export function AnchorButton({
  variant = 'secondary',
  size = 'md',
  icon,
  block,
  className,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size; icon?: ReactNode; block?: boolean }) {
  return (
    <a className={clsx(base, variants[variant], sizes[size], block && 'w-full', className)} {...rest}>
      {icon}
      {children}
    </a>
  );
}
