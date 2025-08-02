
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Technician {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface TechnicianHubProps {
  refreshTrigger?: number;
}

export const TechnicianHub = ({ refreshTrigger }: TechnicianHubProps) => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  useEffect(() => {
    fetchTechnicians();
    
    // Set up real-time subscription for technicians
    const channel = supabase
      .channel('technicians-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'technicians'
        },
        () => {
          console.log('Technician status updated, refreshing...');
          fetchTechnicians();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshTrigger]);

  const fetchTechnicians = async () => {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching technicians:', error);
    } else {
      setTechnicians(data || []);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'available':
        return 'default';
      case 'busy':
        return 'secondary';
      case 'offline':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-accent" />
          Technician Hub
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {technicians.map((technician) => (
            <div
              key={technician.id}
              className="p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    {getInitials(technician.name)}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${getStatusColor(technician.status)}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{technician.name}</h3>
                  <Badge 
                    variant={getStatusBadgeVariant(technician.status)}
                    className="text-xs mt-1"
                  >
                    {technician.status}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {technicians.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No technicians found
          </div>
        )}
      </CardContent>
    </Card>
  );
};
