import { forwardRef, useId, type HTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
export interface SidebarProps extends HTMLAttributes<HTMLElement> { label: string }
export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar({ label, className = '', ...props }, ref) {
  return <nav {...props} ref={ref} aria-label={label} className={`shrink-0 overflow-y-auto border-r border-line bg-sidebar p-2 ${className}`} />;
});
export interface SidebarSectionProps extends HTMLAttributes<HTMLElement> { title: string }
export const SidebarSection = forwardRef<HTMLElement, SidebarSectionProps>(function SidebarSection({ title, children, className = '', ...props }, ref) {
  const id = useId();
  return <section {...props} ref={ref} aria-labelledby={id} className={className}>
    <h2 id={id} className="pt-4 pr-3 pb-1 pl-1 text-mono-label text-ink-3">{title}</h2>{children}
  </section>;
});
export interface SidebarRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean; icon?: ReactNode; count?: number; activeWindow?: boolean;
}
export const SidebarRow = forwardRef<HTMLButtonElement, SidebarRowProps>(function SidebarRow(
  { selected, icon, count, activeWindow = true, children, className = '', ...props }, ref,
) {
  return <button {...props} ref={ref} type="button" aria-current={selected ? 'page' : undefined}
    className={`flex min-h-7 w-full items-center gap-2 rounded-menu-item px-2 text-left text-ui disabled:opacity-50 ${selected ? (activeWindow ? 'bg-accent-soft text-ink' : 'bg-selection-inactive text-ink') : 'text-ink hover:bg-hover'} ${className}`}>
    {icon && <span aria-hidden="true" className="flex size-3.5 shrink-0 items-center justify-center [&>svg]:size-3.5">{icon}</span>}
    <span className="flex-1">{children}</span>{count !== undefined && <span className="text-caption text-ink-2 tabular-nums">{count}</span>}
  </button>;
});
