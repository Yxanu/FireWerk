Perfect 🔥 — here’s the Coolify deployment note I’d include as a standalone file inside the project.
I’ll also add it to the ZIP as COOLIFY_DEPLOY.md if you confirm.

⸻

COOLIFY_DEPLOY.md

🚀 Deploying FireWerk with Coolify on Hetzner

Goal: Run FireWerk as a self-contained automation service (Node + Puppeteer) on a Hetzner VPS managed via Coolify￼.

⸻

🧱 Prerequisites
	•	A running Coolify instance (v4+)
	•	Hetzner (or compatible) VPS with at least 2 GB RAM
	•	Docker installed (Coolify takes care of this)
	•	Your FireWerk repo in GitHub, GitLab, or local import
	•	Your Adobe session cookies file (data/cookies.adobe.json) added securely

⸻

⚙️ 1. Add FireWerk as a new application

In Coolify UI:
	1.	Click “+ Add Resource” → “Application”
	2.	Choose Git Repository → enter your FireWerk repo URL
(or use “Local Files” if you upload directly)
	3.	Branch: main
	4.	Build Pack: Dockerfile
	5.	Base Directory: /
	6.	Name: firewerk
	7.	Exposed Port: 3000 (placeholder - FireWerk doesn't expose HTTP, but Coolify requires a port)

⸻

🔐 2. Environment Variables

Click the Environment Variables tab in Coolify and add:

FIRELFY_URL=https://firefly.adobe.com/generate/images
PROMPT_FILE=./data/prompts.csv
OUTPUT_DIR=./output
HEADLESS=true
COOKIES_PATH=./data/cookies.adobe.json
VARIANTS_PER_PROMPT=1
POST_CLICK_WAIT_MS=9000
BASE_DELAY_MS=1500
JITTER_MS=800

📁 Mount your prompts and cookies folder into the container's /app/data if you want to update them without rebuilding.

⚠️ **Important**: After deploying, you need to add your cookies file to the volume:
1. Go to the "Files" or "Directories" tab in Coolify
2. Navigate to `/app/data/`
3. Upload `cookies.adobe.json` to the volume
4. Or use the Terminal to copy the file: `cp /path/to/cookies.adobe.json /app/data/`

⸻

🪣 3. Persistent storage

Under Storage Volumes, add:

/app/output  →  firewerk_output
/app/data    →  firewerk_data

This keeps your generated images and prompt files between deployments.

**Initial Setup**: After first deployment, upload your `cookies.adobe.json` and `prompts.csv` files to the `/app/data` volume using Coolify's file manager or terminal.

⸻

🔁 4. Deployment & scheduling

FireWerk runs once and exits.
If you want automatic batch runs, add a Coolify Job:
	1.	Go to your FireWerk resource.
	2.	Click “Add Job”
	3.	Command:

npm start


	4.	Schedule e.g. 0 * * * * (once per hour) or @daily for daily runs.

⸻

🧾 5. Logs & monitoring
	•	Coolify → Logs tab shows Puppeteer runs and captured images.
	•	You can tail logs live or use a GlitchTip/Sentry integration (optional).

⸻

🧰 6. Updating the image

If you edit code locally:

git add .
git commit -m "update FireWerk"
git push

Coolify auto-builds and redeploys your container.

⸻

✅ Done!

Once deployed, FireWerk runs on Hetzner inside Coolify, captures Firefly images headlessly, and stores results in /app/output.

⸻

Would you like me to add this file to your existing FireWerk.zip and regenerate it for download?