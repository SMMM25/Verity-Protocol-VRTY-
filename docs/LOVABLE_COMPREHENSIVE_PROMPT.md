# Lovable.dev Comprehensive UI Polish Prompt

## Project: Verity Protocol Frontend
**Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons

---

## TASK 1: Shared UI Component Library

Create a `/components/ui/` folder with reusable, consistent components.

### 1.1 Create StatusBadge Component

```tsx
// /components/ui/StatusBadge.tsx
// Create a reusable status badge with these variants:
// - success (green): ACTIVE, COMPLIANT, COMPLETED, VERIFIED
// - warning (yellow/amber): PENDING, PENDING_REVIEW, PROCESSING
// - error (red): FAILED, NON_COMPLIANT, FROZEN, SUSPENDED
// - info (blue): UNDER_REVIEW, IN_PROGRESS
// - neutral (gray): CANCELLED, INACTIVE

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  pulse?: boolean; // for active/processing states
}

// Features:
// - Auto-detect variant from status string
// - Optional icon (checkmark, warning, x, etc.)
// - Pulse animation for processing states
// - Consistent padding, font size, border-radius
```

### 1.2 Create StatCard Component

```tsx
// /components/ui/StatCard.tsx
// Reusable stat card matching the Landing page style

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  color?: 'blue' | 'green' | 'red' | 'purple' | 'indigo';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

// Features:
// - Gradient icon backgrounds
// - Optional trend indicator with arrow
// - Loading skeleton state
// - Hover effect with subtle glow
// - Glass morphism background
```

### 1.3 Create Card Component

```tsx
// /components/ui/Card.tsx
interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'bordered' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
}

// Styles:
// - default: bg-slate-800 border-slate-700
// - glass: bg-white/5 backdrop-blur-xl border-white/10
// - bordered: transparent bg with prominent border
// - elevated: with shadow-lg
// - hover: hover:border-violet-500/50 hover:shadow-violet-500/10
```

### 1.4 Create Button Component

```tsx
// /components/ui/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ElementType;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

// Primary: gradient from-violet-600 to-indigo-600
// Secondary: bg-slate-700 hover:bg-slate-600
// Outline: border-white/20 bg-transparent
// Ghost: no border, subtle hover
// Danger: from-red-600 to-red-500

// All buttons need:
// - focus:ring-2 focus:ring-violet-500
// - transition-all duration-200
// - hover:scale-105 on primary/danger
```

### 1.5 Create Modal Component

```tsx
// /components/ui/Modal.tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
}

// Features:
// - Backdrop blur and fade animation
// - Slide-up animation for modal content
// - Close on Escape key
// - Close on backdrop click (optional)
// - Focus trap for accessibility
// - Smooth enter/exit transitions using CSS
```

### 1.6 Create Tabs Component

```tsx
// /components/ui/Tabs.tsx
interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;
  badge?: string | number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'pills' | 'underline' | 'boxed';
}

// Underline variant: border-b with active indicator slide
// Pills variant: rounded-full bg buttons
// Boxed variant: connected rectangular tabs
```

---

## TASK 2: Dashboard Page Polish

### 2.1 TaxDashboard.tsx Improvements

**File:** `/pages/TaxDashboard.tsx`

```tsx
// Changes needed:
1. Replace inline StatCard with shared component
2. Add loading skeleton states (not just spinner)
3. Add page header with gradient text like Landing
4. Add subtle entrance animations (staggered fade-in)
5. Improve empty state design with illustration
6. Add hover effects on action cards
```

**Specific Changes:**
```tsx
// Before:
<div className="bg-slate-800 rounded-xl p-6 border border-slate-700">

// After:
<Card variant="glass" hover>
  <CardContent className="p-6">
    ...
  </CardContent>
</Card>

// Add page header:
<div className="mb-8">
  <h1 className="text-3xl font-bold text-white">
    Tax <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Dashboard</span>
  </h1>
  <p className="text-white/60 mt-2">Track your crypto taxes across 200+ jurisdictions</p>
</div>
```

