# Contact Form - Quick Start Reference

## ✅ What's Been Added

### 1. **Contact Form Section** (index.html)
- Clean, professional form with Name, Email, Message fields
- Styled to match your Tester.io brand (gold #C6A559)
- Located between hero section and features
- Fully responsive with dark mode support
- Integrated animations and validation

### 2. **Express Backend** (server.js)
- RESTful API endpoint: `POST /api/contact`
- Error handling and validation
- CORS enabled for cross-origin requests
- Health check: `GET /api/health`
- Admin endpoint: `GET /api/submissions`

### 3. **Google Sheets Integration**
- Automatic form submissions saved to Google Sheets
- Fallback: Local JSON storage if Google Sheets unavailable
- Service account authentication (secure)
- Timestamp tracking for all submissions

### 4. **Thank You Page** (thank-you.html)
- Professional success page with animations
- Auto-redirect option (currently 2 seconds)
- Matches site design and branding

### 5. **Documentation**
- SETUP_GUIDE.md - Complete step-by-step instructions
- .env.example - Environment template
- .gitignore - Security precautions

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start Server
```bash
npm start
```

You should see:
```
✓ Server running at http://localhost:3000
```

### Step 3: Test the Form
1. Open `http://localhost:3000` in your browser
2. Scroll to the **"We'd love to hear from you"** contact section
3. Fill in the form and click "Send Message"
4. Success message appears → redirects to thank you page

**That's it!** The form works without Google Sheets. Submissions save locally to `submissions.json`.

---

## 📊 Setting Up Google Sheets (Optional - 10 Minutes)

If you want submissions saved to Google Sheets:

### 1. Create Google Cloud Project
- Go to [console.cloud.google.com](https://console.cloud.google.com)
- New Project → "Tester Contact Form"

### 2. Enable Google Sheets API
- APIs & Services → Library
- Search "Google Sheets API" → Enable

### 3. Create Service Account
- APIs & Services → Credentials
- Create Credentials → Service Account
- Name: `tester-contact-form`
- Create and Continue → Done
- Go to Keys tab → Add Key → JSON (download file)

### 4. Create Google Sheet
- Go to [sheets.google.com](https://sheets.google.com)
- New spreadsheet: "Contact Form Submissions"
- Add headers: Name | Email | Message | Timestamp
- Copy spreadsheet ID from URL

### 5. Share Sheet & Configure
- In Google Sheet: Share → add your service account email
- Create `.env` file in project root:
  ```
  SPREADSHEET_ID=your_id_here
  SHEET_NAME=Form Submissions
  GOOGLE_SERVICE_ACCOUNT={"your":"json","file":"here"}
  PORT=3000
  ```

### 6. Restart Server
```bash
npm start
```

Now submissions automatically go to Google Sheets!

---

## 📁 File Structure

```
project-root/
├── index.html              # Main page with contact form
├── thank-you.html          # Redirect page after submit
├── server.js               # Express backend (NEW)
├── package.json            # Dependencies (UPDATED)
├── .env                    # Your credentials (CREATE THIS)
├── .env.example            # Template (reference)
├── .gitignore              # Security (UPDATED)
├── SETUP_GUIDE.md          # Full documentation
├── submissions.json        # Local fallback (auto-created)
└── brand_assets/           # Logo files
```

---

## 🔗 Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/contact` | Submit form |
| GET | `/api/health` | Check server status |
| GET | `/api/submissions` | View all submissions |

---

## 💡 Important Notes

### ⚠️ Security
- **Never commit `.env`** - contains sensitive credentials
- Already in `.gitignore` ✓
- Rotate Google service account keys regularly

### 🧪 Testing
- Form works **without** Google Sheets (local fallback)
- Always keep `npm start` running while developing
- Use `http://localhost:3000` (not `file:///`)
- Check browser console (F12) for errors

### 🎨 Customization
- Form styling: CSS in `index.html` under `<style>`
- Colors: Primary (#C6A559), Dark (#A88A3D), Light (#E6B979)
- Redirect timing: Change `setTimeout(..., 2000)` in form submission code
- Add fields: Edit HTML form + backend validation + Google Sheets columns

### 📱 Responsive
- Mobile-first design
- Tested on desktop, tablet, mobile
- Dark mode support included

---

## ❓ Troubleshooting

**Q: "Failed to send message" error?**
- Is `npm start` running? Check terminal
- Open DevTools (F12) → Network tab → check POST request
- Look for CORS errors in console

**Q: Form doesn't submit?**
- Check browser console for JavaScript errors
- Verify all fields are filled (Name, Email, Message required)
- Verify email format is correct

**Q: Google Sheets not updating?**
- Check `.env` file exists and has correct values
- Verify service account email has editor access to sheet
- Check server logs for detailed error message
- Submissions still save to `submissions.json` (local fallback)

**Q: Port 3000 already in use?**
```bash
# Kill the process (Windows PowerShell):
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
```

---

## 📖 Next Steps

1. **Immediate**: Test form locally with `npm start`
2. **Optional**: Set up Google Sheets (follow SETUP_GUIDE.md)
3. **Customization**: Add more fields or change styling
4. **Deployment**: Deploy to Vercel, Heroku, or your server
5. **Emails**: Add email notifications (see SETUP_GUIDE.md)

---

## 📞 Form Submission Flow

```
User fills form
        ↓
Client-side validation
        ↓
POST /api/contact (with data)
        ↓
Server validation
        ↓
Save to Google Sheets (if configured)
        ↓
Fallback: Save to submissions.json
        ↓
Return success to frontend
        ↓
Show success message
        ↓
Redirect to /thank-you.html
```

---

## 🎯 Your Next Action

```bash
npm install
npm start
# Open http://localhost:3000 in browser
# Test the contact form!
```

That's all you need to get started. Enjoy! 🚀
