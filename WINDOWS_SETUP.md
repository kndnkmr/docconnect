# Windows Laptop Setup Guide — DocConnect

This guide walks you through setting up and running the DocConnect project on a **Windows laptop** from scratch. No prior setup assumed.

---

## What You Need to Install (One-Time Setup)

| Tool | What it does | Download Link |
|------|-------------|---------------|
| Node.js | Runs JavaScript on your computer | https://nodejs.org (choose LTS) |
| Git | Copies code from GitHub to your laptop | https://git-scm.com/download/win |
| VS Code | Code editor (view and edit files) | https://code.visualstudio.com |
| MongoDB Atlas | Free cloud database (no install needed) | https://www.mongodb.com/atlas |

---

## Step 1: Install Node.js

1. Go to https://nodejs.org
2. Click the big green **LTS** button (Long Term Support — stable version)
3. Run the downloaded `.msi` file
4. Click **Next** through everything (keep all defaults checked)
5. Important: Make sure **"Add to PATH"** is checked (it is by default)
6. Click **Install** → **Finish**

### Verify it works:
1. Press `Win + R`, type `cmd`, press Enter (opens Command Prompt)
2. Type these commands:
```
node --version
```
Should show something like: `v18.20.2`

```
npm --version
```
Should show something like: `9.8.1`

If you see "not recognized" → restart your computer and try again.

---

## Step 2: Install Git

1. Go to https://git-scm.com/download/win
2. The download should start automatically
3. Run the installer
4. Click **Next** through all options (defaults are fine)
5. On the "Adjusting your PATH environment" screen, keep **"Git from the command line and also from 3rd-party software"** selected
6. Click **Install** → **Finish**

### Verify it works:
Open a NEW Command Prompt (close the old one first):
```
git --version
```
Should show: `git version 2.x.x`

---

## Step 3: Install VS Code

1. Go to https://code.visualstudio.com
2. Click **Download for Windows**
3. Run the installer
4. Check these boxes during install:
   - "Add Open with Code action to Windows Explorer file context menu"
   - "Add to PATH"
5. Click **Install** → **Finish**

### Recommended VS Code Extensions (optional but helpful):
After opening VS Code, click the Extensions icon (left sidebar, looks like 4 squares) and install:
- **ES7+ React/Redux/React-Native snippets** (by dsznajder)
- **Tailwind CSS IntelliSense** (by Tailwind Labs)
- **Error Lens** (by Alexander) — shows errors inline

---

## Step 4: Set Up MongoDB Atlas (Free Cloud Database)

You need a database to store user accounts, appointments, etc. MongoDB Atlas gives you one for free.

### 4.1: Create an account
1. Go to https://www.mongodb.com/atlas
2. Click **"Try Free"**
3. Sign up with Google or email
4. Choose **"FREE"** plan when asked

