# Contributing to FireWerk

First off, thank you for considering contributing to FireWerk! 🔥

## Code of Conduct

Be respectful, constructive, and collaborative. We're all here to build something useful together.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear descriptive title**
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, Node version, browser)
- **Console output** or error messages

Example:
```
**Title**: Generate button not clicking on macOS Sonoma

**Description**: When running with HEADLESS=false on macOS Sonoma 14.3, the generate button
doesn't get clicked after filling the prompt.

**Steps to reproduce**:
1. Set HEADLESS=false in .env
2. Run npm run generate:images -- --prompts ./examples/prompts/geckio.csv
3. Observe that prompt is filled but button doesn't click

**Expected**: Generate button should be clicked
**Actual**: Button remains unclicked, script waits indefinitely

**Environment**:
- macOS Sonoma 14.3
- Node.js v20.10.0
- Playwright 1.48.0

**Console output**:
[DEBUG] Prompt textarea is visible and ready
[DEBUG] Filled prompt: ...
[INFO] Generate button is enabled
(hangs here)
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When suggesting:

- **Use a clear descriptive title**
- **Provide detailed description** of the enhancement
- **Explain why** this enhancement would be useful
- **Include mockups** or examples if applicable

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** following our code style
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Write clear commit messages**
6. **Submit a pull request**

#### Pull Request Process

1. Ensure all tests pass (if applicable)
2. Update README.md with details of changes if needed
3. The PR will be merged once you have sign-off from maintainers

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/FireWerk.git
cd FireWerk

# Install dependencies
npm install

# Create a branch for your changes
git checkout -b feature/my-new-feature

# Make your changes and test
HEADLESS=false npm run generate:images -- --prompts ./examples/prompts/geckio.csv

# Commit your changes
git add .
git commit -m "Add amazing new feature"

# Push to your fork
git push origin feature/my-new-feature
```

## Code Style

### JavaScript/Node.js

- Use ES modules (`import`/`export`)
- Use `const` and `let`, never `var`
- Use async/await over promises where possible
- Add JSDoc comments for functions
- Use descriptive variable names

Example:
```javascript
/**
 * Fills the prompt textarea and waits for readiness
 * @param {Page} page - Playwright page instance
 * @param {string} promptText - The prompt text to fill
 * @returns {Promise<void>}
 */
async function fillPrompt(page, promptText) {
  const textarea = page.locator('textarea[placeholder*="prompt"]');
  await textarea.waitFor({ state: 'visible', timeout: 5000 });
  await textarea.fill(promptText);
  await page.waitForTimeout(500); // Debounce
}
```

### CSS

- Follow the Ember Glow design system
- Use CSS variables defined in `:root`
- Add comments for complex selectors
- Mobile-first responsive design

```css
/* Component: Button */
.btn {
  padding: 0.7rem 1.5rem;
  background: linear-gradient(90deg, var(--fw-color-accent), var(--fw-color-accent-alt));
  transition: all 0.3s ease;
}
```

### Commits

Follow conventional commit format:

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Build/tooling changes

Examples:
```
feat(generator): add support for Flux 1.1 Ultra model

fix(ui): resolve aspect ratio selector not appearing

docs(readme): update installation instructions for M1 Macs

refactor(auth): simplify login flow logic
```

## Project Structure

```
FireWerk/
├── src/
│   ├── generators/          # Core generation logic
│   │   ├── BaseGenerator.mjs
│   │   ├── ImageGenerator.mjs
│   │   └── SpeechGenerator.mjs
│   ├── ui/                  # Web UI
│   │   ├── server.mjs
│   │   └── public/
│   └── cli.mjs              # CLI entry point
├── lib/
│   └── utils/               # Utility functions
├── examples/                # Example prompt files
├── docs/                    # Additional documentation
└── tests/                   # Test files (future)
```

## Testing

Currently, testing is manual. When adding features:

1. Test with both `HEADLESS=true` and `HEADLESS=false`
2. Test with multiple prompt files
3. Test error conditions (network issues, invalid prompts)
4. Test on different platforms if possible (macOS, Linux, Windows)

Future: We plan to add automated tests with Playwright Test.

## Documentation

When adding features, update:

- `README.md` - User-facing documentation
- `CONTRIBUTING.md` - Developer documentation (this file)
- Code comments - JSDoc for functions
- Example files - Add examples in `examples/` directory

## Questions?

Feel free to open an issue with the `question` label or reach out to maintainers.

Thank you for contributing! 🔥
