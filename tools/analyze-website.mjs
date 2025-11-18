import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';

const SITE_URL = process.env.SITE_URL || 'https://telefonansagen.de';
const OUTPUT_DIR = './website-analysis';

class WebsiteAnalyzer {
  constructor() {
    this.issues = [];
    this.improvements = [];
    this.positives = [];
  }

  addIssue(category, severity, description, location = null) {
    this.issues.push({ category, severity, description, location });
  }

  addImprovement(category, description, location = null) {
    this.improvements.push({ category, description, location });
  }

  addPositive(description) {
    this.positives.push(description);
  }

  async analyzePage(page, deviceType, url) {
    console.log(`\n📊 Analyzing ${url} on ${deviceType}...`);

    const results = {
      url,
      deviceType,
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Navigate to page
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      results.checks.pageLoad = { status: 'success', loadTime: Date.now() };
    } catch (error) {
      this.addIssue('Performance', 'high', `Page failed to load: ${error.message}`, url);
      results.checks.pageLoad = { status: 'failed', error: error.message };
      return results;
    }

    // Take screenshot
    const screenshotPath = path.join(OUTPUT_DIR, `${deviceType}-${url.replace(/[^a-z0-9]/gi, '_')}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  📸 Screenshot saved: ${screenshotPath}`);

    // Check viewport and responsive design
    const viewport = page.viewportSize();
    results.checks.viewport = viewport;

    // Check for horizontal scrolling (common mobile issue)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = viewport.width;
    if (bodyWidth > viewportWidth) {
      this.addIssue('Responsive Design', 'medium',
        `Horizontal scrolling detected: body width (${bodyWidth}px) exceeds viewport (${viewportWidth}px)`,
        url);
    }

    // Check for text readability
    const textSizes = await page.evaluate(() => {
      const elements = document.querySelectorAll('p, li, a, span, div');
      const sizes = [];
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);
        if (el.textContent.trim().length > 10) {
          sizes.push(fontSize);
        }
      });
      return sizes;
    });

    const smallTextCount = textSizes.filter(size => size < 14).length;
    if (smallTextCount > 10 && deviceType === 'mobile') {
      this.addIssue('Typography', 'medium',
        `Found ${smallTextCount} text elements smaller than 14px on mobile`,
        url);
    }

    // Check touch targets on mobile
    if (deviceType === 'mobile') {
      const smallTargets = await page.evaluate(() => {
        const clickable = document.querySelectorAll('a, button, input, [onclick], [role="button"]');
        const small = [];
        clickable.forEach(el => {
          const rect = el.getBoundingClientRect();
          if ((rect.width < 44 || rect.height < 44) && rect.width > 0 && rect.height > 0) {
            small.push({
              tag: el.tagName,
              text: el.textContent?.substring(0, 30),
              width: rect.width,
              height: rect.height
            });
          }
        });
        return small;
      });

      if (smallTargets.length > 0) {
        this.addIssue('Usability', 'medium',
          `Found ${smallTargets.length} touch targets smaller than 44x44px (recommended minimum)`,
          url);
        results.checks.smallTouchTargets = smallTargets;
      }
    }

    // Check for navigation elements
    const navigation = await page.evaluate(() => {
      const nav = document.querySelector('nav, [role="navigation"]');
      const hamburger = document.querySelector('[class*="hamburger"], [class*="menu-toggle"], [aria-label*="menu" i]');
      return {
        hasNav: !!nav,
        hasHamburger: !!hamburger,
        navVisible: nav ? window.getComputedStyle(nav).display !== 'none' : false
      };
    });

    results.checks.navigation = navigation;

    if (deviceType === 'mobile' && !navigation.hasHamburger) {
      this.addImprovement('Navigation',
        'Consider adding a hamburger menu for better mobile navigation',
        url);
    }

    // Check accessibility features
    const a11y = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      const imagesWithoutAlt = Array.from(images).filter(img => !img.alt || img.alt.trim() === '');

      const buttons = document.querySelectorAll('button');
      const buttonsWithoutLabel = Array.from(buttons).filter(btn =>
        !btn.textContent?.trim() && !btn.getAttribute('aria-label')
      );

      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const headingStructure = Array.from(headings).map(h => ({
        level: h.tagName,
        text: h.textContent?.substring(0, 50)
      }));

      return {
        imagesWithoutAlt: imagesWithoutAlt.length,
        buttonsWithoutLabel: buttonsWithoutLabel.length,
        headingStructure,
        hasSkipLink: !!document.querySelector('[href="#main"], [href="#content"]'),
        lang: document.documentElement.lang
      };
    });

    results.checks.accessibility = a11y;

    if (a11y.imagesWithoutAlt > 0) {
      this.addIssue('Accessibility', 'medium',
        `Found ${a11y.imagesWithoutAlt} images without alt text`,
        url);
    }

    if (a11y.buttonsWithoutLabel > 0) {
      this.addIssue('Accessibility', 'medium',
        `Found ${a11y.buttonsWithoutLabel} buttons without accessible labels`,
        url);
    }

    if (!a11y.lang) {
      this.addIssue('Accessibility', 'low',
        'No lang attribute on <html> element',
        url);
    }

    // Check for interactive elements and forms
    const forms = await page.evaluate(() => {
      const formElements = document.querySelectorAll('form');
      const inputs = document.querySelectorAll('input, textarea, select');

      const inputsWithoutLabels = Array.from(inputs).filter(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        return !label && !ariaLabel && !ariaLabelledBy && input.type !== 'hidden';
      });

      return {
        formCount: formElements.length,
        inputCount: inputs.length,
        inputsWithoutLabels: inputsWithoutLabels.length
      };
    });

    results.checks.forms = forms;

    if (forms.inputsWithoutLabels > 0) {
      this.addIssue('Accessibility', 'medium',
        `Found ${forms.inputsWithoutLabels} form inputs without labels`,
        url);
    }

    // Check performance metrics
    const performance = await page.evaluate(() => {
      const perf = window.performance.getEntriesByType('navigation')[0];
      return {
        loadTime: perf?.loadEventEnd - perf?.fetchStart,
        domContentLoaded: perf?.domContentLoadedEventEnd - perf?.fetchStart,
        resourceCount: window.performance.getEntriesByType('resource').length
      };
    });

    results.checks.performance = performance;

    if (performance.loadTime > 3000) {
      this.addIssue('Performance', 'medium',
        `Page load time is ${(performance.loadTime / 1000).toFixed(2)}s (recommend < 3s)`,
        url);
    }

    // Check for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit for any lazy-loaded content
    await page.waitForTimeout(2000);

    if (consoleErrors.length > 0) {
      this.addIssue('JavaScript', 'low',
        `Found ${consoleErrors.length} console errors`,
        url);
      results.checks.consoleErrors = consoleErrors;
    }

    // Check CSS and styling
    const styling = await page.evaluate(() => {
      const colorContrast = [];
      const elements = document.querySelectorAll('p, a, h1, h2, h3, h4, h5, h6, li, span, button');

      // Sample elements for color contrast (checking too many would be slow)
      const sample = Array.from(elements).slice(0, 50);

      sample.forEach(el => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bgColor = style.backgroundColor;

        if (color && bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
          colorContrast.push({ color, bgColor });
        }
      });

      return {
        colorContrast: colorContrast.length
      };
    });

    results.checks.styling = styling;

    return results;
  }

  async testInteractions(page, deviceType) {
    console.log(`\n🖱️  Testing interactions on ${deviceType}...`);

    // Test navigation clicks
    try {
      const navLinks = await page.locator('nav a, [role="navigation"] a').all();
      console.log(`  Found ${navLinks.length} navigation links`);

      if (navLinks.length > 0) {
        this.addPositive(`Navigation has ${navLinks.length} links`);
      }

      // Test hamburger menu if on mobile
      if (deviceType === 'mobile') {
        const hamburger = page.locator('[class*="hamburger"], [class*="menu-toggle"], button[aria-label*="menu" i]').first();
        const isVisible = await hamburger.isVisible().catch(() => false);

        if (isVisible) {
          await hamburger.click();
          await page.waitForTimeout(500);

          const menuVisible = await page.evaluate(() => {
            const nav = document.querySelector('nav, [role="navigation"]');
            return nav ? window.getComputedStyle(nav).display !== 'none' : false;
          });

          if (menuVisible) {
            this.addPositive('Hamburger menu opens correctly on mobile');
          } else {
            this.addIssue('Navigation', 'high',
              'Hamburger menu does not reveal navigation when clicked',
              'Mobile menu interaction');
          }
        }
      }
    } catch (error) {
      this.addIssue('Navigation', 'medium',
        `Navigation interaction test failed: ${error.message}`,
        'Navigation testing');
    }

    // Test form interactions if any
    const forms = await page.locator('form').all();
    if (forms.length > 0) {
      console.log(`  Found ${forms.length} forms to test`);

      for (let i = 0; i < Math.min(forms.length, 3); i++) {
        const form = forms[i];
        const inputs = await form.locator('input:not([type="hidden"]), textarea').all();

        if (inputs.length > 0) {
          try {
            await inputs[0].focus();
            const isFocused = await inputs[0].evaluate(el => document.activeElement === el);

            if (!isFocused) {
              this.addIssue('Forms', 'low',
                'Form input did not receive focus properly',
                `Form ${i + 1}`);
            }
          } catch (error) {
            console.log(`    Form test error: ${error.message}`);
          }
        }
      }
    }

    // Test link functionality
    const links = await page.locator('a[href]').all();
    const brokenLinks = [];

    // Sample some links (testing all would be slow)
    const sampleLinks = links.slice(0, 10);

    for (const link of sampleLinks) {
      const href = await link.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        // Just check if href looks valid, not actually navigating
        if (!href.match(/^(https?:\/\/|\/|mailto:|tel:)/)) {
          brokenLinks.push(href);
        }
      }
    }

    if (brokenLinks.length > 0) {
      this.addIssue('Links', 'medium',
        `Found ${brokenLinks.length} links with potentially invalid hrefs`,
        'Link validation');
    }
  }

  generateReport() {
    let report = '# Website Analysis Report\n\n';
    report += `Generated: ${new Date().toLocaleString()}\n\n`;
    report += `Site: ${SITE_URL}\n\n`;

    report += '---\n\n';

    if (this.positives.length > 0) {
      report += '## ✅ Positive Findings\n\n';
      this.positives.forEach(positive => {
        report += `- ${positive}\n`;
      });
      report += '\n';
    }

    if (this.issues.length > 0) {
      report += '## 🚨 Issues Found\n\n';

      const highIssues = this.issues.filter(i => i.severity === 'high');
      const mediumIssues = this.issues.filter(i => i.severity === 'medium');
      const lowIssues = this.issues.filter(i => i.severity === 'low');

      if (highIssues.length > 0) {
        report += '### High Priority\n\n';
        highIssues.forEach(issue => {
          report += `- **[${issue.category}]** ${issue.description}\n`;
          if (issue.location) report += `  - Location: ${issue.location}\n`;
        });
        report += '\n';
      }

      if (mediumIssues.length > 0) {
        report += '### Medium Priority\n\n';
        mediumIssues.forEach(issue => {
          report += `- **[${issue.category}]** ${issue.description}\n`;
          if (issue.location) report += `  - Location: ${issue.location}\n`;
        });
        report += '\n';
      }

      if (lowIssues.length > 0) {
        report += '### Low Priority\n\n';
        lowIssues.forEach(issue => {
          report += `- **[${issue.category}]** ${issue.description}\n`;
          if (issue.location) report += `  - Location: ${issue.location}\n`;
        });
        report += '\n';
      }
    }

    if (this.improvements.length > 0) {
      report += '## 💡 Improvement Suggestions\n\n';
      this.improvements.forEach(improvement => {
        report += `- **[${improvement.category}]** ${improvement.description}\n`;
        if (improvement.location) report += `  - Location: ${improvement.location}\n`;
      });
      report += '\n';
    }

    report += '## 📊 Summary\n\n';
    report += `- Total Issues: ${this.issues.length}\n`;
    report += `  - High Priority: ${this.issues.filter(i => i.severity === 'high').length}\n`;
    report += `  - Medium Priority: ${this.issues.filter(i => i.severity === 'medium').length}\n`;
    report += `  - Low Priority: ${this.issues.filter(i => i.severity === 'low').length}\n`;
    report += `- Improvements Suggested: ${this.improvements.length}\n`;
    report += `- Positive Findings: ${this.positives.length}\n`;

    return report;
  }
}

