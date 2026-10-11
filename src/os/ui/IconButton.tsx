import { forwardRef } from 'react';
import { Button, type ButtonProps } from './Button';
export interface IconButtonProps extends Omit<ButtonProps, 'size'> { 'aria-label': string }
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', className = '', style, ...props }, ref,
) { return <Button {...props} ref={ref} variant={variant} size={28} style={{ padding: 0, ...style }} className={`size-7 p-0 ${className}`} />; });
