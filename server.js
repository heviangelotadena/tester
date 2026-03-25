import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ─── Supabase Configuration ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

let supabase;
let isSupabaseConfigured = false;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  isSupabaseConfigured = true;
  console.log('✓ Supabase client initialized');
} else {
  console.warn('⚠️  Supabase credentials not configured. Submissions will fall back to Google Sheets/local storage.');
}

// ─── Resend Configuration ──────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Tester.io <onboarding@resend.dev>';
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || 'support@tester.io';

let resend;
let isResendConfigured = false;

if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  isResendConfigured = true;
  console.log('✓ Resend email client initialized');
} else {
  console.warn('⚠️  Resend API key not configured. Emails will not be sent.');
}

// ─── Google Sheets Configuration ───────────────────────────────────────────────
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Form Submissions';

let sheets;
let isGoogleSheetsConfigured = false;

async function initializeGoogleSheets() {
  try {
    let credentials;

    if (process.env.GOOGLE_SERVICE_ACCOUNT) {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    } else if (fs.existsSync(path.join(__dirname, 'credentials.json'))) {
      credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials.json'), 'utf8'));
    } else {
      console.warn('⚠️  Google Sheets credentials not found. Form submissions will be saved locally only.');
      return;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    sheets = google.sheets({ version: 'v4', auth });
    isGoogleSheetsConfigured = true;
    console.log('✓ Google Sheets API initialized');
  } catch (error) {
    console.warn('⚠️  Failed to initialize Google Sheets:', error.message);
  }
}

// ─── Email Templates ───────────────────────────────────────────────────────────

function confirmationEmailHtml(name) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9f9f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div style="background:#fff;border-radius:16px;padding:48px 40px;border:1px solid #f0ebe0;box-shadow:0 4px 24px rgba(198,165,89,0.08);">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#C6A559,#A88A3D);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-size:28px;">✓</span>
        </div>
      </div>
      <h1 style="color:#2f2f2f;font-size:24px;text-align:center;margin:0 0 16px;letter-spacing:-0.03em;">
        Thanks for reaching out, ${name}!
      </h1>
      <p style="color:#676767;font-size:16px;line-height:1.7;text-align:center;margin:0 0 24px;">
        We've received your message and our team is already on it. You can expect a personal response within <strong style="color:#C6A559;">24 hours</strong>.
      </p>
      <div style="background:linear-gradient(135deg,rgba(198,165,89,0.08),rgba(198,165,89,0.03));border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid rgba(198,165,89,0.15);">
        <p style="color:#2f2f2f;font-size:15px;font-weight:600;margin:0 0 12px;">In the meantime:</p>
        <ul style="color:#676767;font-size:15px;line-height:1.8;margin:0;padding-left:20px;">
          <li>Check out how teams ship 3x faster with Tester.io</li>
          <li>Explore our AI-powered QA features</li>
          <li>Join 500+ companies who trust us for testing</li>
        </ul>
      </div>
      <p style="color:#676767;font-size:15px;line-height:1.7;text-align:center;margin:0 0 8px;">
        Have a quick question? Just <strong>reply to this email</strong> — we read every response.
      </p>
      <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid #f0ebe0;">
        <p style="color:#b2b2b2;font-size:13px;margin:0;">
          Tester.io — Ship quality software, faster.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function followUpEmailHtml(name, followUpNumber) {
  const templates = [
    {
      subject: `${name}, here's how teams are shipping 3x faster`,
      body: `
        <h1 style="color:#2f2f2f;font-size:22px;text-align:center;margin:0 0 16px;letter-spacing:-0.03em;">
          Still exploring QA solutions, ${name}?
        </h1>
        <p style="color:#676767;font-size:16px;line-height:1.7;text-align:center;margin:0 0 24px;">
          We wanted to share how teams like yours are using Tester.io to cut QA cycles by 60% while catching more bugs than ever.
        </p>
        <div style="background:linear-gradient(135deg,rgba(198,165,89,0.08),rgba(198,165,89,0.03));border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid rgba(198,165,89,0.15);">
          <p style="color:#2f2f2f;font-size:15px;font-weight:600;margin:0 0 12px;">Why teams choose Tester.io:</p>
          <ul style="color:#676767;font-size:15px;line-height:1.8;margin:0;padding-left:20px;">
            <li><strong>AI-powered test generation</strong> — write tests in minutes, not hours</li>
            <li><strong>Smart regression detection</strong> — catch bugs before your users do</li>
            <li><strong>Seamless CI/CD integration</strong> — fits right into your workflow</li>
          </ul>
        </div>`
    },
    {
      subject: `${name}, see what our customers are saying`,
      body: `
        <h1 style="color:#2f2f2f;font-size:22px;text-align:center;margin:0 0 16px;letter-spacing:-0.03em;">
          Don't just take our word for it, ${name}
        </h1>
        <p style="color:#676767;font-size:16px;line-height:1.7;text-align:center;margin:0 0 24px;">
          Here's what engineering leaders are saying about Tester.io:
        </p>
        <div style="background:linear-gradient(135deg,rgba(198,165,89,0.08),rgba(198,165,89,0.03));border-radius:12px;padding:24px;margin:0 0 16px;border:1px solid rgba(198,165,89,0.15);">
          <p style="color:#676767;font-size:15px;line-height:1.7;font-style:italic;margin:0 0 8px;">
            "Tester.io reduced our QA backlog by 70%. We ship with confidence now."
          </p>
          <p style="color:#b2b2b2;font-size:13px;margin:0;">— VP of Engineering, Scale.com</p>
        </div>
        <div style="background:linear-gradient(135deg,rgba(198,165,89,0.08),rgba(198,165,89,0.03));border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid rgba(198,165,89,0.15);">
          <p style="color:#676767;font-size:15px;line-height:1.7;font-style:italic;margin:0 0 8px;">
            "Best testing tool we've integrated. Setup took 15 minutes."
          </p>
          <p style="color:#b2b2b2;font-size:13px;margin:0;">— CTO, FacilityBot</p>
        </div>`
    },
    {
      subject: `${name}, a quick update from Tester.io`,
      body: `
        <h1 style="color:#2f2f2f;font-size:22px;text-align:center;margin:0 0 16px;letter-spacing:-0.03em;">
          What's new at Tester.io, ${name}
        </h1>
        <p style="color:#676767;font-size:16px;line-height:1.7;text-align:center;margin:0 0 24px;">
          We've been shipping fast — here's what's new:
        </p>
        <div style="background:linear-gradient(135deg,rgba(198,165,89,0.08),rgba(198,165,89,0.03));border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid rgba(198,165,89,0.15);">
          <ul style="color:#676767;font-size:15px;line-height:2;margin:0;padding-left:20px;">
            <li><strong>Visual regression testing</strong> — pixel-perfect UI validation</li>
            <li><strong>API testing suite</strong> — automated endpoint coverage</li>
            <li><strong>Slack integration</strong> — get test results where you work</li>
            <li><strong>50% faster test runs</strong> — new parallel execution engine</li>
          </ul>
        </div>
        <p style="color:#676767;font-size:15px;line-height:1.7;text-align:center;margin:0 0 24px;">
          We'd love to show you how these features can help your team. Just reply to this email!
        </p>`
    }
  ];

  const idx = Math.min(followUpNumber - 1, templates.length - 1);
  return templates[idx];
}

function wrapFollowUpHtml(bodyContent) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9f9f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div style="background:#fff;border-radius:16px;padding:48px 40px;border:1px solid #f0ebe0;box-shadow:0 4px 24px rgba(198,165,89,0.08);">
      ${bodyContent}
      <p style="color:#676767;font-size:15px;line-height:1.7;text-align:center;margin:24px 0 8px;">
        Hit reply — we'd love to hear from you.
      </p>
      <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid #f0ebe0;">
        <p style="color:#b2b2b2;font-size:13px;margin:0;">
          Tester.io — Ship quality software, faster.<br>
          <a href="#" style="color:#b2b2b2;font-size:12px;">Unsubscribe</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Supabase Helpers ──────────────────────────────────────────────────────────

async function saveSubmissionToSupabase(data) {
  if (!isSupabaseConfigured) return null;

  try {
    // Upsert: if email already exists, update the record instead of failing
    const { data: inserted, error } = await supabase
      .from('submissions')
      .upsert([{
        name: data.name,
        email: data.email,
        message: data.message,
        newsletter_subscription: data.newsletter_subscription || false,
        engagement_status: 'new'
      }], { onConflict: 'email' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    console.log('✓ Submission saved to Supabase:', inserted.id);
    return inserted;
  } catch (error) {
    console.error('❌ Supabase insert error:', error.message);
    return null;
  }
}

async function logEmail(submissionId, recipientEmail, emailType, subject, status, errorMessage) {
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase
      .from('email_logs')
      .insert([{
        submission_id: submissionId,
        recipient_email: recipientEmail,
        email_type: emailType,
        subject,
        status: status || 'sent',
        error_message: errorMessage || null
      }]);

    if (error) console.error('❌ Email log error:', error.message);
  } catch (err) {
    console.error('❌ Email log error:', err.message);
  }
}

async function logEngagement(submissionId, eventType, eventData) {
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase
      .from('engagement_events')
      .insert([{
        submission_id: submissionId,
        event_type: eventType,
        event_data: eventData || {}
      }]);

    if (error) console.error('❌ Engagement log error:', error.message);
  } catch (err) {
    console.error('❌ Engagement log error:', err.message);
  }
}

async function updateEngagementStatus(submissionId, status) {
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase
      .from('submissions')
      .update({ engagement_status: status, updated_at: new Date().toISOString() })
      .eq('id', submissionId);

    if (error) console.error('❌ Status update error:', error.message);
  } catch (err) {
    console.error('❌ Status update error:', err.message);
  }
}

