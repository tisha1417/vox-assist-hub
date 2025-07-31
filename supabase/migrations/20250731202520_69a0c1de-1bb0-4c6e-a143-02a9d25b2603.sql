-- Insert sample technicians if they don't exist
INSERT INTO public.technicians (name, status) 
SELECT * FROM (VALUES 
  ('Alex Johnson', 'available'),
  ('Sarah Chen', 'available'),
  ('Mike Rodriguez', 'available'),
  ('Emma Davis', 'available'),
  ('Ravi Sharma', 'available'),
  ('Lisa Wang', 'available')
) AS new_technicians(name, status)
WHERE NOT EXISTS (
  SELECT 1 FROM public.technicians WHERE name = new_technicians.name
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_technicians_status ON public.technicians(status);