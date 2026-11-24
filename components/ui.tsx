'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export function Button({ className, variant = 'primary', size = 'md', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; size?: 'sm' | 'md' }) {
  const variants = { primary: 'button', secondary: 'button button-secondary', quiet: 'button button-quiet', danger: 'button' };
  return <button className={cn(variants[variant], size === 'sm' && 'button-small', variant === 'danger' && 'bg-red-700 hover:bg-red-800', className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn('card', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('card-title', className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-header', className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-[11px] font-bold text-slate-700', className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('textarea', className)} {...props} />;
}

export function Badge({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red'; className?: string }) {
  return <span className={cn('tag', tone === 'green' && 'tag-green', tone === 'amber' && 'tag-amber', tone === 'red' && 'tag-red', className)}>{children}</span>;
}

export function StatusMessage({ children, kind = 'error' }: { children: React.ReactNode; kind?: 'error' | 'success' }) {
  return <div className={kind === 'success' ? 'alert-success' : 'alert-error'} role="status">{children}</div>;
}