async function scheduleFollowUps(submissionId, email) {
  if (!isSupabaseConfigured) return;

  const followUps = [
    { type: 'follow_up_1', daysFromNow: 5 },
    { type: 'follow_up_2', daysFromNow: 10 },
    { type: 'follow_up_3', daysFromNow: 15 }
  ];

  const rows = followUps.map(f => ({
    submission_id: submissionId,
    email_type: f.type,
    scheduled_for: new Date(Date.now() + f.daysFromNow * 24 * 60 * 60 * 1000).toISOString(),
    sent: false
  }));

  try {
    const { error } = await supabase.from('scheduled_emails').insert(rows);
    if (error) console.error('❌ Schedule follow-ups error:', error.message);
    else {
      console.log(`✓ Scheduled ${rows.length} follow-up emails`);
      // Sync to Google Sheets
      for (const row of rows) {
        logScheduledToSheets(email, row.email_type, row.scheduled_for).catch(() => {});
      }
    }
  } catch (err) {
    console.error('❌ Schedule follow-ups error:', err.message);
  }
}

// ─── Send Emails ───────────────────────────────────────────────────────────────

async function sendConfirmationEmail(submission) {
  if (!isResendConfigured) {
    console.log('ℹ️  Resend not configured — skipping confirmation email');
    return;
  }

  const subject = `Thanks for reaching out, ${submission.name}!`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [submission.email],
      replyTo: REPLY_TO_EMAIL,
      subject,
      html: confirmationEmailHtml(submission.name)
    });

    if (error) throw new Error(error.message);

    console.log(`✓ Confirmation email sent to ${submission.email} (id: ${data.id})`);
    await logEmail(submission.id, submission.email, 'confirmation', subject, 'sent');
    await updateEngagementStatus(submission.id, 'email_sent');
    // Sync to Google Sheets
    logEmailToSheets(submission.email, 'confirmation', subject, 'sent', '').catch(() => {});
    updateSubmissionStatusInSheets(submission.email, 'email_sent').catch(() => {});
  } catch (err) {
    console.error(`❌ Failed to send confirmation to ${submission.email}:`, err.message);
    await logEmail(submission.id, submission.email, 'confirmation', subject, 'failed', err.message);
    logEmailToSheets(submission.email, 'confirmation', subject, 'failed', err.message).catch(() => {});
  }
}

