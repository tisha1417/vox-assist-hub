
import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { SilentVoiceListener } from "@/components/SilentVoiceListener";
import { TechnicianHub } from "@/components/TechnicianHub";
import { MaintenanceSchedule } from "@/components/MaintenanceSchedule";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTicketCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    // Add Omnidim widget script
    const script = document.createElement('script');
    script.id = 'omnidimension-web-widget';
    script.async = true;
    script.src = 'https://backend.omnidim.io/web_widget.js?secret_key=a18fd9396019519a1181f82f8837e495';
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.getElementById('omnidimension-web-widget');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ThemeToggle />
      
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
              <Settings className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Operations Center</h1>
              <p className="text-muted-foreground">Voice-powered facility management</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Silent Voice Listener - no UI */}
        <SilentVoiceListener onTicketCreated={handleTicketCreated} />
        
        {/* Technician Hub - Full Width */}
        <TechnicianHub refreshTrigger={refreshTrigger} />

        {/* Maintenance Schedule */}
        <MaintenanceSchedule refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
};

export default Index;
