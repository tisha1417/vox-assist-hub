import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface VoiceAssistantProps {
  onTicketCreated: () => void;
}

export const VoiceAssistant = ({ onTicketCreated }: VoiceAssistantProps) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Array<{id: string, type: 'user' | 'assistant', text: string, timestamp: Date}>>([]);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Welcome message on load
    const welcomeMessage = {
      id: Date.now().toString(),
      type: 'assistant' as const,
      text: "We are here to support and assist you.",
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
    speakText("We are here to support and assist you.");
  }, []);

  const speakText = async (text: string) => {
    try {
      const response = await fetch('https://lghewicehmxikrhntfey.functions.supabase.co/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audioContent) {
          const audioBlob = new Blob([
            Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))
          ], { type: 'audio/mpeg' });
          
          const audio = new Audio(URL.createObjectURL(audioBlob));
          audio.play().catch(console.error);
        }
      } else {
        // Fallback to browser TTS
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = speechSynthesis.getVoices();
        const femaleVoice = voices.find(voice => 
          voice.name.toLowerCase().includes('female') || 
          voice.name.toLowerCase().includes('woman') ||
          voice.name.toLowerCase().includes('samantha') ||
          voice.name.toLowerCase().includes('victoria')
        );
        if (femaleVoice) utterance.voice = femaleVoice;
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('TTS Error:', error);
      // Fallback to browser TTS
      const utterance = new SpeechSynthesisUtterance(text);
      speechSynthesis.speak(utterance);
    }
  };

  const processWithAI = async (userText: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('https://lghewicehmxikrhntfey.functions.supabase.co/chat-with-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userText }),
      });

      const data = await response.json();
      const aiResponse = data.response;

      // Add AI response to messages
      const assistantMessage = {
        id: Date.now().toString(),
        type: 'assistant' as const,
        text: aiResponse,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Speak the response
      speakText(aiResponse);

      // Check if we should create a ticket
      await handleTicketCreation(userText, aiResponse);

    } catch (error) {
      console.error('AI Processing Error:', error);
      const errorResponse = "I'm sorry, I'm having trouble processing your request right now.";
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        text: errorResponse,
        timestamp: new Date()
      }]);
      speakText(errorResponse);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTicketCreation = async (userText: string, aiResponse: string) => {
    // Check if this is a child's input
    const childKeywords = ['monster', 'toy', 'mommy', 'daddy', 'play', 'game'];
    const isChildInput = childKeywords.some(keyword => 
      userText.toLowerCase().includes(keyword)
    ) || aiResponse.toLowerCase().includes("child's input");

    if (isChildInput) {
      return; // Don't create ticket for child input
    }

    // Extract building and problem from user text
    const buildingMatch = userText.match(/building\s+([a-zA-Z0-9]+)/i);
    const hasBuilding = buildingMatch || /building/i.test(userText);
    
    // Check if it's a maintenance request
    const maintenanceKeywords = ['broken', 'not working', 'leaking', 'leak', 'fix', 'repair', 'ac', 'air conditioner', 'heater', 'light', 'electrical', 'plumbing', 'elevator', 'fan'];
    const hasProblem = maintenanceKeywords.some(keyword => 
      userText.toLowerCase().includes(keyword)
    );

    if (hasBuilding && hasProblem && !aiResponse.toLowerCase().includes("cannot be created")) {
      // Extract building name
      const building = buildingMatch ? buildingMatch[1] : "Unknown";
      
      // Determine priority
      let priority = "P4";
      if (/leak|fire|gas|emergency/i.test(userText)) priority = "P1";
      else if (/ac|air conditioner|heating|electrical|power/i.test(userText)) priority = "P2";
      else if (/light|internet|wifi/i.test(userText)) priority = "P3";

      // Get available technician
      const { data: technicians } = await supabase
        .from('technicians')
        .select('*')
        .eq('status', 'available')
        .limit(1);

      const technician = technicians?.[0];

      if (technician) {
        // Create ticket
        const ticketData = {
          complaint: userText.trim(),
          building: `Building ${building.toUpperCase()}`,
          date: new Date().toLocaleDateString(),
          priority,
          technician_id: technician.id,
          technician_name: technician.name,
          status: 'open'
        };

        const { error } = await supabase
          .from('tickets')
          .insert(ticketData);

        if (!error) {
          // Update technician status
          await supabase
            .from('technicians')
            .update({ status: 'busy' })
            .eq('id', technician.id);

          const successMessage = `Ticket created successfully with priority ${priority}. Technician ${technician.name} has been assigned.`;
          
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'assistant',
            text: successMessage,
            timestamp: new Date()
          }]);
          
          speakText(successMessage);
          onTicketCreated();
          
          toast({
            title: "Ticket Created",
            description: `Priority ${priority} ticket assigned to ${technician.name}`,
          });
        }
      }
    }
  };

  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setTranscript("");
      };

      recognitionRef.current.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const newTranscript = lastResult[0].transcript;
          setTranscript(newTranscript);
          
          // Add user message
          const userMessage = {
            id: Date.now().toString(),
            type: 'user' as const,
            text: newTranscript,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, userMessage]);
          
          // Process with AI
          processWithAI(newTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        toast({
          title: "Speech Recognition Error",
          description: "Please try again",
          variant: "destructive",
        });
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.start();
    } else {
      toast({
        title: "Speech Recognition Not Supported",
        description: "Your browser doesn't support speech recognition",
        variant: "destructive",
      });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const resetVoice = () => {
    stopListening();
    setTranscript("");
    setMessages([{
      id: Date.now().toString(),
      type: 'assistant',
      text: "Voice assistant reset. We are here to support and assist you.",
      timestamp: new Date()
    }]);
    speakText("Voice assistant reset. We are here to support and assist you.");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-accent" />
          Voice Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Control Buttons */}
        <div className="flex gap-2 justify-center">
          <Button
            onClick={startListening}
            disabled={isListening}
            variant={isListening ? "secondary" : "default"}
            size="sm"
          >
            <Mic className="h-4 w-4 mr-2" />
            Start Listening
          </Button>
          
          <Button
            onClick={stopListening}
            disabled={!isListening}
            variant="outline"
            size="sm"
          >
            <MicOff className="h-4 w-4 mr-2" />
            Stop
          </Button>
          
          <Button
            onClick={resetVoice}
            variant="outline"
            size="sm"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Status */}
        <div className="text-center">
          {isListening && (
            <Badge variant="default" className="animate-pulse">
              Listening...
            </Badge>
          )}
          {isProcessing && (
            <Badge variant="secondary">
              Processing...
            </Badge>
          )}
        </div>

        {/* Chat Messages */}
        <div className="h-64 overflow-y-auto space-y-3 p-3 border rounded-lg bg-muted/20">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <span className="text-xs opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Current Transcript */}
        {transcript && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>You said:</strong> {transcript}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};