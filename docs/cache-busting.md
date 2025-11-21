# Cache busting guide

## Why it matters
Browsers (especially on mobile) aggressively cache static assets. If the CSS or JavaScript file name never changes, a device might keep showing an old version even after a deploy. The home page now adds a small version tag to force browsers to request fresh assets whenever the value changes.

## How to update the version
1. Pick a new version token (e.g., a `YYYYMMDD.N` timestamp) whenever you deploy new UI or interaction changes.
2. Update the `<meta name="griga:asset-version">` entry in `home.html` to the new token.
3. Update the `?v=…` query string on both `assets/css/style.css` and `assets/js/main.js` in `home.html` so they match the new token.
4. Optionally clean your build/deploy cache so the hosting platform publishes the new files.

## Bonus tip
If you ever add additional static files (fonts, images, etc.) that should bust on every deploy, append `?v=<token>` to their references as well and document the change here alongside the existing steps.