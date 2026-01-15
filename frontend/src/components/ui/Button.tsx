import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ElementType;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantStyles = {
  primary: `
    bg-gradient-to-r from-violet-600 to-indigo-600 
    hover:from-violet-500 hover:to-indigo-500 
    text-white shadow-lg shadow-violet-500/25 
    hover:shadow-violet-500/40 hover:scale-105
    active:scale-100
  `,
  secondary: `
    bg-slate-700 hover:bg-slate-600 
    text-white border border-slate-600
    hover:border-slate-500
  `,
  outline: `
    bg-transparent border border-white/20 
    text-white hover:bg-white/10 
    hover:border-white/30
  `,
  ghost: `
    bg-transparent text-white/70 
    hover:text-white hover:bg-white/10
  `,
  danger: `
    bg-gradient-to-r from-red-600 to-red-500 
    hover:from-red-500 hover:to-red-400 
    text-white shadow-lg shadow-red-500/25 
    hover:shadow-red-500/40 hover:scale-105
    active:scale-100
  `,
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}, ref) => {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-medium rounded-xl
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className={iconSizes[size]} />}
          {children}
          {Icon && iconPosition === 'right' && <Icon className={iconSizes[size]} />}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

// Icon-only button variant
interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'iconPosition'> {
  icon: React.ElementType;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(({
  variant = 'ghost',
  size = 'md',
  icon: Icon,
  className = '',
  ...props
}, ref) => {
  const iconOnlySizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center rounded-xl
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${iconOnlySizes[size]}
        ${className}
      `}
      {...props}
    >
      <Icon className={iconSizes[size]} />
    </button>
  );
});

IconButton.displayName = 'IconButton';

export default Button;
