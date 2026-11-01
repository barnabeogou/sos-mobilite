import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface FieldWrapProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  id: string;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}

function FieldWrap({ label, hint, error, id, children, className, optional }: FieldWrapProps) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium text-silver-200">
          <span>{label}</span>
          {optional && <span className="text-xs font-normal text-silver-500">facultatif</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-alert-400">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-silver-500">{hint}</p>
      ) : null}
    </div>
  );
}

type Common = { label?: ReactNode; hint?: ReactNode; error?: string; wrapClassName?: string; optional?: boolean };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Common & { suffix?: ReactNode }>(
  function Input({ label, hint, error, wrapClassName, optional, className, id, suffix, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <FieldWrap label={label} hint={hint} error={error} id={fid} className={wrapClassName} optional={optional}>
        <div className="relative">
          <input
            ref={ref}
            id={fid}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${fid}-error` : undefined}
            className={clsx('field-input', error && 'border-alert-500/70', suffix && 'pr-16', className)}
            {...rest}
          />
          {suffix && (
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-silver-400">{suffix}</span>
          )}
        </div>
      </FieldWrap>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Common>(function Textarea(
  { label, hint, error, wrapClassName, optional, className, id, rows = 3, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap label={label} hint={hint} error={error} id={fid} className={wrapClassName} optional={optional}>
      <textarea
        ref={ref}
        id={fid}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={clsx('field-input resize-none', error && 'border-alert-500/70', className)}
        {...rest}
      />
    </FieldWrap>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Common>(function Select(
  { label, hint, error, wrapClassName, optional, className, id, children, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap label={label} hint={hint} error={error} id={fid} className={wrapClassName} optional={optional}>
      <select
        ref={ref}
        id={fid}
        aria-invalid={Boolean(error)}
        className={clsx('field-input appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23A7B0BD' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...rest}
      >
        {children}
      </select>
    </FieldWrap>
  );
});

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string }>(
  function Checkbox({ label, error, ...rest }, ref) {
    const id = useId();
    return (
      <div className="space-y-1">
        <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-silver-200">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md border-white/20 bg-night-950 accent-electric-500"
            {...rest}
          />
          <span>{label}</span>
        </label>
        {error && <p className="pl-8 text-xs text-alert-400">{error}</p>}
      </div>
    );
  },
);
