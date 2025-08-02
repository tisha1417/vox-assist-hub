-- Enable realtime for maintenance_tickets table
ALTER TABLE public.maintenance_tickets REPLICA IDENTITY FULL;

-- Enable realtime for technicians table  
ALTER TABLE public.technicians REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.technicians;