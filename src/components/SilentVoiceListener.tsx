import { useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    omnidimWidget?: any;
  }
}

interface SilentVoiceListenerProps {
  onTicketCreated: () => void;
}

export const SilentVoiceListener = ({ onTicketCreated }: SilentVoiceListenerProps) => {
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    // Listen for Omnidim widget clicks
    const handleWidgetClick = () => {
      if (!isListeningRef.current) {
        startListening();
      }
    };

    // Check for widget periodically and attach listener
    const checkForWidget = () => {
      const widgetElement = document.getElementById('omnidimension-web-widget');
      if (widgetElement) {
        widgetElement.addEventListener('click', handleWidgetClick);
        return;
      }
      
      // If widget script creates a clickable element, try to find it
      const possibleWidgets = document.querySelectorAll('[id*="omnidim"], [class*="omnidim"], [data-omnidim]');
      possibleWidgets.forEach(widget => {
        widget.addEventListener('click', handleWidgetClick);
      });
    };

    // Check immediately and then periodically
    checkForWidget();
    const interval = setInterval(checkForWidget, 1000);

    return () => {
      clearInterval(interval);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const processWithAI = async (userText: string) => {
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

      // Check if we should create a ticket
      await handleTicketCreation(userText, aiResponse);

    } catch (error) {
      console.error('AI Processing Error:', error);
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

        console.log('Ticket created silently in background');
        
        // Trigger UI refresh silently
        onTicketCreated();

      } else {
        console.log('No available technicians');
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
        isListeningRef.current = true;
        console.log('Silent listening started');
      };

      recognitionRef.current.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const newTranscript = lastResult[0].transcript;
          console.log('Voice input received:', newTranscript);
          
          // Process with AI
          processWithAI(newTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListeningRef.current = false;
      };

      recognitionRef.current.onend = () => {
        isListeningRef.current = false;
        console.log('Silent listening ended');
      };

      recognitionRef.current.start();
    } else {
      console.error('Speech recognition not supported');
    }
  };

  // This component renders nothing visible
  return null;
};