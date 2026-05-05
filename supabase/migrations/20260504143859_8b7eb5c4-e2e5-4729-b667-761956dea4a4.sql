-- Verifications log
CREATE TABLE public.verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL,
  input_url TEXT,
  verdict TEXT NOT NULL CHECK (verdict IN ('trusted','suspicious','fake','uncertain')),
  confidence INT NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  explanation TEXT,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_verifications_user_created ON public.verifications(user_id, created_at DESC);

CREATE POLICY "Users view own verifications"
  ON public.verifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all verifications"
  ON public.verifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own verifications"
  ON public.verifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Public articles (news, reports, agents, social)
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('news','report','agent','social')),
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  verdict TEXT CHECK (verdict IN ('trusted','suspicious','fake','uncertain')),
  confidence INT CHECK (confidence BETWEEN 0 AND 100),
  source_url TEXT,
  category TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_articles_type_published ON public.articles(type, published_at DESC);

CREATE POLICY "Articles are public read"
  ON public.articles FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage articles"
  ON public.articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contact messages
CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  handled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact message"
  ON public.contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(name) BETWEEN 1 AND 120
    AND char_length(email) BETWEEN 3 AND 255
    AND char_length(message) BETWEEN 1 AND 4000
  );

CREATE POLICY "Admins read contact messages"
  ON public.contact_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update contact messages"
  ON public.contact_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));