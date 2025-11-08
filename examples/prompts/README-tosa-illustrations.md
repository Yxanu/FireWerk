# TOSA Illustration System — FireWerk Prompt Set

**Visual Direction:** Tactile minimalism for digital craftsmanship
**Mood:** Calm curiosity, focus, precision — "Engineer who sketches in a Moleskine"

---

## Philosophy

These prompts generate illustrations that embody the TOSA design philosophy:

- **Geometric foundation** with organic imperfections
- **Muted tones** with strategic accent colors
- **Diffuse lighting** (no hard shadows)
- **Editorial minimalism** (Le Labo × Notion × Headspace)
- **Human warmth** in digital tools

---

## Color Palette Reference

### Primary TOSA Colors
```
Teal Accent:    #4FD1C5  (cyan/teal — technical confidence)
Warm Sand:      #F6CBA7  (coral/sand — human warmth)
Deep Space:     #050814  (dark background — focus)
Coral Note:     #E08E79  (accent variation)
```

### Project-Specific Accents
```
Moodnose:       #B79BD5  (orchid purple — organic)
Geckio:         #A8C6A1  (moss green — naturalistic)
TypeTaster:     #4FD1C5  (teal — typography tech)
```

---

## Prompt Categories

### 1. Hero Illustrations (16:9)
Large landing page visuals with abstract brand metaphors.

**Characteristics:**
- Floating elements in orbital composition
- Glowing central focal point
- Soft depth blur
- Teal + warm sand palette

**Examples:**
- Browser fragments orbiting teal sphere
- Code blocks under glass dome
- Terminal with spark trails

---

### 2. Section Icons (1:1)
Simplified visual anchors for product cards and feature sections.

**Characteristics:**
- Single central motif
- Minimal palette (1-2 accent colors)
- Soft ambient glow
- Clean geometric shapes

**Examples:**
- 3D clay automation controls
- Minimal gecko silhouette
- Abstract tool symbols orbiting

---

### 3. Technical Blueprints (16:9 or 4:3)
Wireframe-style visualizations for developer-focused content.

**Characteristics:**
- Thin consistent line weight (1.5-2.5px)
- Connected nodes and paths
- Teal sparks at intersections
- Dark background with subtle grain

**Examples:**
- Automation workflow nodes
- Signal beam networks
- Data landscape topography

---

### 4. Editorial Compositions (4:3)
Magazine-style abstract visuals for blog headers and content sections.

**Characteristics:**
- Geometric + organic curves
- Low saturation with single accent
- Soft gradient backgrounds
- Paper grain texture overlay

**Examples:**
- Typography morphing into sliders
- Color waves in geometric containers
- Layered panel depth

---

## Generation Settings

### Recommended FireWerk Configuration

```bash
PROMPT_FILE=./examples/prompts/tosa-illustrations.csv
OUTPUT_DIR=./output/tosa-illustrations
VARIANTS_PER_PROMPT=2
MODEL="Firefly Image 3"
```

**Quality Settings:**
- Style Preset: Art
- Content Type: Art
- Aspect Ratios: 16:9 (hero), 1:1 (icons), 4:3 (editorial)

---

## Style Consistency Rules

### ✅ Do's
- Use consistent stroke weight across all illustrations
- Maintain same light direction (top-left key, bottom rim)
- Apply subtle grain texture (2-4% opacity)
- Keep palette restrained (max 3 colors per image)
- Use rounded corners consistently
- Export at 2× resolution
- Test on both light and dark backgrounds

### ❌ Don'ts
- Avoid literal "developer characters" or cartoons
- No hard shadows or high contrast
- No text inside illustrations
- No saturated neon colors
- No chaotic compositions
- No realistic photography blending

---

## Motion Guidelines (Optional Animation)

If animating these illustrations:

| Motion Type | Use Case | Duration | Easing |
|-------------|----------|----------|--------|
| Fade + Slide | Section entrance | 600ms | cubic-bezier(0.22,1,0.36,1) |
| Slow Orbit | Hero floating elements | 10-20s | ease-in-out |
| Pulse Glow | Accent highlights | 2-3s | ease-in-out |
| Parallax | Scroll motion | N/A | multiplier 0.1-0.3 |

**Rule:** Animations should feel like breathing — slow, confident, alive.

---

## Usage by Project

