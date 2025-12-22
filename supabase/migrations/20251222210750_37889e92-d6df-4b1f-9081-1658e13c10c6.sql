-- Create profile for existing user stevanpalic1993@gmail.com
INSERT INTO public.profiles (id) 
VALUES ('7d8706e6-ce03-4fcb-a729-a5fec6fe8999')
ON CONFLICT (id) DO NOTHING;