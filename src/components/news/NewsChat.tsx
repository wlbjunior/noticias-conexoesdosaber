import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center p-2">
      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function BotAvatar({ isAnimating }: { isAnimating?: boolean }) {
  return (
    <div className={cn(
      "w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-lg",
      isAnimating && "animate-pulse-soft"
    )}>
      <Sparkles className={cn(
        "w-4 h-4 text-primary-foreground",
        isAnimating && "animate-spin"
      )} style={{ animationDuration: '2s' }} />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary to-muted flex items-center justify-center shrink-0 shadow-sm">
      <span className="text-xs font-semibold text-secondary-foreground">Eu</span>
    </div>
  );
}

export function NewsChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const renderMessageContent = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={`link-${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="underline break-all text-primary hover:text-primary/80 transition-colors"
          >
            Clique aqui para ver a notícia
          </a>
        );
      }
      return part ? <span key={`text-${index}`}>{part}</span> : null;
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("news-chat", {
        body: { messages: [...messages, userMessage] },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response || "Desculpe, não consegui processar sua pergunta.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("[NewsChat] Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Desculpe, ocorreu um erro. Tente novamente.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        <Button
          onClick={() => setIsOpen(true)}
          className={cn(
            "h-14 w-14 rounded-full shadow-xl",
            "bg-gradient-to-br from-primary to-primary/80",
            "hover:scale-110 hover:shadow-2xl",
            "transition-all duration-300",
            "animate-glow"
          )}
          size="icon"
          aria-label="Abrir chat de notícias"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
        {/* Tooltip abaixo do botão */}
        <div className="bg-card border border-border/50 rounded-lg px-3 py-2 shadow-lg animate-fade-in text-sm max-w-[200px] pointer-events-none">
          <p className="text-xs text-muted-foreground">💡 Pergunte sobre as notícias!</p>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(
      "fixed bottom-6 right-6 w-[380px] h-[520px] z-50",
      "flex flex-col overflow-hidden",
      "border-border/50 shadow-2xl",
      "animate-scale-in",
      "bg-gradient-to-b from-card to-card/95 backdrop-blur-xl"
    )}>
      {/* Header com gradiente */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardTitle className="text-base flex items-center gap-3">
          <BotAvatar />
          <div>
            <span className="font-semibold">Assistente de Notícias</span>
            <p className="text-xs text-muted-foreground font-normal">Online</p>
          </div>
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
          onClick={() => setIsOpen(false)}
          aria-label="Fechar chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="text-center py-8 animate-fade-in">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary animate-pulse-soft" />
              </div>
              <p className="text-sm font-medium mb-2">
                Olá! Sou seu assistente de notícias.
              </p>
              <p className="text-xs text-muted-foreground max-w-[250px] mx-auto">
                Posso ajudar você a encontrar e entender notícias sobre Mitologia, Filosofia, Religião, Artes e Psicologia.
              </p>
              {/* Sugestões rápidas */}
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {["Últimas notícias", "Sobre filosofia", "O que há de novo?"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                    }}
                    className="px-3 py-1.5 text-xs rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-2 animate-slide-up",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {message.role === "assistant" && <BotAvatar />}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl p-3 text-sm shadow-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  {renderMessageContent(message.content)}
                </div>
                {message.role === "user" && <UserAvatar />}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start animate-fade-in">
                <BotAvatar isAnimating />
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2 shadow-sm">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input com visual moderno */}
        <div className="p-4 border-t bg-background/50">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta..."
              disabled={isLoading}
              className="rounded-full bg-muted/50 border-0 focus-visible:ring-primary/50"
              aria-label="Sua mensagem"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="rounded-full shrink-0 bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 transition-opacity"
              aria-label="Enviar mensagem"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
