import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Insert a new submission into the submissions table
 * @param {Object} submission - The submission data
 * @param {string} submission.name - Full name
 * @param {string} submission.email - Email address
 * @param {string} submission.message - Message/submission details
 * @param {boolean} [submission.newsletter_subscription=false] - Newsletter signup
 * @returns {Promise<Object>} The inserted submission with id
 */
export async function insertSubmission(submission) {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .insert([
        {
          name: submission.name,
          email: submission.email,
          message: submission.message,
          newsletter_subscription: submission.newsletter_subscription || false,
          reply_status: 'pending' // Default status
        }
      ])
      .select();

    if (error) {
      throw new Error(`Supabase insert error: ${error.message}`);
    }

    return data[0];
  } catch (error) {
    console.error('Error inserting submission:', error);
    throw error;
  }
}

/**
 * Get all submissions
 * @returns {Promise<Array>} Array of submissions
 */
export async function getSubmissions() {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error fetching submissions:', error);
    throw error;
  }
}

/**
 * Update submission reply status
 * @param {number} id - Submission ID
 * @param {string} status - New reply status (e.g., 'replied', 'pending', 'archived')
 * @returns {Promise<Object>} Updated submission
 */
export async function updateReplyStatus(id, status) {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .update({ reply_status: status })
      .eq('id', id)
      .select();

    if (error) {
      throw new Error(`Supabase update error: ${error.message}`);
    }

    return data[0];
  } catch (error) {
    console.error('Error updating reply status:', error);
    throw error;
  }
}

/**
 * Get submissions by email
 * @param {string} email - Email address to search
 * @returns {Promise<Array>} Array of submissions matching the email
 */
export async function getSubmissionsByEmail(email) {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error fetching submissions by email:', error);
    throw error;
  }
}
