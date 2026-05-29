import React from "react";
import { useSendSos } from "@workspace/api-client-react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export function SosButton() {
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();
  const sendSos = useSendSos();

  const handleSend = async () => {
    try {
      const res = await sendSos.mutateAsync({ data: {} });
      toast({
        title: "SOS sent",
        description:
          res.notified > 0
            ? `Alerted ${res.notified} friend${res.notified === 1 ? "" : "s"} with your location.`
            : "No friends to alert yet. Add friends so they can help in an emergency.",
      });
      setOpen(false);
    } catch {
      toast({ title: "Could not send SOS", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          aria-label="Send emergency SOS"
          className="flex items-center justify-center w-12 h-12 rounded-full bg-red-600 text-white shadow-lg shadow-red-600/40 ring-2 ring-white/70 active:scale-95 transition-transform"
        >
          <AlertTriangle className="w-6 h-6" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send emergency SOS?</AlertDialogTitle>
          <AlertDialogDescription>
            This will instantly alert your friends with your last known location so they can help. Only use this in a real emergency.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {sendSos.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Send SOS"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
