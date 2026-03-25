#!/usr/bin/env node

/**
 * send-followups.js — Standalone script to process follow-up emails
 *
 * Usage:
 *   node send-followups.js           # Process all due follow-ups
 *   node send-followups.js --status  # Show queue status only (no emails sent)
 *   node send-followups.js --dry-run # Show what would be sent without sending
 *   node send-followups.js --force   # Send all pending follow-ups regardless of schedule
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Tester.io <onboarding@resend.dev>';
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || 'support@tester.io';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Form Submissions';

const args = process.argv.slice(2);
const STATUS_ONLY = args.includes('--status');
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

// ─── Google Sheets Setup ───────────────────────────────────────────────────────

let sheets;
let isSheetsReady = false;

async function initSheets() {
  try {
    let credentials;
    if (process.env.GOOGLE_SERVICE_ACCOUNT) {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    } else if (fs.existsSync(path.join(__dirname, 'credentials.json'))) {
      credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials.json'), 'utf8'));
    } else {
      return;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    sheets = google.sheets({ version: 'v4', auth });
    isSheetsReady = true;
  } catch (err) {
    console.warn('⚠️  Google Sheets not available:', err.message);
  }
}

async function appendToSheet(sheetName, values) {
  if (!isSheetsReady || !SPREADSHEET_ID) return;
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'RAW',
      resource: { values: [values] }
    });
  } catch (err) {
    console.warn(`  ⚠️  Sheets log failed: ${err.message}`);
  }
}

async function updateStatusInSheets(email, newStatus) {
  if (!isSheetsReady || !SPREADSHEET_ID) return;
  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:F`
    });
    if (!data.values) return;
    for (let i = data.values.length - 1; i >= 1; i--) {
      if (data.values[i][1] === email) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${SHEET_NAME}'!E${i + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [[newStatus]] }
        });
        return;
      }
    }
  } catch (err) {
    console.warn(`  ⚠️  Sheets status update failed: ${err.message}`);
  }
}

// ─── Email Templates ───────────────────────────────────────────────────────────

function getFollowUpTemplate(name, followUpNumber) {
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
        </div>
        <p style="color:#676767;font-size:15px;line-height:1.7;text-align:center;">
          Want to see it in action? Just reply to this email and we'll set up a quick demo.
        </p>`
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
        <div style="background:linear-gradient(135deg,rgba(198,165,89,0.08),rgba(198,165,89,0.03));border-radius:12px;padding:24px;margin:0 0 16px;border:1px solid rgba(198,165,89,0.15);">
          <p style="color:#676767;font-size:15px;line-height:1.7;font-style:italic;margin:0 0 8px;">
            "Best testing tool we've integrated. Setup took 15 minutes."
          </p>
          <p style="color:#b2b2b2;font-size:13px;margin:0;">— CTO, FacilityBot</p>
        </div>
        <div style="background:linear-gradient(135deg,rgba(198,165,89,0.08),rgba(198,165,89,0.03));border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid rgba(198,165,89,0.15);">
          <p style="color:#676767;font-size:15px;line-height:1.7;font-style:italic;margin:0 0 8px;">
            "We caught 3 critical bugs in staging that would have cost us $50K in production downtime."
          </p>
          <p style="color:#b2b2b2;font-size:13px;margin:0;">— Engineering Manager, Kriss.ai</p>
        </div>
        <p style="color:#676767;font-size:15px;line-height:1.7;text-align:center;">
          Ready to join them? Reply and let's chat.
        </p>`
    },
    {
      subject: `${name}, a quick update from Tester.io`,
      body: `
        <h1 style="color:#2f2f2f;font-size:22px;text-align:center;margin:0 0 16px;letter-spacing:-0.03em;">
          What's new at Tester.io, ${name}
        </h1>
        <p style="color:#676767;font-size:16px;line-height:1.7;text-align:center;margin:0 0 24px;">
          We've been shipping fast — here are the latest updates that teams are loving:
        </p>
        <div style="background:linear-gradient(135deg,rgba(198,165,89,0.08),rgba(198,165,89,0.03));border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid rgba(198,165,89,0.15);">
          <ul style="color:#676767;font-size:15px;line-height:2;margin:0;padding-left:20px;">
            <li><strong>Visual regression testing</strong> — pixel-perfect UI validation</li>
            <li><strong>API testing suite</strong> — automated endpoint coverage</li>
            <li><strong>Slack integration</strong> — get test results where you work</li>
            <li><strong>50% faster test runs</strong> — new parallel execution engine</li>
            <li><strong>AI bug reports</strong> — auto-generated, developer-ready tickets</li>
          </ul>
        </div>
        <p style="color:#676767;font-size:15px;line-height:1.7;text-align:center;margin:0 0 24px;">
          We'd love to show you how these can help your team. This is our last follow-up — if you're interested, just reply and we'll take it from here.
        </p>`
    }
  ];

  const idx = Math.min(followUpNumber - 1, templates.length - 1);
  return templates[idx];
}

function wrapHtml(bodyContent) {
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - Date.now();
  return (diff / (1000 * 60 * 60 * 24)).toFixed(1);
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'just now';
}

// ─── Status Report ─────────────────────────────────────────────────────────────

async function showStatus() {
  console.log('\n📊 Follow-Up Email Queue Status\n');
  console.log('─'.repeat(80));

  // Get all submissions with their scheduled emails
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('id, name, email, engagement_status, created_at, scheduled_emails(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!submissions || submissions.length === 0) {
    console.log('No submissions found.');
    return;
  }

  let totalPending = 0;
  let totalSent = 0;
  let totalDue = 0;

  for (const sub of submissions) {
    const scheduled = sub.scheduled_emails || [];
    const pending = scheduled.filter(e => !e.sent);
    const sent = scheduled.filter(e => e.sent);
    const due = pending.filter(e => new Date(e.scheduled_for) <= new Date());

    totalPending += pending.length;
    totalSent += sent.length;
    totalDue += due.length;

    const statusIcon = {
      'new': '🆕',
      'email_sent': '📧',
      'engaged': '👀',
      'replied': '✅'
    }[sub.engagement_status] || '❓';

    console.log(`\n${statusIcon} ${sub.name} <${sub.email}>`);
    console.log(`   Status: ${sub.engagement_status} | Submitted: ${timeAgo(sub.created_at)}`);

    if (scheduled.length === 0) {
      console.log('   No follow-ups scheduled');
      continue;
    }

    for (const email of scheduled.sort((a, b) => a.email_type.localeCompare(b.email_type))) {
      const isDue = !email.sent && new Date(email.scheduled_for) <= new Date();
      const icon = email.sent ? '✅' : isDue ? '🔴' : '⏳';
      const timing = email.sent
        ? `Sent ${timeAgo(email.sent_at)}`
        : isDue
          ? `DUE NOW (was ${daysUntil(email.scheduled_for)}d ago)`
          : `In ${daysUntil(email.scheduled_for)} days`;

      console.log(`   ${icon} ${email.email_type}: ${timing}`);
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`📬 Summary: ${totalDue} due now | ${totalPending} pending | ${totalSent} sent`);
  console.log('─'.repeat(80) + '\n');
}

// ─── Send Follow-Ups ──────────────────────────────────────────────────────────

async function processFollowUps() {
  console.log('\n📬 Processing follow-up emails...\n');

  // Build query for pending emails
  let query = supabase
    .from('scheduled_emails')
    .select('*, submissions(*)')
    .eq('sent', false)
    .order('scheduled_for', { ascending: true });

  // Only filter by date if not forcing
  if (!FORCE) {
    query = query.lte('scheduled_for', new Date().toISOString());
  }

  const { data: dueEmails, error } = await query;

  if (error) {
    console.error('❌ Error fetching scheduled emails:', error.message);
    return;
  }

  if (!dueEmails || dueEmails.length === 0) {
    console.log('✅ No follow-up emails to send right now.');
    if (!FORCE) {
      console.log('   Use --force to send all pending emails regardless of schedule.');
    }
    return;
  }

  console.log(`Found ${dueEmails.length} email(s) to process${FORCE ? ' (forced)' : ''}:\n`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const scheduled of dueEmails) {
    const submission = scheduled.submissions;
    if (!submission) {
      console.log(`  ⚠️  Skipping ${scheduled.id} — no linked submission`);
      skipped++;
      continue;
    }

    // Skip if user already replied or engaged
    if (submission.engagement_status === 'replied') {
      console.log(`  ⏭️  Skipping ${submission.email} — already replied`);

      // Mark as sent so we don't process again
      if (!DRY_RUN) {
        await supabase
          .from('scheduled_emails')
          .update({ sent: true, sent_at: new Date().toISOString() })
          .eq('id', scheduled.id);
      }

      skipped++;
      continue;
    }

    const followUpNumber = parseInt(scheduled.email_type.replace('follow_up_', ''), 10);
    const template = getFollowUpTemplate(submission.name, followUpNumber);

    console.log(`  📧 ${scheduled.email_type} → ${submission.email}`);
    console.log(`     Subject: "${template.subject}"`);

    if (DRY_RUN) {
      console.log('     [DRY RUN — not sent]');
      sent++;
      continue;
    }

    if (!resend) {
      console.log('     ❌ Resend not configured — skipping');
      failed++;
      continue;
    }

    try {
      const html = wrapHtml(template.body);

      const { data, error: sendError } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [submission.email],
        replyTo: REPLY_TO_EMAIL,
        subject: template.subject,
        html
      });

      if (sendError) throw new Error(sendError.message);

      // Mark as sent in Supabase
      await supabase
        .from('scheduled_emails')
        .update({ sent: true, sent_at: new Date().toISOString() })
        .eq('id', scheduled.id);

      // Log to email_logs
      await supabase
        .from('email_logs')
        .insert([{
          submission_id: submission.id,
          recipient_email: submission.email,
          email_type: scheduled.email_type,
          subject: template.subject,
          status: 'sent'
        }]);

      // Log engagement event
      await supabase
        .from('engagement_events')
        .insert([{
          submission_id: submission.id,
          event_type: 'follow_up_sent',
          event_data: { email_type: scheduled.email_type, resend_id: data.id }
        }]);

      console.log(`     ✅ Sent (id: ${data.id})`);

      // Sync to Google Sheets
      await appendToSheet('Email Logs', [
        submission.email, scheduled.email_type, template.subject, 'sent', '', new Date().toISOString()
      ]);
      await appendToSheet('Engagement Events', [
        submission.email, 'follow_up_sent', JSON.stringify({ email_type: scheduled.email_type }), new Date().toISOString()
      ]);

      sent++;
    } catch (err) {
      console.log(`     ❌ Failed: ${err.message}`);

      // Log failure
      await supabase
        .from('email_logs')
        .insert([{
          submission_id: submission.id,
          recipient_email: submission.email,
          email_type: scheduled.email_type,
          subject: template.subject,
          status: 'failed',
          error_message: err.message
        }]);

      // Sync failure to Google Sheets
      await appendToSheet('Email Logs', [
        submission.email, scheduled.email_type, template.subject, 'failed', err.message, new Date().toISOString()
      ]);

      failed++;
    }

    // Small delay between sends to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 Results: ${sent} sent | ${skipped} skipped | ${failed} failed`);
  console.log('─'.repeat(60) + '\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Tester.io Follow-Up Email Processor');

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
  }

  if (!process.env.RESEND_API_KEY && !STATUS_ONLY && !DRY_RUN) {
    console.warn('⚠️  RESEND_API_KEY not set — emails cannot be sent');
  }

  // Initialize Google Sheets for syncing
  await initSheets();
  if (isSheetsReady) console.log('✓ Google Sheets connected');

  if (STATUS_ONLY) {
    await showStatus();
  } else {
    await showStatus();
    if (DRY_RUN) console.log('🏃 DRY RUN MODE — no emails will actually be sent\n');
    if (FORCE) console.log('⚡ FORCE MODE — sending all pending regardless of schedule\n');
    await processFollowUps();
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