async function sendFollowUpEmail(scheduledEmail, submission) {
  if (!isResendConfigured) return;

  const followUpNumber = parseInt(scheduledEmail.email_type.replace('follow_up_', ''), 10);
  const template = followUpEmailHtml(submission.name, followUpNumber);
  const html = wrapFollowUpHtml(template.body);

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [submission.email],
      replyTo: REPLY_TO_EMAIL,
      subject: template.subject,
      html
    });

    if (error) throw new Error(error.message);

    console.log(`✓ Follow-up ${followUpNumber} sent to ${submission.email}`);

    // Mark as sent
    await supabase
      .from('scheduled_emails')
      .update({ sent: true, sent_at: new Date().toISOString() })
      .eq('id', scheduledEmail.id);

    await logEmail(submission.id, submission.email, scheduledEmail.email_type, template.subject, 'sent');
    logEmailToSheets(submission.email, scheduledEmail.email_type, template.subject, 'sent', '').catch(() => {});
  } catch (err) {
    console.error(`❌ Follow-up send failed:`, err.message);
    await logEmail(submission.id, submission.email, scheduledEmail.email_type, template.subject, 'failed', err.message);
    logEmailToSheets(submission.email, scheduledEmail.email_type, template.subject, 'failed', err.message).catch(() => {});
  }
}

