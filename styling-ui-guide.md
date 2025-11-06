
🧱 FireWerk — Styling & UI Improvement Guide

Adobe Firefly Automation Interface

Version 1.0 · November 2025

⸻

1️⃣ Design Philosophy

FireWerk merges creative automation with elegant precision — a hybrid of developer utility and creative studio.
Its identity should feel like a creative control room: minimal, cinematic, and tactile.

Core aesthetic:

Glassmorphism + Ember Glow + Technical Elegance

⸻

2️⃣ Core Visual Language

✦ Glassmorphism System

Layer	Purpose	Style
Background Layer	Ambient glow / depth separation	Linear gradient (#0E0C0D → #1C1A1B) with blurred orange ember highlight radial spots
Glass Panels	Primary content containers (cards, modals, tabs)	Transparent black (rgba(20,20,20,0.55)), backdrop-filter: blur(24px), border 1px solid rgba(255,255,255,0.08), subtle inner shadow
Interactive Elements	Buttons, dropdowns, tabs	Slightly less transparent (rgba(30,30,30,0.65)), highlight edges with rgba(255,255,255,0.12) border, hover glow in ember red-orange
Lighting	Soft ambient inner glow	Gradient radial highlight (center-to-corner), low opacity #FF6B3E glow
Depth	Layered parallax hierarchy	Use Z-depth and shadow layering — subtle motion blur or scaling on hover for tactile feedback


⸻

3️⃣ Color System

Role	Hex	Use
Primary Glow (Ember Red)	#FF3C2F	Accent + Active Glow
Secondary (Firelight Orange)	#FF6B3E	Hover, active borders
Background Deep Black	#0E0C0D	Main background
Glass Tint Dark	rgba(25, 25, 25, 0.55)	Panel base
Text Primary (Warm White)	#F3F3F3	Headings & labels
Text Secondary (Ash Gray)	#A7A7A7	Descriptions, secondary labels
UI Border Glow	rgba(255, 60, 47, 0.25)	Button edges, active tab outlines
Disabled / Divider	rgba(255, 255, 255, 0.05)	Separator lines


⸻

4️⃣ Typography

Context	Font	Weight	Letter Spacing	Notes
Logo / Branding	Space Grotesk	700	0.05em	Uppercase, wide tracking
Headings (Tabs, Section Titles)	Inter	600	0	Slight glow shadow
Body / Labels	Inter	400	0	Compact line-height 1.4
Monospace (Paths, CLI Info)	JetBrains Mono	400	0	Code/Output areas

CSS Example:

body {
  font-family: 'Inter', sans-serif;
  color: #F3F3F3;
  background: radial-gradient(circle at top left, #1C1A1B, #0E0C0D 80%);
  backdrop-filter: blur(20px);
}
h1, h2, h3 {
  font-family: 'Space Grotesk', sans-serif;
  letter-spacing: 0.05em;
}
code {
  font-family: 'JetBrains Mono', monospace;
}


⸻

5️⃣ Buttons & Controls

🔘 Primary Button
	•	Gradient: linear-gradient(90deg, #FF3C2F 0%, #FF6B3E 100%)
	•	Border-radius: 12px
	•	Text color: #FFF
	•	Shadow: 0 0 12px rgba(255, 60, 47, 0.3)
	•	Hover: Glow pulse animation

.button-primary {
  background: linear-gradient(90deg, #FF3C2F, #FF6B3E);
  border-radius: 12px;
  color: #FFF;
  padding: 10px 20px;
  box-shadow: 0 0 12px rgba(255, 60, 47, 0.3);
  transition: all 0.3s ease;
}
.button-primary:hover {
  box-shadow: 0 0 20px rgba(255, 107, 62, 0.6);
  transform: translateY(-1px);
}

🔲 Dropdowns / Selects
	•	Transparent glass background
	•	backdrop-filter: blur(20px)
	•	Soft red/orange glow outline when focused

⸻

6️⃣ Tabs & Navigation

State	Color	Style
Default	#A7A7A7	Lower opacity text
Active	#FF6B3E	Text glow + underline
Hover	#FF3C2F	Soft text color transition
Divider line	rgba(255,255,255,0.05)	Horizontal thin line

Animated underline:
transition: width 0.3s ease, background-color 0.3s;

⸻

7️⃣ Cards & Panels

General Card Style

.card {
  background: rgba(20, 20, 20, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  backdrop-filter: blur(24px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  padding: 24px;
  transition: all 0.25s ease;
}
.card:hover {
  box-shadow: 0 8px 40px rgba(255, 107, 62, 0.15);
}

Special Note:
Panels with dynamic data (like outputs or logs) should have slightly darker backgrounds for contrast clarity.

⸻

8️⃣ Animations & Interactivity

Element	Animation	Description
Start Button	Ember pulse	Glow expands subtly every 1.5s
Tabs	Fade-in slide	When switching views
Panels	Blur fade-in	When opened
Hover elements	Soft scaling (1.02x)	Feels tactile
Progress bar (generation)	Orange glow sweep	Subtle linear gradient moving pulse


⸻

9️⃣ Accessibility & UX Enhancements
	•	Maintain contrast ratio ≥ 4.5:1
	•	Support keyboard focus rings in orange glow (outline: 2px solid #FF6B3E;)
	•	Ensure clear status feedback (success = greenish glow #7BFFBA, error = red glow #FF3C2F)
	•	Tooltip system for complex options like “Capture Mode” or “Model”

⸻

🔟 Suggested UI Improvements

Area	Current	Improvement
Prompt selector	Plain dropdown	Add searchable multi-select with tags, soft glass popup
Tabs (Generate / Outputs / History)	Flat	Add glow underline + animated transition
Variant counter	Basic input	Replace with segmented button group (1, 2, 4)
Output directory	Plain text input	Add folder icon + path browser modal
Capture mode	Dropdown	Add small preview tooltips showing capture examples
Theme toggle	None	Add “Light / Dark / Glow” theme switch in top-right
Outputs view	Static list	Grid of cards with thumbnails, date, and re-run button


⸻

11️⃣ Example: Component Theme Token Map (for Tailwind or CSS Variables)

:root {
  --fw-color-bg: rgba(20,20,20,0.55);
  --fw-color-accent: #FF3C2F;
  --fw-color-accent-alt: #FF6B3E;
  --fw-color-text: #F3F3F3;
  --fw-blur: 24px;
  --fw-radius: 16px;
}


⸻

12️⃣ Next Steps for Dev Implementation
	1.	Refactor UI with layered glass containers
	•	Modularize panels for future plugin tabs.
	2.	Implement Tailwind with custom theme tokens
	•	firewerk.config.js for unified palette.
	3.	Add Framer Motion / GSAP animations
	•	For ember glows, tab transitions, and subtle UI movement.
	4.	Integrate CSS variables for easy theming
	•	Allow user color customization in preferences.
	5.	Responsive pass
	•	Breakpoints for 1024px / 768px / mobile (scroll-based glass compression).

⸻

Would you like me to follow up by creating a matching Tailwind theme config + base component library (buttons, cards, inputs, tabs) as a .zip starter for this UI system?