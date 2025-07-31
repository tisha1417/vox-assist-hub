import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Ticket {
  id: string;
  complaint: string;
  building: string;
  date: string;
  priority: string;
  technician_name: string;
  status: string;
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
  }, [refreshTrigger]);

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tickets:', error);
    } else {
      setTickets(data || []);
    }
    setLoading(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P1':
        return 'destructive';
      case 'P2':
        return 'secondary';
      case 'P3':
        return 'outline';
      case 'P4':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'P1':
        return '🔴';
      case 'P2':
        return '🟡';
      case 'P3':
        return '🟢';
      case 'P4':
        return '🔵';
      default:
        return '⚪';
    }
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
                  <th className="text-left p-3 font-semibold">Building</th>
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">Technician</th>
                  <th className="text-left p-3 font-semibold">Priority</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{ticket.complaint}</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{ticket.building}</td>
                    <td className="p-3 text-muted-foreground">{ticket.date}</td>
                    <td className="p-3 text-muted-foreground">{ticket.technician_name}</td>
                    <td className="p-3">
                      <Badge 
                        variant={getPriorityColor(ticket.priority)}
                        className="flex items-center gap-1 w-fit"
                      >
                        <span>{getPriorityIcon(ticket.priority)}</span>
                        {ticket.priority}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={ticket.status === 'open' ? 'secondary' : 'default'}>
                        {ticket.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No maintenance tickets found. Use the voice assistant to create a ticket.
          </div>
        )}
      </CardContent>
    </Card>
  );
};