// ─── Follow-Up Processor (runs every 10 minutes) ──────────────────────────────

async function processScheduledEmails() {
  if (!isSupabaseConfigured || !isResendConfigured) return;

  try {
    // Get unsent emails that are due
    const { data: dueEmails, error } = await supabase
      .from('scheduled_emails')
      .select('*, submissions(*)')
      .eq('sent', false)
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('❌ Error fetching scheduled emails:', error.message);
      return;
    }

    if (!dueEmails || dueEmails.length === 0) return;

    console.log(`📬 Processing ${dueEmails.length} scheduled follow-up(s)...`);

    for (const scheduled of dueEmails) {
      const submission = scheduled.submissions;
      if (!submission) continue;

      // Skip if user has already replied/engaged
      if (submission.engagement_status === 'replied' || submission.engagement_status === 'engaged') {
        await supabase
          .from('scheduled_emails')
          .update({ sent: true, sent_at: new Date().toISOString() })
          .eq('id', scheduled.id);
        console.log(`⏭️  Skipping follow-up for ${submission.email} — already engaged`);
        continue;
      }

      await sendFollowUpEmail(scheduled, submission);
    }
  } catch (err) {
    console.error('❌ Follow-up processor error:', err.message);
  }
}

// ─── Local Fallback ────────────────────────────────────────────────────────────

function saveSubmissionLocally(data) {
  const submissionsFile = path.join(__dirname, 'submissions.json');
  let submissions = [];

  if (fs.existsSync(submissionsFile)) {
    const fileContent = fs.readFileSync(submissionsFile, 'utf8');
    submissions = JSON.parse(fileContent);
  }

  submissions.push({ ...data, timestamp: new Date().toISOString() });
  fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2));
  console.log('✓ Submission saved locally');
}

// ─── Google Sheets ─────────────────────────────────────────────────────────────

async function ensureSheetExists(sheetName) {
  if (!isGoogleSheetsConfigured || !sheets || !SPREADSHEET_ID) return false;

  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const exists = spreadsheet.data.sheets.some(s => s.properties.title === sheetName);

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{ addSheet: { properties: { title: sheetName } } }]
        }
      });
      console.log(`✓ Created sheet: ${sheetName}`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Error ensuring sheet "${sheetName}":`, error.message);
    return false;
  }
}

async function ensureSheetHeaders(sheetName, headers) {
  if (!isGoogleSheetsConfigured || !sheets || !SPREADSHEET_ID) return;

  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1:Z1`
    });

    // Only add headers if row 1 is empty
    if (!data.values || data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A1`,
        valueInputOption: 'RAW',
        resource: { values: [headers] }
      });
    }
  } catch (error) {
    // Range might not exist yet, try to set headers
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A1`,
        valueInputOption: 'RAW',
        resource: { values: [headers] }
      });
    } catch (e) {
      console.error(`❌ Error setting headers for "${sheetName}":`, e.message);
    }
  }
}

