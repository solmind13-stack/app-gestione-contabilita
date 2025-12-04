"use client";

import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function FloatingChatButton() {
  const pathname = usePathname();
  const { toast } = useToast();

  if (pathname === "/assistente-ai") {
    return null;
  }

  const handleClick = () => {
    toast({
      title: "Funzionalità in arrivo",
      description: "L'assistente chat compatto sarà presto disponibile.",
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        size="icon"
        className="rounded-full h-14 w-14 shadow-2xl"
        onClick={handleClick}
        aria-label="Apri assistente AI"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    </div>
  );
}
