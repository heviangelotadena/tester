#!/usr/bin/env node

/**
 * seed-data.js — Populate Supabase + Google Sheets with 20 realistic submissions
 *
 * Usage:
 *   node seed-data.js              # Insert 20 submissions via the API
 *   node seed-data.js --direct     # Insert directly into Supabase (faster, no emails)
 *   node seed-data.js --clear      # Clear all test data first, then seed
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const args = process.argv.slice(2);
const DIRECT = args.includes('--direct');
const CLEAR = args.includes('--clear');
const API_URL = 'http://localhost:3000';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// 20 realistic sample submissions
const sampleData = [
  { name: 'Sarah Chen', email: 'sarah.chen@techcorp.io', message: 'We\'re running a team of 15 QA engineers and our regression suite takes 6 hours. Can Tester.io help us get that under an hour?', newsletter: true, status: 'replied' },
  { name: 'Marcus Johnson', email: 'mjohnson@devstudio.com', message: 'Interested in your AI-powered test generation. We currently write everything manually in Selenium. Looking for a modern alternative.', newsletter: true, status: 'engaged' },
  { name: 'Priya Patel', email: 'priya@startuplab.co', message: 'We\'re a 5-person startup launching our MVP next month. Need automated testing but don\'t have dedicated QA. Is Tester.io right for us?', newsletter: true, status: 'email_sent' },
  { name: 'James Mitchell', email: 'james.m@financeplus.com', message: 'Our compliance team requires full test coverage reports. Does Tester.io integrate with JIRA and provide exportable reports?', newsletter: false, status: 'replied' },
  { name: 'Emma Rodriguez', email: 'emma.r@designhub.io', message: 'Looking for visual regression testing specifically. We ship UI changes daily and need to catch pixel-level differences automatically.', newsletter: true, status: 'engaged' },
  { name: 'David Kim', email: 'dkim@cloudscale.dev', message: 'We need API testing at scale — 500+ endpoints across 12 microservices. What\'s your pricing for enterprise?', newsletter: false, status: 'email_sent' },
  { name: 'Lisa Wang', email: 'lisa.wang@edulearn.com', message: 'Our e-learning platform needs accessibility testing (WCAG 2.1). Can Tester.io help automate a11y checks?', newsletter: true, status: 'new' },
  { name: 'Tom Anderson', email: 'tanderson@retailnow.com', message: 'We run an e-commerce platform with heavy traffic during sales. Need load testing + functional testing in one tool. Is that possible?', newsletter: true, status: 'replied' },
  { name: 'Nina Volkov', email: 'nina.v@secureops.io', message: 'Security testing is our priority. Does Tester.io include OWASP scanning or integrate with security tools like Snyk?', newsletter: false, status: 'email_sent' },
  { name: 'Alex Thompson', email: 'alex@gamedev.studio', message: 'We build mobile games and need cross-platform testing for iOS and Android. Do you support mobile testing?', newsletter: true, status: 'engaged' },
  { name: 'Rachel Foster', email: 'rachel.f@healthapi.com', message: 'HIPAA compliance is critical for us. Can you confirm that Tester.io doesn\'t store any PHI during test runs?', newsletter: false, status: 'replied' },
  { name: 'Omar Hassan', email: 'omar@buildfast.io', message: 'I saw your demo at the DevOps conference last week. We want to pilot Tester.io with our CI/CD pipeline (GitHub Actions). How do we start?', newsletter: true, status: 'engaged' },
  { name: 'Sophie Laurent', email: 'sophie.l@creativeco.fr', message: 'Bonjour! We\'re a French design agency. Does Tester.io support multi-language testing and localization checks?', newsletter: true, status: 'email_sent' },
  { name: 'Ryan Brooks', email: 'rbrooks@saasmetrics.com', message: 'We need to test our SaaS dashboard across 50+ customer configurations. Can Tester.io handle parameterized test suites?', newsletter: false, status: 'new' },
  { name: 'Aisha Okafor', email: 'aisha@afritech.ng', message: 'We\'re building for markets with slow internet. Need to test our app under various network conditions. Does Tester.io support network throttling?', newsletter: true, status: 'email_sent' },
  { name: 'Michael Zhang', email: 'mzhang@automate.ai', message: 'Currently using Cypress but hitting scaling issues with 2000+ tests. Evaluating Tester.io as a replacement. Can we do a POC?', newsletter: true, status: 'replied' },
  { name: 'Kayla Bennett', email: 'kayla.b@nonprofit.org', message: 'We\'re a nonprofit with a small budget. Do you offer any discounts or free tiers for non-profit organizations?', newsletter: true, status: 'new' },
  { name: 'Daniel Park', email: 'dpark@fintechpay.com', message: 'PCI-DSS compliance requires us to test payment flows regularly. Need a tool that can safely test with mock payment data. Interested in a demo.', newsletter: false, status: 'engaged' },
  { name: 'Olivia Martinez', email: 'olivia.m@greentech.eco', message: 'Our sustainability platform needs end-to-end testing for our carbon calculator. The logic is complex with many edge cases.', newsletter: true, status: 'email_sent' },
  { name: 'Chris Walker', email: 'cwalker@devagency.co', message: 'We manage testing for 8 different clients. Need a multi-tenant solution. Does Tester.io support workspace separation and team management?', newsletter: true, status: 'replied' },
];

async function clearData() {
  console.log('🗑️  Clearing existing test data...');

  // Delete in order due to foreign keys
  await supabase.from('scheduled_emails').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('engagement_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('email_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('✅ All data cleared\n');
}

async function seedViaAPI() {
  console.log('🌱 Seeding via API (submissions + emails + follow-ups)...\n');

  for (let i = 0; i < sampleData.length; i++) {
    const person = sampleData[i];
    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: person.name,
          email: person.email,
          message: person.message,
          newsletter_subscription: person.newsletter
        })
      });

      const data = await res.json();
      const icon = data.success ? '✅' : '❌';
      console.log(`  ${icon} ${i + 1}/20 ${person.name} <${person.email}>`);

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.log(`  ❌ ${i + 1}/20 ${person.name}: ${err.message}`);
    }
  }

  // Now update statuses to create realistic engagement data
  console.log('\n📊 Setting engagement statuses...');
  for (const person of sampleData) {
    if (person.status !== 'new') {
      await supabase
        .from('submissions')
        .update({ engagement_status: person.status })
        .eq('email', person.email);
    }

    // Add engagement events for replied/engaged users
    if (person.status === 'replied' || person.status === 'engaged') {
      const { data: sub } = await supabase
        .from('submissions')
        .select('id')
        .eq('email', person.email)
        .single();

      if (sub) {
        if (person.status === 'replied') {
          await supabase.from('engagement_events').insert([{
            submission_id: sub.id,
            event_type: 'reply_received',
            event_data: { source: 'seed_data', replied_at: randomPastDate(1, 10) }
          }]);
          // Cancel follow-ups for replied users
          await supabase
            .from('scheduled_emails')
            .update({ sent: true, sent_at: new Date().toISOString() })
            .eq('submission_id', sub.id)
            .eq('sent', false);
        }

        if (person.status === 'engaged') {
          await supabase.from('engagement_events').insert([{
            submission_id: sub.id,
            event_type: 'email_opened',
            event_data: { source: 'seed_data', opened_at: randomPastDate(1, 5) }
          }, {
            submission_id: sub.id,
            event_type: 'link_clicked',
            event_data: { source: 'seed_data', url: 'https://tester.io/features' }
          }]);
        }
      }
    }
  }

  console.log('✅ Engagement statuses set\n');
}

async function seedDirect() {
  console.log('🌱 Seeding directly into Supabase (no emails)...\n');

  for (let i = 0; i < sampleData.length; i++) {
    const person = sampleData[i];
    const createdAt = randomPastDate(1, 30);

    try {
      const { data: sub, error } = await supabase
        .from('submissions')
        .upsert([{
          name: person.name,
          email: person.email,
          message: person.message,
          newsletter_subscription: person.newsletter,
          engagement_status: person.status,
          created_at: createdAt
        }], { onConflict: 'email' })
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Add confirmation email log
      await supabase.from('email_logs').insert([{
        submission_id: sub.id,
        recipient_email: person.email,
        email_type: 'confirmation',
        subject: `Thanks for reaching out, ${person.name}!`,
        status: 'sent',
        sent_at: createdAt
      }]);

      // Add follow-up emails
      const followUps = ['follow_up_1', 'follow_up_2', 'follow_up_3'];
      for (let j = 0; j < followUps.length; j++) {
        const scheduledFor = new Date(new Date(createdAt).getTime() + (j + 1) * 5 * 24 * 60 * 60 * 1000).toISOString();
        const isSent = person.status === 'replied' || (person.status === 'engaged' && j < 2);

        await supabase.from('scheduled_emails').insert([{
          submission_id: sub.id,
          email_type: followUps[j],
          scheduled_for: scheduledFor,
          sent: isSent,
          sent_at: isSent ? scheduledFor : null
        }]);

        if (isSent) {
          await supabase.from('email_logs').insert([{
            submission_id: sub.id,
            recipient_email: person.email,
            email_type: followUps[j],
            subject: getFollowUpSubject(person.name, j + 1),
            status: 'sent',
            sent_at: scheduledFor
          }]);
        }
      }

      // Add engagement events based on status
      if (person.status === 'replied') {
        await supabase.from('engagement_events').insert([
          { submission_id: sub.id, event_type: 'email_opened', event_data: { source: 'seed' }, created_at: randomPastDate(1, 10) },
          { submission_id: sub.id, event_type: 'reply_received', event_data: { source: 'seed' }, created_at: randomPastDate(1, 5) }
        ]);
      } else if (person.status === 'engaged') {
        await supabase.from('engagement_events').insert([
          { submission_id: sub.id, event_type: 'email_opened', event_data: { source: 'seed' }, created_at: randomPastDate(1, 10) },
          { submission_id: sub.id, event_type: 'link_clicked', event_data: { url: 'https://tester.io/features', source: 'seed' }, created_at: randomPastDate(1, 7) }
        ]);
      } else if (person.status === 'email_sent') {
        await supabase.from('engagement_events').insert([
          { submission_id: sub.id, event_type: 'email_delivered', event_data: { source: 'seed' }, created_at: createdAt }
        ]);
      }

      if (person.newsletter) {
        await supabase.from('engagement_events').insert([{
          submission_id: sub.id,
          event_type: 'opt_in',
          event_data: { source: 'contact_form' },
          created_at: createdAt
        }]);
      }

      console.log(`  ✅ ${i + 1}/20 ${person.name} (${person.status})`);
    } catch (err) {
      console.log(`  ❌ ${i + 1}/20 ${person.name}: ${err.message}`);
    }
  }

  console.log('');
}

function randomPastDate(minDays, maxDays) {
  const daysAgo = minDays + Math.random() * (maxDays - minDays);
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function getFollowUpSubject(name, num) {
  const subjects = [
    `${name}, here's how teams are shipping 3x faster`,
    `${name}, see what our customers are saying`,
    `${name}, a quick update from Tester.io`
  ];
  return subjects[Math.min(num - 1, subjects.length - 1)];
}

async function main() {
  console.log('🚀 Tester.io Data Seeder\n');

  if (CLEAR) await clearData();

  if (DIRECT) {
    await seedDirect();
  } else {
    // Check if server is running
    try {
      await fetch(`${API_URL}/api/health`);
    } catch {
      console.error('❌ Server not running at http://localhost:3000');
      console.error('   Start it with: node server.js');
      console.error('   Or use --direct to insert directly into Supabase');
      process.exit(1);
    }
    await seedViaAPI();
  }

  // Print summary
  const { data: subs } = await supabase.from('submissions').select('engagement_status');
  const { data: emails } = await supabase.from('email_logs').select('id');
  const { data: events } = await supabase.from('engagement_events').select('id');
  const { data: scheduled } = await supabase.from('scheduled_emails').select('id');

  const statusCounts = {};
  (subs || []).forEach(s => {
    statusCounts[s.engagement_status] = (statusCounts[s.engagement_status] || 0) + 1;
  });

  console.log('─'.repeat(50));
  console.log('📊 Database Summary:');
  console.log(`   Submissions:       ${subs?.length || 0}`);
  console.log(`   Email logs:        ${emails?.length || 0}`);
  console.log(`   Engagement events: ${events?.length || 0}`);
  console.log(`   Scheduled emails:  ${scheduled?.length || 0}`);
  console.log('');
  console.log('   Status breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    const icon = { new: '🆕', email_sent: '📧', engaged: '👀', replied: '✅' }[status] || '❓';
    console.log(`     ${icon} ${status}: ${count}`);
  });
  console.log('─'.repeat(50));
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
