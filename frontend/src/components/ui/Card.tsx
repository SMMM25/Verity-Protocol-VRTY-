import { forwardRef } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'bordered' | 'elevated';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const variantStyles = {
  default: 'bg-slate-800 border-slate-700',
  glass: 'bg-white/5 backdrop-blur-xl border-white/10',
  bordered: 'bg-transparent border-slate-600',
  elevated: 'bg-slate-800 border-slate-700 shadow-lg shadow-black/20',
};

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(({ 
  variant = 'default',
  hover = false,
  padding = 'md',
  className = '',
  children,
  onClick,
  ...props 
}, ref) => {
  const isClickable = !!onClick || hover;

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`
        rounded-xl border transition-all duration-300
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${isClickable ? 'cursor-pointer hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10 hover:-translate-y-0.5' : ''}
        ${onClick ? 'active:scale-[0.99]' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(({ 
  className = '', 
  children, 
  ...props 
}, ref) => (
  <div ref={ref} className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
));

CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(({ 
  className = '', 
  children, 
  ...props 
}, ref) => (
  <h3 ref={ref} className={`text-lg font-semibold text-white ${className}`} {...props}>
    {children}
  </h3>
));

CardTitle.displayName = 'CardTitle';

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(({ 
  className = '', 
  children, 
  ...props 
}, ref) => (
  <p ref={ref} className={`text-sm text-white/60 ${className}`} {...props}>
    {children}
  </p>
));

CardDescription.displayName = 'CardDescription';

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(({ 
  className = '', 
  children, 
  ...props 
}, ref) => (
  <div ref={ref} className={className} {...props}>
    {children}
  </div>
));

CardContent.displayName = 'CardContent';

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(({ 
  className = '', 
  children, 
  ...props 
}, ref) => (
  <div ref={ref} className={`mt-4 pt-4 border-t border-slate-700 ${className}`} {...props}>
    {children}
  </div>
));

CardFooter.displayName = 'CardFooter';

export default Card;
