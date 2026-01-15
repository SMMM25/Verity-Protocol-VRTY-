/**
 * Card Component
 * Polished with Lovable.dev patterns - clean glass morphism effects
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
  glass?: boolean;
}

export function Card({ 
  children, 
  hover = false, 
  glass = false, 
  className,
  ...props 
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-6 transition-all duration-300',
        glass
          ? 'bg-white/5 backdrop-blur-xl border-white/10'
          : 'bg-slate-800 border-slate-700',
        hover && 'hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  );
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function CardTitle({ children, className, ...props }: CardTitleProps) {
  return (
    <h3 className={cn('text-lg font-semibold text-white', className)} {...props}>
      {children}
    </h3>
  );
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function CardDescription({ children, className, ...props }: CardDescriptionProps) {
  return (
    <p className={cn('text-sm text-slate-400 mt-1', className)} {...props}>
      {children}
    </p>
  );
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardContent({ children, className, ...props }: CardContentProps) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardFooter({ children, className, ...props }: CardFooterProps) {
  return (
    <div className={cn('mt-4 pt-4 border-t border-slate-700', className)} {...props}>
      {children}
    </div>
  );
}

export default Card;
