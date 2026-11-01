import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { NotConfigured } from '@/components/layout/Guards';
import { env } from '@/config/env';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  if (!env.isSupabaseConfigured) return <NotConfigured />;
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-8 sm:justify-center">
      <Link to="/" className="mb-8">
        <BrandLogo />
      </Link>
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-silver-400">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-center text-sm text-silver-400">{footer}</div>}
    </div>
  );
}
