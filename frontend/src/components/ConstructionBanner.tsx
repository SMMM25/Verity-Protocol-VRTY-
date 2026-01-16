/**
 * Construction Banner Component
 * Shows a dismissible banner informing users the site is under construction
 */

import { useState, useEffect } from 'react';

const BANNER_DISMISSED_KEY = 'verity_construction_banner_dismissed';
const BANNER_VERSION = '1'; // Increment to show banner again after updates

export function ConstructionBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has dismissed this version of the banner
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissed !== BANNER_VERSION) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(BANNER_DISMISSED_KEY, BANNER_VERSION);
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)',
        color: 'white',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <span style={{ fontSize: '20px' }}>🚧</span>
      <span style={{ fontSize: '14px', fontWeight: 500 }}>
        <strong>Verity Protocol is under construction</strong>
        <span style={{ opacity: 0.9, marginLeft: '8px' }}>
          — Launching Q1 2026. Some features may be incomplete.
        </span>
      </span>
      <button
        onClick={handleDismiss}
        style={{
          background: 'rgba(255, 255, 255, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '6px',
          color: 'white',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          marginLeft: '8px',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
        }}
      >
        Got it
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Close banner"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          fontSize: '20px',
          cursor: 'pointer',
          padding: '4px 8px',
          opacity: 0.7,
          transition: 'opacity 0.2s ease',
          marginLeft: '4px',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.opacity = '0.7';
        }}
      >
        ×
      </button>
    </div>
  );
}

export default ConstructionBanner;