async function appendToSheet(sheetName, values) {
  if (!isGoogleSheetsConfigured || !sheets || !SPREADSHEET_ID) return false;

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'RAW',
      resource: { values: [values] }
    });
    return true;
  } catch (error) {
    console.error(`❌ Error appending to "${sheetName}":`, error.message);
    return false;
  }
}

async function initializeSheets() {
  if (!isGoogleSheetsConfigured) return;

  const sheetConfigs = [
    { name: SHEET_NAME, headers: ['Name', 'Email', 'Message', 'Newsletter', 'Engagement Status', 'Submitted At'] },
    { name: 'Email Logs', headers: ['Recipient', 'Email Type', 'Subject', 'Status', 'Error', 'Sent At'] },
    { name: 'Engagement Events', headers: ['Email', 'Event Type', 'Event Data', 'Created At'] },
    { name: 'Scheduled Follow-ups', headers: ['Email', 'Email Type', 'Scheduled For', 'Sent', 'Sent At'] }
  ];

  for (const config of sheetConfigs) {
    const exists = await ensureSheetExists(config.name);
    if (exists) await ensureSheetHeaders(config.name, config.headers);
  }

  console.log('✓ Google Sheets tabs initialized');
}

async function addToGoogleSheets(data) {
  if (!isGoogleSheetsConfigured || !sheets || !SPREADSHEET_ID) {
    saveSubmissionLocally(data);
    return;
  }

  try {
    const timestamp = new Date().toISOString();
    await appendToSheet(SHEET_NAME, [
      data.name,
      data.email,
      data.message,
      data.newsletter_subscription ? 'Yes' : 'No',
      'new',
      timestamp
    ]);
    console.log('✓ Submission appended to Google Sheets');
  } catch (error) {
    console.error('❌ Google Sheets error:', error.message);
    saveSubmissionLocally(data);
  }
}

async function logEmailToSheets(recipientEmail, emailType, subject, status, errorMessage) {
  await appendToSheet('Email Logs', [
    recipientEmail,
    emailType,
    subject || '',
    status,
    errorMessage || '',
    new Date().toISOString()
  ]);
}

async function logEngagementToSheets(email, eventType, eventData) {
  await appendToSheet('Engagement Events', [
    email,
    eventType,
    JSON.stringify(eventData || {}),
    new Date().toISOString()
  ]);
}

async function logScheduledToSheets(email, emailType, scheduledFor) {
  await appendToSheet('Scheduled Follow-ups', [
    email,
    emailType,
    scheduledFor,
    'No',
    ''
  ]);
}

