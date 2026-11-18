import {
  ArrowDown,
  ArrowDownCircle,
  ArrowLeft,
  ArrowLeftCircle,
  ArrowRight,
  ArrowRightCircle,
  ArrowUp,
  ArrowUpCircle,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  Eye,
  Film,
  Focus,
  Hand,
  MoveRight,
  Orbit,
  Package,
  Plane,
  RefreshCw,
  RotateCw,
  Smartphone,
  Square,
  Sunrise,
  Zap,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import type { AspectRatio } from '@/types';

/** Joins class names, skipping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Lucide icons by name. Presets and templates store the icon as a string (see types);
 * an explicit map keeps the bundle small instead of importing every icon.
 */
const ICONS: Record<string, LucideIcon> = {
  ArrowDown,
  ArrowDownCircle,
  ArrowLeft,
  ArrowLeftCircle,
  ArrowRight,
  ArrowRightCircle,
  ArrowUp,
  ArrowUpCircle,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  Eye,
  Film,
  Focus,
  Hand,
  MoveRight,
  Orbit,
  Package,
  Plane,
  RefreshCw,
  RotateCw,
  Smartphone,
  Square,
  Sunrise,
  Zap,
  ZoomIn,
  ZoomOut,
};

export function getIcon(name: string | undefined): LucideIcon {
  return (name && ICONS[name]) || Square;
}

export function formatAperture(f: number): string {
  return `f/${Number.isInteger(f) ? f.toFixed(0) : f.toFixed(1)}`;
}

/** "16:9" → [16, 9] */
export function aspectParts(ratio: AspectRatio): [number, number] {
  const [w, h] = ratio.split(':').map(Number);
  return [w ?? 16, h ?? 9];
}

/**
 * Arrow-key movement inside a radio group (roving focus): returns the index to select, or null.
 */
export function rovingIndex(key: string, index: number, count: number): number | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/** A random id that also works on plain http (where crypto.randomUUID is unavailable). */
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