### 4.2: Create a cluster
1. After signup, you'll see "Create a Deployment"
2. Choose **M0 Free** tier
3. Pick a region close to you (doesn't matter much for learning)
4. Click **"Create Deployment"**

### 4.3: Create a database user
1. On the popup (or go to **Database Access** in left menu)
2. Click **"Add New Database User"**
3. Enter:
   - Username: `docconnect`
   - Password: `docconnect123` (or anything you'll remember)
4. Click **"Add User"**

### 4.4: Allow your computer to connect
1. Go to **Network Access** in the left menu
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (adds 0.0.0.0/0)
4. Click **"Confirm"**

### 4.5: Get your connection string
1. Go to **Database** in the left menu
2. Click **"Connect"** on your cluster
3. Choose **"Drivers"** (Connect your application)
4. You'll see a string like:
   ```
   mongodb+srv://docconnect:<password>@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your actual password: `docconnect123`
6. Add the database name `/docconnect` before the `?`:
   ```
   mongodb+srv://docconnect:docconnect123@cluster0.abc123.mongodb.net/docconnect?retryWrites=true&w=majority
   ```
7. **Copy this string** — you'll need it in Step 6.

---

## Step 5: Clone the Project from GitHub

### 5.1: Open Command Prompt or Git Bash
- Press `Win + R`, type `cmd`, press Enter
- OR right-click on Desktop → "Open Git Bash here" (if available)

### 5.2: Navigate to where you want the project
```
cd Desktop
```

### 5.3: Clone the repository
```
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```
Replace `YOUR_USERNAME/YOUR_REPO_NAME` with your actual GitHub repository path.

### 5.4: Enter the project folder
```
cd YOUR_REPO_NAME
```

### 5.5: Open in VS Code
```
code .
```
This opens the entire project in VS Code.

---

## Step 6: Create the .env File

The `.env` file contains secret configuration. It's NOT in GitHub (for security reasons). You must create it manually.

### 6.1: In VS Code, expand the `server` folder in the left sidebar
### 6.2: Right-click on `server` folder → **"New File"**
### 6.3: Name it exactly: `.env` (yes, starting with a dot)
### 6.4: Paste this content:

```
PORT=5000
MONGODB_URI=mongodb+srv://docconnect:docconnect123@cluster0.abc123.mongodb.net/docconnect?retryWrites=true&w=majority
JWT_SECRET=my_super_secret_key_for_docconnect_app_2024
```

**IMPORTANT:** Replace the `MONGODB_URI` value with YOUR actual connection string from Step 4.5.

### 6.5: Save the file (Ctrl + S)

---

## Step 7: Install Dependencies

You need to download the libraries both the backend and frontend use.

### 7.1: Open a terminal in VS Code
- Click **Terminal** in the top menu → **New Terminal**
- Or press `` Ctrl + ` `` (backtick key, above Tab)

### 7.2: Install backend libraries
```
cd server
npm install
```
Wait for it to finish (may take 1-2 minutes). You'll see a progress bar and then a summary.

### 7.3: Install frontend libraries
```
cd ../client
npm install
```
Wait for it to finish.

If you see "vulnerabilities" warnings — that's normal for a learning project, ignore them.

---

## Step 8: Run the Application

You need TWO terminals running at the same time (one for backend, one for frontend).

### 8.1: Start the Backend

In VS Code terminal:
```
cd server
npm start
```

You should see:
```
==========================================
DocConnect Server is running!
==========================================
URL:          http://localhost:5000
Health Check: http://localhost:5000/api/health
Auth API:     http://localhost:5000/api/auth
Doctors API:  http://localhost:5000/api/doctors
Booking API:  http://localhost:5000/api/appointments
Thesis API:   http://localhost:5000/api/thesis
==========================================
Connected to MongoDB successfully!
```

If you see **"MongoDB connection error"** → your MONGODB_URI in .env is wrong. Go back to Step 4.5.

### 8.2: Start the Frontend (NEW terminal)

Click the **+** icon in the terminal panel to open a second terminal, then:
```
cd client
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### 8.3: Open in Browser

Open Google Chrome (or any browser) and go to:
```
http://localhost:5173
```

You should see the DocConnect landing page!

---

## Step 9: Test the Application

Follow this sequence to verify everything works:

### Test 1: Health Check
Open in browser: `http://localhost:5000/api/health`
Should show: `{"status":"OK","database":"Connected"}`

### Test 2: Register a Doctor
1. Click **Register** in the navbar
2. Select **Doctor**
3. Fill: Name, Email, Password
4. Click Register
5. Should redirect to Dashboard

### Test 3: Set Doctor Profile
1. In Dashboard, click **Edit Profile** tab
2. Fill: Specialization, Experience, Fee, etc.
3. Click Save Profile

### Test 4: Set Availability
1. Click **Availability** tab
2. Add: Monday, 09:00 - 12:00
3. Add: Monday, 14:00 - 17:00
4. Click Save Availability

### Test 5: Register a Patient (use different browser or incognito)
1. Open an **Incognito/Private window** (Ctrl + Shift + N in Chrome)
2. Go to http://localhost:5173
3. Register as **Patient**

### Test 6: Browse Doctors
1. As patient, click **Find Doctors**
2. Should see the doctor you just registered

### Test 7: Book Appointment
1. Click on the doctor → View Profile
2. Click **Book Appointment**
3. Pick a date (choose a Monday since that's what we set)
4. Time slots should appear!
5. Pick one, add reason, click Confirm

### Test 8: Doctor Confirms
1. Go back to the doctor's browser (first window)
2. Dashboard → My Appointments
3. See the pending appointment → Click **Confirm**

### Test 9: Test Password Reset
1. Logout
2. Click **Forgot your password?** on Login page
3. Enter the email you registered with
4. Check the **terminal where the server is running** (not browser)
5. You'll see a reset link printed there
6. Copy the link → paste in browser
7. Enter new password → should auto-login

---

## Stopping the Application

- In each terminal, press `Ctrl + C` to stop the server/frontend
- You can close VS Code — nothing will break

## Starting Again Later

Every time you want to run the project:
1. Open VS Code in the project folder
2. Terminal 1: `cd server` → `npm start`
3. Terminal 2: `cd client` → `npm run dev`
4. Open http://localhost:5173

No need to run `npm install` again (only needed once, or after pulling new code from GitHub).

---

## Troubleshooting (Windows-Specific)

### "npm is not recognized as an internal or external command"
- Node.js wasn't added to PATH
- Fix: Restart your computer. If still broken, reinstall Node.js and check "Add to PATH"

### "git is not recognized"
- Same fix: restart computer or reinstall Git

### "EACCES permission denied" or "EPERM"
- Run Command Prompt as Administrator:
  - Search "cmd" in Start → right-click → "Run as administrator"

### "Port 5000 is already in use"
- Something else is using port 5000
- Fix: Change PORT in .env to `5001`, then also update `vite.config.js` proxy target to `http://localhost:5001`

### "MongoNetworkError" or "connection timed out"
- Your IP might not be whitelisted in Atlas
- Go to MongoDB Atlas → Network Access → make sure 0.0.0.0/0 is there
- Or your internet/firewall is blocking the connection

### "Cannot find module" error
- You forgot to run `npm install`
- Run it again in the correct folder (server/ or client/)

### Terminal shows weird symbols/colors
- Use **Git Bash** instead of Command Prompt (installed with Git)
- Or use VS Code's integrated terminal (it handles colors properly)

### Windows Defender / Firewall popup
- Click **"Allow Access"** — it's just your own server running locally

### Files don't show the dot prefix (.env, .gitignore)
- Windows hides files starting with a dot by default
- In File Explorer: View → Show → Hidden items (check it)
- In VS Code: these files show normally in the sidebar

---

## Optional: Useful Keyboard Shortcuts (VS Code on Windows)

| Shortcut | What it does |
|----------|-------------|
| Ctrl + ` | Open/close terminal |
| Ctrl + Shift + ` | New terminal |
| Ctrl + P | Quick file search |
| Ctrl + Shift + F | Search across all files |
| Ctrl + S | Save file |
| Ctrl + B | Toggle sidebar |
| Alt + Up/Down | Move a line up/down |
| Ctrl + / | Comment/uncomment a line |

---

## What's Next?

Once everything is running:
1. Play with the app — try all features
2. Read through the code files (they have detailed comments)
3. Try making small changes and see what happens
4. Check the main README.md for the learning roadmap and deployment guide

Happy coding!
