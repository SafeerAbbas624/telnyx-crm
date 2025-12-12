'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sun, Moon, Laptop, Palette, Check } from 'lucide-react';

const THEMES = [
  { id: 'light', name: 'Light', icon: Sun, description: 'Clean and bright' },
  { id: 'dark', name: 'Dark', icon: Moon, description: 'Easy on the eyes' },
  { id: 'system', name: 'System', icon: Laptop, description: 'Match your OS' },
];

const COLOR_SCHEMES = [
  { id: 'default', name: 'Default Blue', color: '#3b82f6', accent: '#2563eb' },
  { id: 'emerald', name: 'Emerald', color: '#10b981', accent: '#059669' },
  { id: 'violet', name: 'Violet', color: '#8b5cf6', accent: '#7c3aed' },
  { id: 'rose', name: 'Rose', color: '#f43f5e', accent: '#e11d48' },
  { id: 'orange', name: 'Orange', color: '#f97316', accent: '#ea580c' },
  { id: 'cyber', name: 'Cyber', color: '#06b6d4', accent: '#0891b2' },
];

export default function ThemeSelector() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [colorScheme, setColorScheme] = useState('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load saved color scheme
    const saved = localStorage.getItem('crm-color-scheme');
    if (saved) {
      setColorScheme(saved);
      applyColorScheme(saved);
    }
  }, []);

  const applyColorScheme = (schemeId: string) => {
    const scheme = COLOR_SCHEMES.find(s => s.id === schemeId);
    if (!scheme) return;

    const root = document.documentElement;
    
    // Convert hex to HSL for CSS variables
    const hexToHsl = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };

    const primaryHsl = hexToHsl(scheme.color);
    const accentHsl = hexToHsl(scheme.accent);
    
    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--accent', accentHsl);
    root.style.setProperty('--ring', primaryHsl);
    root.style.setProperty('--chart-1', primaryHsl);
    
    localStorage.setItem('crm-color-scheme', schemeId);
    setColorScheme(schemeId);
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="relative hover:bg-accent">
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      </Button>
    );
  }

  const currentScheme = COLOR_SCHEMES.find(s => s.id === colorScheme);
  const ThemeIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-accent">
          <ThemeIcon className="h-[1.2rem] w-[1.2rem]" />
          <div
            className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-background"
            style={{ backgroundColor: currentScheme?.color || '#3b82f6' }}
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => {
          const Icon = t.icon;
          return (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id)}
              className="cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                </div>
              </div>
              {theme === t.id && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Color Scheme
        </DropdownMenuLabel>
        <div className="px-2 py-2 grid grid-cols-3 gap-2">
          {COLOR_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              onClick={() => applyColorScheme(scheme.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-md hover:bg-accent/50 transition-colors ${
                colorScheme === scheme.id ? 'bg-accent/30 ring-1 ring-primary' : ''
              }`}
              title={scheme.name}
            >
              <div
                className="w-6 h-6 rounded-full shadow-sm"
                style={{ backgroundColor: scheme.color }}
              />
              <span className="text-[10px] font-medium">{scheme.name}</span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

