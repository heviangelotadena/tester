# Contact Form Setup Guide

Complete guide to set up the contact form with Express backend and Google Sheets integration.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Frontend Setup](#frontend-setup)
3. [Backend Setup](#backend-setup)
4. [Google Sheets Integration](#google-sheets-integration)
5. [Running Locally](#running-locally)
6. [Troubleshooting](#troubleshooting)
7. [Production Deployment](#production-deployment)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your Google Sheets credentials

# 3. Start the server
npm start

# Server runs at http://localhost:3000
```

---

## Frontend Setup

The contact form has already been added to `index.html` with:

- **Location**: Between hero section and features section
- **ID**: `#contact`
- **Fields**: Name, Email, Message
- **Styling**: Matches your existing Tester.io brand design with gold primary color (#C6A559)

### Form Features
- ✓ Client-side validation (email, required fields)
- ✓ Loading state with spinner
- ✓ Success/error messages
- ✓ Responsive design (mobile & desktop)
- ✓ Dark mode support
- ✓ Smooth animations

### Navigation Link
Add this to your navigation menu to link to the contact form:
```html
<a href="#contact" class="nav-link">Contact</a>
```

---

## Backend Setup

### 1. Install Dependencies

```bash
npm install
```

The backend uses:
- **Express**: Web server
- **Google APIs**: Sheets integration
- **CORS**: Cross-origin request handling
- **dotenv**: Environment variable management

### 2. File Structure

```
project-root/
├── server.js              # Express backend
├── index.html             # Main landing page with contact form
├── thank-you.html         # Redirect page after submission
├── package.json           # Dependencies
├── .env.example          # Environment template
├── .env                   # Your configuration (create this)
├── submissions.json       # Local fallback storage
└── brand_assets/          # Logo files
```

### 3. Server.js Endpoints

#### POST `/api/contact`
Receives form submissions and saves to Google Sheets or locally.

**Request**:
```json
{
  "name": "Jane Smith",
  "email": "jane@company.com",
  "message": "I have a question about pricing..."
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Thank you for your submission! We will get back to you soon."
}
```

**Response (Error)**:
```json
{
  "success": false,
  "error": "All fields are required"
}
```

#### GET `/api/health`
Health check endpoint to verify server and Google Sheets status.

**Response**:
```json
{
  "status": "ok",
  "googleSheetsConfigured": true,
  "timestamp": "2026-03-24T10:30:00Z"
}
```

#### GET `/api/submissions` (Admin)
Retrieves all submissions saved locally. In production, add authentication.

---

## Google Sheets Integration

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: Click "Select a Project" → "New Project"
3. Name it "Tester Contact Form"
4. Click "Create"

### Step 2: Enable Google Sheets API

1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Sheets API"
3. Click on it and press **Enable**

### Step 3: Create a Service Account

1. Go to **APIs & Services** → **Credentials**
2. Click **"+ Create Credentials"** → **Service Account**
3. Fill in:
   - **Service account name**: tester-contact-form
   - **Service account ID**: (auto-filled)
4. Click **Create and Continue**
5. Skip optional steps and click **Done**

### Step 4: Create and Download API Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key** → **JSON**
4. A JSON file will download - keep this safe!
5. Copy the entire JSON content

### Step 5: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet: **"Contact Form Submissions"**
3. Add column headers in the first row:
   ```
   Name | Email | Message | Timestamp
   ```
4. Copy the spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
   ```

### Step 6: Share Sheet with Service Account

1. In your Google Sheet, click **Share**
2. Go back to Google Cloud Console and find your service account email
3. It looks like: `tester-contact-form@{project-id}.iam.gserviceaccount.com`
4. Copy this email and paste it in the Share dialog in your Google Sheet
5. Give it **Editor** access

### Step 7: Configure Environment Variables

1. Create a `.env` file in your project root:

```bash
# Copy .env.example as a template
cp .env.example .env
```

2. Edit `.env` and fill in:

```
SPREADSHEET_ID=your_spreadsheet_id_from_step_5
SHEET_NAME=Form Submissions
GOOGLE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","...":...}
PORT=3000
```

3. For `GOOGLE_SERVICE_ACCOUNT`, paste the entire JSON from the key file you downloaded

**Example** (with placeholder values):
```
SPREADSHEET_ID=1K9mL4nOpQrStUvWxYzAaBbCcDdEeFfGgHhIiJjKk
SHEET_NAME=Form Submissions
GOOGLE_SERVICE_ACCOUNT={"type":"service_account","project_id":"tester-contact-form-12345","private_key_id":"abc123...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...pFaX\n-----END PRIVATE KEY-----\n","client_email":"tester-contact-form@tester-contact-form-12345.iam.gserviceaccount.com","client_id":"123456789012345678901","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/..."}
PORT=3000
```

### ⚠️ Security Notes

- **Never commit `.env` to version control** - it contains sensitive credentials
- Add `.env` to `.gitignore`:
  ```
  .env
  submissions.json
  ```
- In production, use environment variable services like Vercel, GitHub Secrets, or AWS Secrets Manager
- Rotate your service account keys regularly

---

## Running Locally

### Using VS Code

#### Method 1: Integrated Terminal

1. Open VS Code from your project root
2. Open Terminal: `Ctrl+`` (backtick)
3. Run:
   ```bash
   npm install
   npm start
   ```

#### Method 2: Run Task

1. Press `Ctrl+Shift+D` to open Run and Debug
2. Create a `.vscode/launch.json` if needed:
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Node",
         "type": "node",
         "request": "launch",
         "program": "${workspaceFolder}/server.js",
         "restart": true,
         "console": "integratedTerminal"
       }
     ]
   }
   ```
3. Click the green play button to start

### Expected Output

```
✓ Server running at http://localhost:3000
✓ Contact form API: POST http://localhost:3000/api/contact
✓ Health check: GET http://localhost:3000/api/health

✓ Google Sheets API initialized
```

### Testing the Form

1. Open browser: `http://localhost:3000`
2. Scroll to the contact form
3. Fill in Name, Email, Message
4. Click "Send Message"
5. Check:
   - Success message appears
   - Redirects to `/thank-you.html` after 2 seconds
   - Data appears in Google Sheets (if configured)

### Testing Locally Without Google Sheets

If you skip Google Sheets setup:
- Form submissions save to `submissions.json` locally
- Visit `http://localhost:3000/api/submissions` to view submissions
- Still works perfectly - Google Sheets is optional

---

## Troubleshooting

### Issue: "Failed to send message"

**Causes**:
1. Server not running - ensure `npm start` is active
2. CORS errors - check browser console
3. Network issues - check network tab in dev tools

**Fix**:
```bash
# Kill any existing processes on port 3000
# Windows: netstat -ano | findstr :3000
# Mac/Linux: lsof -i :3000

# Restart server
npm start
```

### Issue: Google Sheets not updating

**Causes**:
1. `GOOGLE_SERVICE_ACCOUNT` env var not set
2. Service account doesn't have editor access to sheet
3. `SPREADSHEET_ID` is incorrect

**Fix**:
1. Check `.env` file exists and is readable:
   ```bash
   cat .env
   ```
2. Verify service account email has editor access to sheet
3. Check server logs for error messages
4. Verify spreadsheet ID in Google Sheets URL

### Issue: "credentials.json not found"

**Causes**:
- Using environment variable method (recommended) instead of file method

**Fix**:
- This is normal! Server prefers `GOOGLE_SERVICE_ACCOUNT` env var
- If it logs a warning, that's expected
- Submissions will save locally to `submissions.json`

### Issue: Port 3000 already in use

```bash
# Kill process using port 3000
# Windows PowerShell:
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# Mac/Linux:
lsof -ti:3000 | xargs kill -9
```

### Issue: Form not posting to backend

**Check in browser DevTools**:
1. Open DevTools (F12)
2. Go to Network tab
3. Submit form
4. Look for request to `POST /api/contact`
5. Check response status and content

If status is 404: Backend is not running
If status is 5xx: Server error - check console

---

## Deployment

### Option 1: Vercel (Recommended for Beginners)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Sign up and import your repository
4. Add environment variables in project settings
5. Deploy!

### Option 2: Heroku

1. Install Heroku CLI
2. Create Procfile:
   ```
   web: node server.js
   ```
3. Deploy:
   ```bash
   git push heroku main
   ```

### Option 3: Self-Hosted (AWS, DigitalOcean, etc.)

1. Provision a server (Node.js compatible)
2. Install Node.js
3. Clone repository
4. Set environment variables
5. Start with PM2 for persistence:
   ```bash
   npm install -g pm2
   pm2 start server.js
   ```

### Environment Variables in Production

Set these on your hosting platform:
- `SPREADSHEET_ID`
- `SHEET_NAME` (optional, defaults to "Form Submissions")
- `GOOGLE_SERVICE_ACCOUNT`
- `PORT` (most platforms set this automatically)

---

## Customization

### Change Thank You Page Timing

In `index.html`, find the contact form submission code and modify:

```javascript
// Currently redirects after 2 seconds
setTimeout(() => {
  window.location.href = '/thank-you.html';
}, 2000); // Change 2000 (milliseconds) as needed
```

### Add Email Notifications

Install nodemailer and send confirmation emails:

```bash
npm install nodemailer
```

Then in `server.js`:
```javascript
const transporter = nodemailer.createTransport({...});
await transporter.sendMail({
  to: data.email,
  subject: 'We received your message',
  html: '...'
});
```

### Change Form Fields

1. Update HTML form in `index.html`:
   ```html
   <input name="company" placeholder="Your company" />
   ```

2. Update backend validation in `server.js`:
   ```javascript
   const { name, email, message, company } = req.body;
   ```

3. Update Google Sheets columns

---

## Support & Tips

- **Testing locally**: Always develop with `npm start` running
- **Keep port consistent**: Use 3000 for local development
- **Check logs**: Server logs show everything happening
- **Browser console**: Check for CORS or network errors
- **HTTP vs HTTPS**: Make sure to use `http://` when testing locally

Happy shipping! 🚀
