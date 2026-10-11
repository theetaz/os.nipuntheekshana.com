import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> { label: string }
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { label, className = '', id: suppliedId, ...props }, ref,
) {
  const id = useId();
  return <label htmlFor={suppliedId ?? id} className={`relative inline-flex items-center ${className}`}>
    <span className="sr-only">{label}</span><Search aria-hidden="true" size={14} className="pointer-events-none absolute left-2 text-ink-3" />
    <input {...props} ref={ref} id={suppliedId ?? id} type="search" data-os-shortcuts="allow"
      className="h-7 w-full min-w-0 rounded-control border border-line-strong bg-raised pr-2 pl-7 text-ui placeholder:text-ink-3" />
  </label>;
});
