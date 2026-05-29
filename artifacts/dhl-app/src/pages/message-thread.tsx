import React, { useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useGetConversationMessages, useSendMessage, getGetConversationMessagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import { format } from "date-fns";
import { useGetMe } from "@workspace/api-client-react";

export function MessageThreadPage() {
  const { id } = useParams<{ id: string }>();
  const convId = parseInt(id);
  const { data: messages, isLoading } = useGetConversationMessages(convId, { query: { enabled: !!convId, refetchInterval: 5000 } });
  const { data: me } = useGetMe();
  const sendMessage = useSendMessage();
  const [text, setText] = React.useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    sendMessage.mutate({
      data: {
        conversationId: convId,
        content: text.trim()
      }
    }, {
      onSuccess: () => {
        setText("");
        queryClient.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(convId) });
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-background relative z-50">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card shadow-sm shrink-0">
        <Link href="/messages">
          <Button size="icon" variant="ghost" className="h-8 w-8 -ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted border border-border" />
          <div>
            <h2 className="font-semibold text-sm">Conversation</h2>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col-reverse" ref={scrollRef}>
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-4">Loading messages...</div>
          ) : messages?.length ? (
            messages.map(msg => {
              const isMe = msg.senderId === me?.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] ${
                    isMe 
                      ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                      : 'bg-muted/80 text-foreground rounded-tl-sm border border-border/50'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 mx-1">
                    {format(new Date(msg.createdAt), 'h:mm a')}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-center text-muted-foreground text-sm py-10">
              No messages yet. Send the first message!
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 bg-card border-t border-border shrink-0 pb-safe">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Input 
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message..."
              className="pr-10 bg-muted/50 border-transparent rounded-full h-11 focus-visible:ring-1"
            />
          </div>
          <Button 
            type="submit" 
            size="icon" 
            disabled={!text.trim() || sendMessage.isPending}
            className="h-11 w-11 rounded-full shrink-0 shadow-sm"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