### 2.2 TradingDashboard.tsx Improvements

**File:** `/pages/TradingDashboard.tsx`

```tsx
// Changes needed:
1. Add real-time price ticker animation
2. Improve order book row hover effects
3. Add depth visualization bars behind prices
4. Improve buy/sell form with better validation UX
5. Add trade confirmation modal
6. Add price alert animation when price changes
```

**Order Book Enhancement:**
```tsx
// Add depth bar behind each row
<div className="relative">
  <div 
    className="absolute inset-y-0 right-0 bg-green-500/10"
    style={{ width: `${(total / maxTotal) * 100}%` }}
  />
  <div className="relative grid grid-cols-3 py-1.5 px-2">
    {/* price, amount, total */}
  </div>
</div>
```

### 2.3 GuildDashboard.tsx Improvements

**File:** `/pages/GuildDashboard.tsx`

```tsx
// Changes needed:
1. Add guild card hover lift effect
2. Add member avatars preview (stacked circles)
3. Add gradient border on hover
4. Improve search with instant filtering animation
5. Add "Create Guild" modal with step indicator
6. Add guild activity sparkline in cards
```

### 2.4 AssetsDashboard.tsx Improvements

**File:** `/pages/AssetsDashboard.tsx`

```tsx
// Changes needed:
1. Add asset image lazy loading with blur placeholder
2. Add skeleton loading for asset cards
3. Improve purchase modal with step progress
4. Add confetti animation on successful purchase
5. Add price change flash animation
6. Improve dividend timeline with connecting lines
7. Add compliance status tooltips
```

**Image Loading:**
```tsx
// Add blur-up image loading
const [imageLoaded, setImageLoaded] = useState(false);

<div className="relative aspect-video overflow-hidden rounded-lg">
  {!imageLoaded && (
    <div className="absolute inset-0 bg-slate-700 animate-pulse" />
  )}
  <img 
    src={asset.image}
    alt={asset.name}
    className={`w-full h-full object-cover transition-opacity duration-300 ${
      imageLoaded ? 'opacity-100' : 'opacity-0'
    }`}
    onLoad={() => setImageLoaded(true)}
    loading="lazy"
  />
</div>
```

### 2.5 SentinelDashboard.tsx Improvements

**File:** `/pages/SentinelDashboard.tsx`

```tsx
// Changes needed:
1. Add alert priority color coding (critical = red pulse)
2. Add risk score gauge visualization
3. Add alert sound toggle
4. Improve timeline with animated connecting line
5. Add "Resolve" confirmation modal
6. Add filtering with animated chip removal
```

### 2.6 BridgeDashboard.tsx Improvements

**File:** `/pages/BridgeDashboard.tsx`

```tsx
// Changes needed:
1. Add network selection with chain logos
2. Add animated bridge visualization (coins moving)
3. Add estimated time countdown
4. Add transaction status stepper
5. Improve fee breakdown tooltip
6. Add successful bridge celebration animation
```

---

## TASK 3: Layout.tsx Improvements

**File:** `/components/Layout.tsx`

```tsx
// Changes needed:
1. Add collapsible sidebar (hamburger on mobile)
2. Add active route highlight animation
3. Add notification badge on nav items
4. Add user avatar/wallet display in header
5. Add dark/light mode toggle (optional)
6. Add breadcrumb navigation
7. Improve mobile responsive drawer
```

**Mobile Sidebar:**
```tsx
// Add mobile menu button and slide-out drawer
const [sidebarOpen, setSidebarOpen] = useState(false);

// Mobile: hidden sidebar with overlay
// Desktop: always visible
<aside className={`
  fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 transform transition-transform duration-300 lg:relative lg:translate-x-0
  ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
`}>
```

---

## TASK 4: Global Styles & Animations

### 4.1 Add to `/index.css`:

