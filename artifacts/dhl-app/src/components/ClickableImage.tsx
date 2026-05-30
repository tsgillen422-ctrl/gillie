import React from "react";
import { ImageLightbox } from "./ImageLightbox";

type ClickableImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt?: string;
};

export function ClickableImage({ src, alt = "", className, onClick, ...rest }: ClickableImageProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <img
        {...rest}
        src={src}
        alt={alt}
        role="button"
        tabIndex={0}
        aria-label={alt ? `View ${alt}` : "View photo"}
        className={`${className ?? ""} cursor-zoom-in`}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
      />
      <ImageLightbox src={src} alt={alt} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
