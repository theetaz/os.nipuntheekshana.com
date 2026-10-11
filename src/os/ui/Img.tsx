import { forwardRef, type ImgHTMLAttributes } from 'react';
/** Structurally compatible with the P1-6 ImageSet; keeps this task independent of that file. */
export interface ImageSet { src: string; width: number; height: number; avif: string; webp: string; alt: string }
export interface ImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'width' | 'height'> { image: ImageSet }
export const Img = forwardRef<HTMLImageElement, ImgProps>(function Img({ image, alt = image.alt, loading = 'lazy', decoding = 'async', sizes = '100vw', className = '', ...props }, ref) {
  return <picture>{image.avif && <source type="image/avif" srcSet={image.avif} sizes={sizes} />}
    {image.webp && <source type="image/webp" srcSet={image.webp} sizes={sizes} />}
    <img {...props} ref={ref} src={image.src} width={image.width} height={image.height} alt={alt} loading={loading} decoding={decoding} sizes={sizes} className={`max-w-full h-auto ${className}`} />
  </picture>;
});