```css
/* Smooth page transitions */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(139, 92, 246, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.8);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.5s ease-out forwards;
}

.animate-slide-in-right {
  animation: slideInRight 0.3s ease-out forwards;
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

/* Stagger children animations */
.stagger-children > * {
  opacity: 0;
  animation: fadeInUp 0.5s ease-out forwards;
}

.stagger-children > *:nth-child(1) { animation-delay: 0.1s; }
.stagger-children > *:nth-child(2) { animation-delay: 0.2s; }
.stagger-children > *:nth-child(3) { animation-delay: 0.3s; }
.stagger-children > *:nth-child(4) { animation-delay: 0.4s; }
.stagger-children > *:nth-child(5) { animation-delay: 0.5s; }
.stagger-children > *:nth-child(6) { animation-delay: 0.6s; }

/* Glass morphism utility */
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Gradient text utility */
.gradient-text {
  background: linear-gradient(to right, #a78bfa, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### 4.2 Add to `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        verity: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
};
```

---

## TASK 5: Accessibility Improvements

Apply these across ALL components:

```tsx
// 1. Focus states on all interactive elements
className="focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900"

// 2. aria-labels on icon-only buttons
<button aria-label="Close modal" className="...">
  <X className="w-5 h-5" />
</button>

// 3. Keyboard navigation
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    handleClick();
  }
}}

// 4. Screen reader only text
<span className="sr-only">Loading...</span>

// 5. Color contrast - ensure all text has 4.5:1 ratio
// Use text-white/80 minimum, not text-white/40
```

---

## TASK 6: Loading States

Create consistent loading skeletons:

```tsx
// /components/ui/Skeleton.tsx
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-700 rounded ${className}`} />
  );
}

// Usage examples:
<Skeleton className="h-4 w-32" /> // Text line
<Skeleton className="h-10 w-full" /> // Input
<Skeleton className="h-32 w-full rounded-xl" /> // Card
<Skeleton className="h-12 w-12 rounded-full" /> // Avatar

// Card skeleton
export function CardSkeleton() {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <Skeleton className="h-6 w-1/3 mb-4" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
```

---

## Priority Order

1. **HIGH**: Shared UI components (StatusBadge, Card, Button, Modal)
2. **HIGH**: Layout.tsx mobile responsive
3. **MEDIUM**: Dashboard page headers with gradient text
4. **MEDIUM**: Loading skeletons across all pages
5. **MEDIUM**: Animation utilities in CSS
6. **LOW**: Confetti/celebration animations
7. **LOW**: Sound effects toggle

---

## Testing Checklist

After implementing, verify:

- [ ] All pages load without console errors
- [ ] Mobile responsive at 375px, 768px, 1024px, 1440px
- [ ] Keyboard navigation works (Tab through all elements)
- [ ] Focus states visible on all interactive elements
- [ ] Loading states show before data loads
- [ ] Animations are smooth (no jank)
- [ ] Dark mode colors consistent
- [ ] TypeScript compiles without errors
- [ ] `npm run build` succeeds

---

## Files to Create/Modify

**New Files:**
- `/components/ui/StatusBadge.tsx`
- `/components/ui/StatCard.tsx`
- `/components/ui/Card.tsx`
- `/components/ui/Button.tsx`
- `/components/ui/Modal.tsx`
- `/components/ui/Tabs.tsx`
- `/components/ui/Skeleton.tsx`
- `/components/ui/index.ts` (barrel export)

**Modify:**
- `/components/Layout.tsx` - Mobile responsive
- `/pages/TaxDashboard.tsx` - Use shared components
- `/pages/TradingDashboard.tsx` - Order book improvements
- `/pages/GuildDashboard.tsx` - Card hover effects
- `/pages/AssetsDashboard.tsx` - Image loading, modals
- `/pages/SentinelDashboard.tsx` - Alert styling
- `/pages/BridgeDashboard.tsx` - Bridge visualization
- `/index.css` - Animation utilities
- `/tailwind.config.js` - Custom theme

---

*Generated: 2026-01-14*
*For: Lovable.dev AI*
*Project: Verity Protocol*
