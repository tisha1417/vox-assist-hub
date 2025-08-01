import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('Chat-with-AI function started', openAIApiKey ? 'with API key' : 'without API key');

serve(async (req) => {
  console.log('Received request:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();
    console.log('Processing message:', message);

    if (!openAIApiKey) {
      console.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    console.log('Making request to OpenAI...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are a helpful female voice assistant for an Operations Hub. Your role is to:
            
            1. Be warm, friendly, and professional
            2. Always greet new users with "We are here to support and assist you."
            3. Help users create maintenance tickets by extracting: problem type and building name
            4. If user provides problem + building, respond positively about ticket creation
            5. If missing info, ask for it politely
            6. Detect if input sounds like a child (nonsense words, mentions monsters, toys, mommy/daddy) and respond: "This seems like a child's input. Please ask an adult to use this system."
            7. Classify priority: P1 (leakage, fire, gas), P2 (AC, heating, electrical), P3 (lights, internet), P4 (other)
            8. Keep responses conversational and under 30 words
            
            Current date: ${new Date().toLocaleDateString()}`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 150
      }),
    });

    console.log('OpenAI response status:', response.status);
    console.log('OpenAI response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log('Raw OpenAI response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      throw new Error('Invalid JSON response from OpenAI');
    }

    console.log('Parsed OpenAI response data:', JSON.stringify(data, null, 2));

    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error('No choices in OpenAI response:', data);
      throw new Error('No choices returned from OpenAI');
    }

    if (!data.choices[0].message || !data.choices[0].message.content) {
      console.error('Invalid message structure in OpenAI response:', data.choices[0]);
      throw new Error('Invalid message structure from OpenAI');
    }

    const aiResponse = data.choices[0].message.content;
    console.log('AI Response:', aiResponse);

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat-with-ai function:', error);
    console.error('Error stack:', error.stack);
    
    // Return a fallback response instead of an error to prevent the voice assistant from breaking
    const fallbackResponse = "Thank you for your request. Please describe the issue and which building it's in.";
    
    return new Response(JSON.stringify({ response: fallbackResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});