async function main() {
  console.log('🌐 Website Analyzer Starting...\n');
  console.log(`Target: ${SITE_URL}\n`);

  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const analyzer = new WebsiteAnalyzer();

  // Launch browser
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false'
  });

  try {
    // Test on desktop
    const desktopContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    const desktopPage = await desktopContext.newPage();

    const desktopResults = await analyzer.analyzePage(desktopPage, 'desktop', SITE_URL);
    await analyzer.testInteractions(desktopPage, 'desktop');

    // Test some internal pages if they exist
    const internalLinks = await desktopPage.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links
        .map(a => a.href)
        .filter(href => href.startsWith(window.location.origin) && href !== window.location.href)
        .slice(0, 3); // Test up to 3 internal pages
    });

    for (const link of internalLinks) {
      await analyzer.analyzePage(desktopPage, 'desktop', link);
    }

    await desktopContext.close();

    // Test on mobile
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 }, // iPhone SE size
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      hasTouch: true,
      isMobile: true
    });
    const mobilePage = await mobileContext.newPage();

    await analyzer.analyzePage(mobilePage, 'mobile', SITE_URL);
    await analyzer.testInteractions(mobilePage, 'mobile');

    for (const link of internalLinks) {
      await analyzer.analyzePage(mobilePage, 'mobile', link);
    }

    await mobileContext.close();

    // Test on tablet
    const tabletContext = await browser.newContext({
      viewport: { width: 768, height: 1024 }, // iPad size
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      hasTouch: true,
      isMobile: true
    });
    const tabletPage = await tabletContext.newPage();

    await analyzer.analyzePage(tabletPage, 'tablet', SITE_URL);
    await tabletContext.close();

  } finally {
    await browser.close();
  }

  // Generate and save report
  const report = analyzer.generateReport();
  const reportPath = path.join(OUTPUT_DIR, 'analysis-report.md');
  await fs.writeFile(reportPath, report);

  console.log('\n✅ Analysis Complete!\n');
  console.log(`📄 Report saved to: ${reportPath}`);
  console.log(`📸 Screenshots saved to: ${OUTPUT_DIR}/\n`);

  // Also print report to console
  console.log('\n' + '='.repeat(80) + '\n');
  console.log(report);
  console.log('='.repeat(80) + '\n');
}

main().catch(error => {
  console.error('Error running analysis:', error);
  process.exit(1);
});