### tosa.io
**Hero:** Floating code/UI fragments orbiting teal light core
**Accent:** Teal (#4FD1C5)
**Mood:** Editorial tech minimalism

### Website Analyzer
**Visual:** Browser window with inspection highlights
**Accent:** Teal (#4FD1C5)
**Mood:** Analytical, diagnostic clarity

### Screenshot Tool
**Visual:** Camera aperture with glass panels
**Accent:** Purple (#8B5CF6)
**Mood:** Creative, generative energy

### TypeTaster
**Visual:** Variable font sliders, letterform curves
**Accent:** Teal (#4FD1C5)
**Mood:** Typography meets playful precision

### Moodnose
**Visual:** Scent trails, organic color waves
**Accent:** Orchid purple (#B79BD5)
**Mood:** Soft organic ambience

### Geckio
**Visual:** Minimal gecko silhouette, terrarium scenes
**Accent:** Moss green (#A8C6A1)
**Mood:** Naturalistic modern biology

---

## Firefly Prompt Formula

When crafting new prompts, follow this structure:

```
[Style] illustration of [subject/concept],
[geometry description],
minimal palette of [brand colors],
[lighting description],
[texture notes],
[mood/aesthetic reference],
[emotional tone].
```

**Example:**
```
Editorial vector illustration of floating browser window fragments,
clean geometric shapes with organic curves,
minimal palette of teal #4FD1C5 and warm sand #F6CBA7,
diffuse soft lighting with subtle rim glow,
subtle paper grain texture overlay,
modern magazine aesthetic like Kinfolk or Monocle,
calm professional with spark of curiosity.
```

---

## Export & Integration

### File Formats
- **Source:** SVG (editable, scalable)
- **Web:** Optimized SVG or PNG @2×
- **Animation:** Lottie JSON or WebM video loop

### Responsive Behavior
- **Desktop:** Full composition with parallax layers
- **Mobile:** Simplified composition (fewer overlapping elements)
- **Maintain:** Consistent padding (16-32px around motifs)

### Integration Example
```html
<!-- Hero illustration with gradient background -->
<div class="hero-illustration">
  <img src="/images/tosa-hero.svg"
       alt="Abstract code fragments orbiting"
       class="illustration-primary" />
</div>
```

```css
.illustration-primary {
  max-width: 100%;
  opacity: 0;
  animation: fadeInUp 600ms cubic-bezier(0.22,1,0.36,1) forwards;
}
```

---

## Batch Generation

To generate the full TOSA illustration library:

```bash
cd FireWerk

# Generate all 40 illustration variants
PROMPT_FILE=./examples/prompts/tosa-illustrations.csv \
OUTPUT_DIR=./output/tosa-illustrations \
VARIANTS_PER_PROMPT=2 \
MODEL="Firefly Image 3" \
npm run generate:images
```

**Output:** 80 total illustrations (40 prompts × 2 variants each)

---

## Quality Checklist

Before finalizing illustrations:

- [ ] Same stroke weight across all visuals
- [ ] Consistent light direction (top-left + bottom rim)
- [ ] Shared accent palette per brand
- [ ] Rounded corners at same radius
- [ ] No text embedded in illustrations
- [ ] Exported at 2× resolution
- [ ] Tested on light and dark backgrounds
- [ ] Motion loops under 15s (if animated)
- [ ] Accessible contrast ratios
- [ ] File size optimized (<200KB per SVG)

---

## Visual Mood Spectrum

| Mode | Description | Where to Use |
|------|-------------|--------------|
| **Editorial Minimalism** | Clean vector, magazine feel | Blog, docs, UI headers |
| **Soft Clay 3D** | Warm, physical, tactile | Hero sections, brand spots |
| **Technical Blueprint** | Line art, nodes, schematics | Dev tools, documentation |
| **Organic Gradient Field** | Animated color waves | Background layers, transitions |

---

## Credits & Philosophy

**Design System:** TOSA / Tobias Sauer
**Philosophy:** Engineering Emotion — Design and code as emotional engineering
**Tagline:** "Tactile minimalism for digital craftsmanship"

**Inspiration:**
- Headspace (emotional intelligence)
- Pitch.com (playful vectors)
- Figma (friendly tech geometry)
- Le Labo (texture & refinement)
- Kinfolk (editorial minimalism)

---

## Next Steps

1. **Generate** the full illustration set using FireWerk
2. **Review** outputs for consistency and brand fit
3. **Refine** prompts based on best performers
4. **Animate** hero illustrations with subtle motion loops
5. **Integrate** into tosa.io design system
6. **Document** final selections in `/docs/illustrations/`

---

**Remember:** Illustrations breathe like humans, behave like systems, speak in whispers — not noise.
