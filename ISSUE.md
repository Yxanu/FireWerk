# Issue: Authentication and Textarea Selector Not Working

## Status
🔴 **Blocking** - Application cannot proceed past page load

## Problem Summary
The FireWerk application successfully loads cookies and navigates to Firefly, but:
1. Page shows "Sign in" prompt despite cookies being applied (28 cookies loaded successfully)
2. Textarea selector cannot find the prompt input field (0 textareas found on page)
3. Page appears to be in an unauthenticated state even though cookies are set

## Current Behavior

### What Works ✅
- Cookie file loading: `Loaded 28 cookies from /app/data/cookies.adobe.json`
- Cookie application: `Successfully set 28 of 28 cookies`
- Page navigation: Successfully reaches `https://firefly.adobe.com/generate/images?view=generate`
- Page title detection: "Adobe Firefly" detected correctly

### What Doesn't Work ❌
- Authentication: Page shows "Sign in" prompt
- Textarea detection: 0 textareas found on page
- Page diagnostics show:
  - 0 textareas
  - 0 text inputs
  - Page content shows: "Text to image", "Gallery", "Generate", "Sign in", "Start generating images"

## Error Messages
```
[WARN] Page diagnostics: 0 textareas, 0 text inputs found
[WARN] Page content preview: Text to image Gallery Generate Sign in Start generating images...
[ERROR] Failed to find prompt textarea. Page may not be loaded or authentication may have failed.
[ERROR] Error: Cannot find prompt textarea. Check authentication and page load. Original error: No textarea found with any selector
```

## Environment
- **Platform**: Docker container (Coolify deployment)
- **Headless**: `true`
- **Browser**: Puppeteer with Chromium
- **URL**: `https://firefly.adobe.com/generate/images?view=generate`

## Current Selectors Attempted
- `textarea` (default)
- `textarea[placeholder*="prompt"]`
- `textarea[aria-label*="prompt"]`
- `[data-testid*="prompt"] textarea`
- `[role="textbox"]`

## Possible Causes
1. **Cookies expired/invalid**: Cookies may need to be refreshed from browser
2. **Authentication required**: Page may need additional authentication steps beyond cookies
3. **Page structure changed**: Firefly UI may have changed, requiring different selectors
4. **React SPA loading**: Page may need more time to fully render authenticated state
5. **ContentEditable instead of textarea**: Modern React apps often use `contenteditable` divs instead of textareas

## Next Steps
1. **Get page structure**: Inspect the actual Firefly page in browser to identify:
   - HTML element type for prompt field (textarea/input/div)
   - Unique IDs, classes, or data attributes
   - Placeholder text or aria-labels
2. **Check cookies**: Verify cookies are fresh and valid
3. **Test with visible browser**: Run with `HEADLESS=false` to see what's actually happening
4. **Review debug screenshot**: Check `./output/debug-page.png` for visual confirmation

## Debug Information Needed
- [ ] HTML structure of prompt input field
- [ ] Screenshot of the page when logged in
- [ ] Browser console errors (if any)
- [ ] Network requests showing authentication status
- [ ] Whether page uses contentEditable divs instead of textarea

## Files Modified
- `src/firefly.js` - Added sign-in detection, enhanced diagnostics, multiple selector strategies
- `src/auth/cookies.js` - Improved cookie loading with better error handling

## Related Code
- Cookie loading: `src/auth/cookies.js`
- Page navigation: `src/firefly.js:46-78`
- Textarea detection: `src/firefly.js:115-193`
- Selectors: `src/selectors.js`

