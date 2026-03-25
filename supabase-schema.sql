-- Supabase Schema for Form Submissions, Email Tracking & Engagement
-- Run this in your Supabase SQL Editor

-- 1. Main submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  newsletter_subscription BOOLEAN DEFAULT FALSE,
  engagement_status TEXT DEFAULT 'new', -- 'new', 'email_sent', 'replied', 'engaged'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(email)
);

-- 2. Email tracking table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'confirmation', 'follow_up_1', 'follow_up_2', 'follow_up_3'
  subject TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'bounced', 'opened', 'clicked'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Engagement tracking (replies, interactions)
CREATE TABLE IF NOT EXISTS engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'email_delivered', 'email_opened', 'link_clicked', 'reply_received', 'opt_in', 'opt_out', 'email_bounced', 'email_complained'
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Scheduled emails (for follow-ups every 5 days)
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL, -- 'follow_up_1', 'follow_up_2', 'follow_up_3'
  scheduled_for TIMESTAMP NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(engagement_status);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_submission ON email_logs(submission_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_engagement_submission ON engagement_events(submission_id);
CREATE INDEX IF NOT EXISTS idx_engagement_type ON engagement_events(event_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_due ON scheduled_emails(scheduled_for) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_submission ON scheduled_emails(submission_id);

-- ─── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Submissions: anon can insert (form submissions) and server can read/update
CREATE POLICY "Allow anon insert submissions" ON submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon read submissions" ON submissions
  FOR SELECT USING (true);

CREATE POLICY "Allow anon update submissions" ON submissions
  FOR UPDATE USING (true);

-- Email logs: server inserts and reads
CREATE POLICY "Allow anon insert email_logs" ON email_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon read email_logs" ON email_logs
  FOR SELECT USING (true);

CREATE POLICY "Allow anon update email_logs" ON email_logs
  FOR UPDATE USING (true);

-- Engagement events: server inserts and reads
CREATE POLICY "Allow anon insert engagement_events" ON engagement_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon read engagement_events" ON engagement_events
  FOR SELECT USING (true);

-- Scheduled emails: server manages the full lifecycle
CREATE POLICY "Allow anon insert scheduled_emails" ON scheduled_emails
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon read scheduled_emails" ON scheduled_emails
  FOR SELECT USING (true);

CREATE POLICY "Allow anon update scheduled_emails" ON scheduled_emails
  FOR UPDATE USING (true);

-- ─── Table Grants (required when creating tables via SQL Editor) ───────────────

GRANT ALL ON submissions TO anon, authenticated;
GRANT ALL ON email_logs TO anon, authenticated;
GRANT ALL ON engagement_events TO anon, authenticated;
GRANT ALL ON scheduled_emails TO anon, authenticated;

-- ─── Helper: Auto-update updated_at on submissions ────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