async function updateSubmissionStatusInSheets(email, newStatus) {
  if (!isGoogleSheetsConfigured || !sheets || !SPREADSHEET_ID) return;

  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:F`
    });

    if (!data.values) return;

    // Find the row with matching email (column B = index 1), search from bottom for most recent
    for (let i = data.values.length - 1; i >= 1; i--) {
      if (data.values[i][1] === email) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${SHEET_NAME}'!E${i + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [[newStatus]] }
        });
        console.log(`✓ Updated status in Sheets for ${email} → ${newStatus}`);
        return;
      }
    }
  } catch (error) {
    console.error('❌ Sheets status update error:', error.message);
  }
}

// ─── API Routes ────────────────────────────────────────────────────────────────

// POST /api/contact — Main form submission endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message, newsletter_subscription } = req.body;

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    const submissionData = { name, email, message, newsletter_subscription: newsletter_subscription || false };

    // 1. Save to Supabase (primary) and Google Sheets (secondary) in parallel
    const [supabaseResult, sheetsResult] = await Promise.allSettled([
      saveSubmissionToSupabase(submissionData),
      addToGoogleSheets(submissionData)
    ]);

    const submission = supabaseResult.status === 'fulfilled' ? supabaseResult.value : null;

    // 2. If saved to Supabase, trigger email + schedule follow-ups (non-blocking)
    if (submission) {
      // Fire and forget — don't block the response
      sendConfirmationEmail(submission).catch(err =>
        console.error('❌ Confirmation email error:', err.message)
      );
      scheduleFollowUps(submission.id, submission.email).catch(err =>
        console.error('❌ Follow-up scheduling error:', err.message)
      );

      // Log newsletter opt-in as engagement event
      if (newsletter_subscription) {
        logEngagement(submission.id, 'opt_in', { source: 'contact_form' }).catch(() => {});
        logEngagementToSheets(email, 'opt_in', { source: 'contact_form' }).catch(() => {});
      }
    }

    // 3. Respond immediately
    res.json({
      success: true,
      message: 'Thank you for your submission! We will get back to you soon.'
    });

    console.log(`✓ Contact form submission received from ${email}`);
  } catch (error) {
    console.error('Error processing contact form:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process your submission. Please try again later.'
    });
  }
});

// POST /api/webhook/email — Resend webhook for reply/bounce tracking
app.post('/api/webhook/email', async (req, res) => {
  try {
    const event = req.body;
    console.log(`📩 Email webhook received: ${event.type}`);

    // Map Resend event types to our engagement types
    const eventMap = {
      'email.delivered': 'email_delivered',
      'email.opened': 'email_opened',
      'email.clicked': 'link_clicked',
      'email.bounced': 'email_bounced',
      'email.complained': 'email_complained'
    };

    const engagementType = eventMap[event.type];
    if (!engagementType) {
      return res.json({ received: true });
    }

    // Find the submission by email
    if (isSupabaseConfigured && event.data?.to?.[0]) {
      const recipientEmail = Array.isArray(event.data.to) ? event.data.to[0] : event.data.to;

      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, engagement_status')
        .eq('email', recipientEmail)
        .order('created_at', { ascending: false })
        .limit(1);

      if (submissions && submissions.length > 0) {
        const sub = submissions[0];
        await logEngagement(sub.id, engagementType, event.data);
        logEngagementToSheets(recipientEmail, engagementType, event.data).catch(() => {});

        // Update status on meaningful engagement
        if (engagementType === 'email_opened' || engagementType === 'link_clicked') {
          if (sub.engagement_status !== 'replied' && sub.engagement_status !== 'engaged') {
            await updateEngagementStatus(sub.id, 'engaged');
            updateSubmissionStatusInSheets(recipientEmail, 'engaged').catch(() => {});
          }
        }

        // Update email_logs status for bounces
        if (engagementType === 'email_bounced') {
          await supabase
            .from('email_logs')
            .update({ status: 'bounced' })
            .eq('recipient_email', recipientEmail)
            .order('created_at', { ascending: false })
            .limit(1);
          logEmailToSheets(recipientEmail, 'bounce', '', 'bounced', '').catch(() => {});
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// POST /api/webhook/reply — Inbound reply tracking (Resend inbound webhook or manual)
app.post('/api/webhook/reply', async (req, res) => {
  try {
    const { from, subject, text } = req.body;
    const senderEmail = typeof from === 'string' ? from : from?.address;

    console.log(`💬 Reply received from: ${senderEmail}`);

    if (!senderEmail || !isSupabaseConfigured) {
      return res.json({ received: true });
    }

    // Find submission by sender email
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id')
      .eq('email', senderEmail)
      .order('created_at', { ascending: false })
      .limit(1);

    if (submissions && submissions.length > 0) {
      const subId = submissions[0].id;

      // Update status to replied
      await updateEngagementStatus(subId, 'replied');

      // Log the reply event
      await logEngagement(subId, 'reply_received', {
        subject: subject || '',
        preview: (text || '').substring(0, 200)
      });

      // Cancel pending follow-ups for this submission
      await supabase
        .from('scheduled_emails')
        .update({ sent: true, sent_at: new Date().toISOString() })
        .eq('submission_id', subId)
        .eq('sent', false);

      // Sync to Google Sheets
      updateSubmissionStatusInSheets(senderEmail, 'replied').catch(() => {});
      logEngagementToSheets(senderEmail, 'reply_received', { subject: subject || '', source: 'email_reply' }).catch(() => {});

      console.log(`✓ Marked submission ${subId} as replied, cancelled follow-ups`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Reply webhook error:', error);
    res.status(500).json({ error: 'Reply processing failed' });
  }
});

// POST /api/newsletter/subscribe — Update newsletter subscription
app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { email, subscribe } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    if (!isSupabaseConfigured) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }

    const { data, error } = await supabase
      .from('submissions')
      .update({
        newsletter_subscription: subscribe !== false,
        updated_at: new Date().toISOString()
      })
      .eq('email', email)
      .select();

    if (error) throw new Error(error.message);

    if (data && data.length > 0) {
      const eventType = subscribe !== false ? 'opt_in' : 'opt_out';
      await logEngagement(data[0].id, eventType, { source: 'newsletter_endpoint' });
      logEngagementToSheets(email, eventType, { source: 'newsletter_endpoint' }).catch(() => {});
    }

    res.json({ success: true, subscribed: subscribe !== false });
  } catch (error) {
    console.error('❌ Newsletter update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update subscription' });
  }
});

// GET /api/health — Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      supabase: isSupabaseConfigured,
      resend: isResendConfigured,
      googleSheets: isGoogleSheetsConfigured
    },
    timestamp: new Date().toISOString()
  });
});

// POST /api/admin/mark-replied — Manually mark a submission as replied by email
app.post('/api/admin/mark-replied', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    if (!isSupabaseConfigured) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }

    // Find submission by email
    const { data: submissions, error: findError } = await supabase
      .from('submissions')
      .select('id, name, email, engagement_status')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    if (findError) throw new Error(findError.message);

    if (!submissions || submissions.length === 0) {
      return res.status(404).json({ success: false, error: `No submission found for ${email}` });
    }

    const sub = submissions[0];

    // Update status to replied
    await updateEngagementStatus(sub.id, 'replied');

    // Log the reply event
    await logEngagement(sub.id, 'reply_received', { source: 'manual_admin', marked_at: new Date().toISOString() });

    // Cancel pending follow-ups
    const { data: cancelled } = await supabase
      .from('scheduled_emails')
      .update({ sent: true, sent_at: new Date().toISOString() })
      .eq('submission_id', sub.id)
      .eq('sent', false)
      .select();

    const cancelledCount = cancelled ? cancelled.length : 0;

    console.log(`✓ Marked ${email} as replied, cancelled ${cancelledCount} follow-up(s)`);

    // Sync to Google Sheets
    updateSubmissionStatusInSheets(email, 'replied').catch(() => {});
    logEngagementToSheets(email, 'reply_received', { source: 'manual_admin' }).catch(() => {});

    res.json({
      success: true,
      message: `Marked ${sub.name} (${email}) as replied`,
      cancelled_followups: cancelledCount,
      submission: { id: sub.id, name: sub.name, email: sub.email, engagement_status: 'replied' }
    });
  } catch (error) {
    console.error('❌ Mark replied error:', error);
    res.status(500).json({ success: false, error: 'Failed to update reply status' });
  }
});

// GET /api/submissions — List all submissions (admin — add auth in production)
app.get('/api/submissions', async (req, res) => {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*, email_logs(*), engagement_events(*), scheduled_emails(*)')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return res.json(data);
    } catch (err) {
      console.error('❌ Fetch submissions error:', err.message);
    }
  }

  // Fallback to local file
  const submissionsFile = path.join(__dirname, 'submissions.json');
  if (!fs.existsSync(submissionsFile)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(submissionsFile, 'utf8')));
});

// ─── Start Server ──────────────────────────────────────────────────────────────

async function start() {
  await initializeGoogleSheets();
  await initializeSheets();

  // Process follow-up emails every 10 minutes
  setInterval(processScheduledEmails, 10 * 60 * 1000);
  // Also run once on startup (after a short delay)
  setTimeout(processScheduledEmails, 5000);

  app.listen(PORT, () => {
    console.log(`\n✓ Server running at http://localhost:${PORT}`);
    console.log(`✓ Contact form API:    POST http://localhost:${PORT}/api/contact`);
    console.log(`✓ Email webhook:       POST http://localhost:${PORT}/api/webhook/email`);
    console.log(`✓ Reply webhook:       POST http://localhost:${PORT}/api/webhook/reply`);
    console.log(`✓ Newsletter:          POST http://localhost:${PORT}/api/newsletter/subscribe`);
    console.log(`✓ Health check:        GET  http://localhost:${PORT}/api/health`);
    console.log(`✓ Follow-up processor: Running every 10 minutes\n`);
  });
}

start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
