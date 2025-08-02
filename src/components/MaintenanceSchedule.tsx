import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Ticket {
  id: number;
  issue_description: string;
  apartment_number: string;
  priority_level: string;
  technician_name: string;
  created_at: string;
}

interface MaintenanceScheduleProps {
  refreshTrigger?: number;
}

export const MaintenanceSchedule = ({ refreshTrigger }: MaintenanceScheduleProps) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
    
    // Set up real-time subscription for maintenance_tickets
    const channel = supabase
      .channel('maintenance-tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_tickets'
        },
        () => {
          console.log('Maintenance ticket updated, refreshing...');
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshTrigger]);

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('maintenance_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching maintenance tickets:', error);
    } else {
      setTickets(data || []);
    }
    setLoading(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
      case 'Critical':
        return 'destructive';
      case 'Medium':
        return 'secondary';
      case 'Low':
        return 'outline';
      default:
        return 'default';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return '🔴';
      case 'High':
        return '🟡';
      case 'Medium':
        return '🟢';
      case 'Low':
        return '🔵';
      default:
        return '⚪';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent" />
            Maintenance Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading tickets...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-accent" />
          Maintenance Schedule
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tickets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold">Task</th>
                  <th className="text-left p-3 font-semibold">Apartment</th>
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">Technician</th>
                  <th className="text-left p-3 font-semibold">Priority</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{ticket.issue_description || 'No description'}</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{ticket.apartment_number || 'N/A'}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(ticket.created_at)}</td>
                    <td className="p-3 text-muted-foreground">{ticket.technician_name || 'Unassigned'}</td>
                    <td className="p-3">
                      <Badge 
                        variant={getPriorityColor(ticket.priority_level || 'Low')}
                        className="flex items-center gap-1 w-fit"
                      >
                        <span>{getPriorityIcon(ticket.priority_level || 'Low')}</span>
                        {ticket.priority_level || 'Low'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No maintenance tickets found. Create tickets through the Omnidim agent.
          </div>
        )}
      </CardContent>
    </Card>
  );
};