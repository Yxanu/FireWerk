# FireWerk Debugging Session Notes

## Issue
Parameters (model, aspect ratio, style) were not being applied correctly during automated generation. All generations were running with Firefly Image 3 and Fast mode enabled.

## Root Causes Identified

### 1. Fast Mode Limiting Model Access
- **Problem**: When "Fast mode" is ON, only Firefly Image 2 and 3 are available in the model dropdown
- **Solution**: Fast mode must be disabled BEFORE attempting to select other models
- **Alternative**: Clicking the "Use Firefly Image 5 (preview)" badge also enables access to all models

### 2. Incorrect Selectors for Spectrum Web Components
- **Problem**: Adobe Firefly uses Spectrum Web Components (`sp-picker`, `sp-switch`, `firefly-link-info-card`)
- **Original selectors**: Generic `button`, `input[type="checkbox"]` weren't matching the custom elements
- **Solution**: Updated to target specific Spectrum components

## Solutions Implemented

### Fast Mode Toggle
```javascript
// Strategy 1: Click Firefly 5 preview badge (enables all models)
const firefly5Badge = page.locator('firefly-link-info-card')
  .filter({ hasText: /firefly image 5.*preview|use.*firefly.*5/i })
  .first();
if (await firefly5Badge.isVisible()) {
  await firefly5Badge.click();
}

// Strategy 2: Disable Fast mode toggle
const fastModeSwitch = page.locator('sp-switch')
  .filter({ hasText: /fast mode/i })
  .first();
if (await fastModeSwitch.evaluate(el => el.hasAttribute('checked'))) {
  await fastModeSwitch.click();
}
```

### Model Selection
```javascript
// Use sp-picker component
const modelPicker = page.locator('sp-picker')
  .filter({ hasText: /firefly image|model/i })
  .first();
await modelPicker.click();

// Select from sp-menu-item
const modelOption = page.locator(`sp-menu-item:has-text("${modelName}")`);
await modelOption.click();
```

## Available Models (when Fast Mode is OFF)

### Adobe Models (Commercially safe)
- Firefly Image 5 (preview)
- Firefly Image 4 Ultra
- Firefly Image 4
- Firefly Image 3

### Partner Models (Models created by others)
- Flux Kontext Max
- Flux Kontext Pro
- Flux 1.1 Pro
- Flux 1.1 Ultra
- Flux 1.1 Ultra (Raw)
- GPT Image
- Ideogram 3.0
- Imagen 4
- Imagen 3
- Nano Banana
- Runway Gen-4 Image

## Testing Methodology

### 1. Manual Test Observer
Created `manual-test-observer.mjs` to:
- Open browser in non-headless mode
- Log all user clicks with element details
- Take screenshots every 5 seconds
- Save interaction log to JSON

### 2. Debug Screenshots
Added comprehensive screenshot capture at key points:
- Before setting aspect ratio
- After setting aspect ratio
- Before setting style
- After setting style
- Before generation (final state)
- After generation complete

### 3. Key Findings from Manual Testing
- Element type for Fast mode: `SP-SWITCH`
- Element type for Model selector: `SP-PICKER`
- Firefly 5 badge: `FIREFLY-LINK-INFO-CARD`
- Clicking Firefly 5 badge expands model list without needing to toggle Fast mode

## Files Modified

1. **src/generators/ImageGenerator.mjs**
   - Added `disableFastMode()` method (line 449)
   - Updated `selectModel()` to use sp-picker (line 516)
   - Added debug screenshots throughout generation process

2. **src/ui/server.mjs**
   - Parameters are correctly mapped to prompts (line 119-128)
   - Model, aspect ratio, and style passed from UI to generator

## Verification Steps

1. ✅ Full debugging and screenshot capture enabled
2. ✅ Manual test to document user interactions
3. ✅ Verified aspect ratio and style ARE being set correctly
4. ✅ Identified Fast mode as blocker for model selection
5. ✅ Implemented Firefly 5 badge click strategy
6. ✅ Implemented Fast mode toggle strategy
7. ⏳ Need to fix model selector (sp-picker not found yet)
8. ⏳ Need to fix aspect ratio selector

## Next Steps

1. Debug why `sp-picker` is not being found
2. Check if General settings needs to be expanded before model access
3. Verify aspect ratio selectors work with current UI
4. Test with different models (Flux, Ideogram, Imagen)
5. Clean up debug screenshots after verification

## Debug Artifacts Location

- Screenshots: `./data/debug-*.png`
- Manual test log: `./data/manual-test-interactions.json`
- Manual test screenshots: `./data/manual-test-step-*.png`
- Test script: `test-ui-params.mjs`
- Manual observer: `manual-test-observer.mjs`
