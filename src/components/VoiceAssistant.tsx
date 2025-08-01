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

      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const aiResponse = data.response;

      // Don't show the generic fallback message
      if (aiResponse !== "Thank you for your request. Please describe the issue and which building it's in.") {
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
      }

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
    console.log('Processing user text for ticket creation:', userText);
    console.log('AI Response:', aiResponse);
    
    // Check if this is a child's input
    const childKeywords = ['monster', 'toy', 'mommy', 'daddy', 'play', 'game', 'batman', 'spiderman'];
    const isChildInput = childKeywords.some(keyword => 
      userText.toLowerCase().includes(keyword)
    ) || (aiResponse && aiResponse.toLowerCase().includes("child's input"));

    if (isChildInput) {
      console.log('Child input detected, not creating ticket');
      return;
    }

    // Extract building information (more flexible patterns)
    const buildingPatterns = [
      /building\s+([a-zA-Z0-9]+)/i,
      /in\s+building\s+([a-zA-Z0-9]+)/i,
      /at\s+building\s+([a-zA-Z0-9]+)/i,
      /from\s+building\s+([a-zA-Z0-9]+)/i
    ];
    
    let buildingMatch = null;
    for (const pattern of buildingPatterns) {
      buildingMatch = userText.match(pattern);
      if (buildingMatch) break;
    }

    // Extract complaint/problem information
    const problemKeywords = [
      'broken', 'not working', 'leaking', 'leak', 'fix', 'repair', 
      'ac', 'air conditioner', 'heater', 'light', 'lights', 
      'electrical', 'plumbing', 'elevator', 'fan', 'toilet',
      'door', 'window', 'heating', 'cooling', 'internet', 'wifi',
      'computer', 'printer', 'projector', 'issue', 'problem'
    ];
    
    const hasProblem = problemKeywords.some(keyword => 
      userText.toLowerCase().includes(keyword)
    );

    console.log('Building match:', buildingMatch);
    console.log('Has problem:', hasProblem);

    // Only create ticket if we have both building and problem
    if (buildingMatch && hasProblem) {
      console.log('Creating ticket...');
      
      // Extract building name
      const buildingName = buildingMatch[1].toUpperCase();
      
      // Create a simplified complaint description
      let complaint = userText.trim();
      
      // Determine priority based on keywords
      let priority = "P4"; // Default
      const userTextLower = userText.toLowerCase();
      
      if (/leak|leaking|fire|gas|emergency|flood|electrical\s+shock/i.test(userText)) {
        priority = "P1"; // Critical
      } else if (/ac|air\s+conditioner|heating|heater|electrical|power|elevator/i.test(userText)) {
        priority = "P2"; // High
      } else if (/light|lights|internet|wifi|computer/i.test(userText)) {
        priority = "P3"; // Medium
      }

      console.log('Determined priority:', priority);

      // Get available technician
      const { data: technicians, error: techError } = await supabase
        .from('technicians')
        .select('*')
        .eq('status', 'available')
        .limit(1);

      if (techError) {
        console.error('Error fetching technicians:', techError);
        return;
      }

      const technician = technicians?.[0];
      console.log('Available technician:', technician);

      if (technician) {
        // Create ticket data
        const currentDate = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });

        const ticketData = {
          complaint: complaint,
          building: `Building ${buildingName}`,
          date: currentDate,
          priority: priority,
          technician_id: technician.id,
          technician_name: technician.name,
          status: 'open'
        };

        console.log('Inserting ticket:', ticketData);

        // Insert ticket into database
        const { data: insertedTicket, error: insertError } = await supabase
          .from('tickets')
          .insert(ticketData)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating ticket:', insertError);
          return;
        }

        console.log('Ticket created successfully:', insertedTicket);

        // Update technician status to busy
        const { error: updateError } = await supabase
          .from('technicians')
          .update({ status: 'busy' })
          .eq('id', technician.id);

        if (updateError) {
          console.error('Error updating technician status:', updateError);
        }

        // Create simple acknowledgment message without mentioning ticket creation
        const acknowledgmentMessage = `Issue noted for ${ticketData.building}. Technician ${technician.name} will handle this.`;
        
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'assistant',
          text: acknowledgmentMessage,
          timestamp: new Date()
        }]);
        
        speakText(acknowledgmentMessage);
        
        // Trigger UI refresh silently
        onTicketCreated();

      } else {
        console.log('No available technicians');
        const noTechMessage = "All technicians are currently busy. Your request has been noted.";
        
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'assistant',
          text: noTechMessage,
          timestamp: new Date()
        }]);
        
        speakText(noTechMessage);
      }
    } else {
      console.log('Ticket not created - missing required information');
      console.log('Building found:', !!buildingMatch);
      console.log('Problem found:', hasProblem);
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
