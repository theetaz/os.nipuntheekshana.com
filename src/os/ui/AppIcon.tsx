import { forwardRef, useId, type SVGProps } from 'react';
import type { AppIconId } from '../types/apps';
export interface AppIconProps extends SVGProps<SVGSVGElement> { icon: AppIconId; size?: number; label?: string }
export const AppIcon = forwardRef<SVGSVGElement, AppIconProps>(function AppIcon({ icon, size = 64, label, className = '', ...props }, ref) {
  const id = useId();
  return <svg {...props} ref={ref} viewBox="0 0 64 64" width={size} height={size} focusable="false"
    role={label ? 'img' : undefined} aria-labelledby={label ? id : undefined} aria-hidden={label ? undefined : true}
    className={`shrink-0 ${className}`}>{label && <title id={id}>{label}</title>}<use href={`#${icon}`} /></svg>;
});
