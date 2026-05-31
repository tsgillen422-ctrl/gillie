import React from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import type { CropArea } from "@/lib/cropImage";

interface ImageCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  aspect: number;
  cropShape?: "rect" | "round";
  title?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (croppedAreaPixels: CropArea) => void;
}

export function ImageCropDialog({
  open,
  imageSrc,
  aspect,
  cropShape = "rect",
  title = "Adjust photo",
  busy = false,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [areaPixels, setAreaPixels] = React.useState<CropArea | null>(null);

  // Reset position/zoom whenever a new image is loaded in.
  React.useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setAreaPixels(null);
    }
  }, [open, imageSrc]);

  const handleConfirm = () => {
    if (areaPixels) onConfirm(areaPixels);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Drag to reposition and use the slider to zoom.</DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-72 bg-muted">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={cropShape === "rect"}
              restrictPosition
              minZoom={1}
              maxZoom={4}
              zoomSpeed={0.2}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPx) => setAreaPixels(areaPx)}
            />
          )}
        </div>

        <div className="flex items-center gap-3 p-4">
          <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
          <Slider
            value={[zoom]}
            min={1}
            max={4}
            step={0.01}
            onValueChange={(v) => setZoom(v[0])}
            aria-label="Zoom"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>

        <DialogFooter className="p-4 pt-0 gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy || !areaPixels}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
