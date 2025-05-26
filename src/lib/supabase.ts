import { createClient } from '@supabase/supabase-js';

// DEMO Supabase credentials (replace with your real ones for production)
const supabaseUrl = 'https://wsxubmkeeuauyxvepfmj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzeHVibWtlZXVhdXl4dmVwZm1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MDUxNjksImV4cCI6MjA2MzM4MTE2OX0.TxGjjiWwKuukfLtn-xoQWuOxnn57HxlhsM2S0aztcJ4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// SQL Query to create students table:
/*
CREATE TABLE students (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  roll_no TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  face_descriptors JSONB, -- Store face descriptors as JSON array
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read/write
CREATE POLICY "Allow authenticated users to manage students"
ON students
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
*/
