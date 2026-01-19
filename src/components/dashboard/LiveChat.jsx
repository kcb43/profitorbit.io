import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Mock chat messages - in production, this would connect to a real chat service
const mockMessages = [
  { id: 1, user: "ResellerPro", message: "Just hit $1k profit this month! 🎉", time: "2m ago" },
  { id: 2, user: "Flipper123", message: "Anyone have tips for Mercari listings?", time: "5m ago" },
  { id: 3, user: "ThriftKing", message: "Found an amazing deal at Goodwill today", time: "8m ago" },
];

export default function LiveChat({ variant = "default" }) {
  const [messages] = useState(mockMessages);
  const [inputValue, setInputValue] = useState("");
  const [onlineUsers] = useState(42); // Mock online count

  const handleSend = () => {
    if (!inputValue.trim()) return;
    // TODO: Send message to chat service
    setInputValue("");
  };

  if (variant === "compact") {
    return (
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Community Chat
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              <Users className="w-3 h-3 mr-1" />
              {onlineUsers}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {messages.slice(0, 2).map((msg) => (
              <div key={msg.id} className="text-xs">
                <span className="font-semibold text-foreground">{msg.user}:</span>{" "}
                <span className="text-muted-foreground">{msg.message}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              className="text-xs h-8"
            />
            <Button size="sm" onClick={handleSend} className="h-8 px-3">
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Community Chat
          </CardTitle>
          <Badge variant="secondary">
            <Users className="w-4 h-4 mr-1" />
            {onlineUsers} online
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-foreground">{msg.user}</span>
                <span className="text-xs text-muted-foreground">{msg.time}</span>
              </div>
              <p className="text-muted-foreground mt-0.5">{msg.message}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            className="flex-1"
          />
          <Button onClick={handleSend}>
            <Send className="w-4 h-4 mr-2" />
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
