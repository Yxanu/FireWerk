# FireWerk 🔥
**Batch your imagination.**  
Automated Adobe Firefly image generation with Puppeteer + headless Chromium. Feed a CSV/JSON of prompts and get full‑res images saved to `/output`.

> ⚠️ Respect Adobe's Terms and rate limits. Use your own account and moderate throughput.

## Quick Start
```bash
cp .env.example .env
npm install
# Export your Adobe cookies (JSON) while logged in and place at ./data/cookies.adobe.json
npm run dev    # opens visible browser to calibrate selectors
npm start      # headless batch run
```

### CSV format
`data/prompts.csv`
```
prompt_id,prompt_text,aspect_ratio,style,negative,seed
gecko_001,"highly detailed macro photo of a crested gecko on moss, shallow depth of field",1:1,photographic,,42
perfume_rose,"editorial product photo, perfume bottle with soft roses, cinematic rim light",4:5,editorial,"text, watermark, hands",101
```

## Notes
- If no images are captured, increase `POST_CLICK_WAIT_MS`.
- If thumbnails are captured, run visible (`npm run dev`) and adjust selectors or add URL filters in `src/firefly.js`.
- Keep `MAX_CONCURRENT=1` to stay friendly.
