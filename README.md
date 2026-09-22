# Jebastin Michael Raj Portfolio

A redesigned portfolio with a cinematic portrait, perspective animation, responsive layouts, and a private Gmail SMTP contact service. The browser uses local HTML, CSS, and JavaScript; there are no CDN scripts, web fonts, or front-end packages to download.

## Preview the design

Open `index.html` in a browser. Navigation, animations, project links, and résumé downloads work without installation. The contact form retains the message and offers an email-app link when no backend is connected.

For the complete site and contact API, install Node.js 22.9 or newer, open a terminal in this folder, and run:

```sh
npm ci
npm start
```

Visit `http://localhost:3000`. There is no build step. The server can preview the site without Gmail credentials; sending remains unavailable until configured.

## Connect Gmail

1. Copy `.env.example` to a new file named `.env` in this folder.
2. In your Google account, enable 2-Step Verification and create an App Password if your account supports it. See [Google's App Password instructions](https://support.google.com/accounts/answer/185833). Use that App Password, not your regular Google password.
3. Edit the private `.env` file on your computer or use your hosting provider's secret environment settings:

```dotenv
GMAIL_USER=jebastinmichealraj@gmail.com
GMAIL_APP_PASSWORD=your_app_password_here
CONTACT_TO=jebastinmichealraj@gmail.com
SITE_ORIGIN=http://localhost:3000
```

4. Restart the server and run `npm run verify-email`. This checks SMTP authentication without sending a message.
5. Submit the form in your browser and check the receiving Gmail inbox, including Spam. A successful SMTP response confirms that the mail server accepted the message; it cannot guarantee inbox placement.

The visitor's email is placed in **Reply-To**, so replying in Gmail reaches the visitor. The sender and recipient are controlled by the server. No automatic confirmation email is sent to the visitor.

Keep the App Password on the server. Do not place it in `index.html`, `assets/js/config.js`, a screenshot, or a public repository. `.env` is ignored by Git and is never served by the included server.

If Google does not offer App Passwords for your account, use an account that supports them or adapt `server/mail.mjs` to an OAuth2/SMTP provider. Gmail accounts and SMTP services have sending limits; this setup is intended for a low-volume personal portfolio. [Nodemailer SMTP documentation](https://nodemailer.com/smtp) describes transport and authentication options.

## Deploy with working email

Use a host that runs a persistent Node.js service with HTTPS and permits outbound SMTP on port 465. Set:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
SITE_ORIGIN=https://your-actual-domain.example
```

Use the real public website origin, with no path or trailing slash. Set the Gmail variables privately on that host. Start command: `npm start`. Install command: `npm ci`. The host may provide `PORT` automatically.

The included server serves the page and API together and enables the form automatically. In production, the form is unavailable without a valid HTTPS `SITE_ORIGIN`.

GitHub Pages and ordinary static hosting cannot run the Node server. To keep the front end on static hosting:

- Deploy this backend separately on a Node-capable host.
- Set `apiBase` in `assets/js/config.js` to that backend's HTTPS origin.
- Set the backend's `SITE_ORIGIN` to its own HTTPS origin and `ALLOWED_ORIGIN` to the exact frontend origin.
- If your static host sets a Content Security Policy, permit the backend origin in `connect-src`.

`TRUST_PROXY` defaults to false. Enable it only if your trusted reverse proxy overwrites `X-Forwarded-For`. Rate limits are per running process: five attempts per client per 15 minutes, at most 100 total attempts per hour, and three concurrent deliveries. For multiple server instances, replace the in-memory limiter with shared storage.

## Design and motion

- Large portrait and aubergine/magenta lighting inspired by the uploaded video.
- Pointer-based portrait parallax and perspective project surfaces.
- A rotating 3D torus projected onto Canvas, with no external 3D library.
- Layered project-window animation, floating labels, scroll reveals, and a progress indicator.
- Mobile navigation, touch-sized controls, fluid sections, and layouts for narrow phones through large monitors.
- A visible pause-motion button, device reduced-motion support, and animation suspension while the Canvas is offscreen or the browser tab is hidden.
- Local WebP portrait variants: approximately 60 KB desktop and 24 KB mobile.

The hero uses an AI-styled photograph with interactive depth. The original photo is retained as `assets/images/portrait-original.png`; the new master is `assets/images/portrait-cinematic.png`. The rendered WebP files are used by the site. The Medcom project graphic is explicitly labeled as a concept visual and does not show customer data.

## Résumé

`assets/docs/JebastinMichaelRaj_Resume.pdf` is the corrected one-page US-style résumé. An editable Word version is included beside it. Both use selectable text and a single-column layout.

The résumé corrects grammar, spelling, technology names, and repetitive descriptions; focuses on skills and experience; and omits date of birth, marital status, father's name, full street address, nationality, and school-level results. No GPA conversion, performance metrics, or new accomplishments were invented.

The job title and September 2022 start date are retained from the supplied résumé. The offshore employer context comes from the supplied portfolio. Confirm the exact employer/title wording before sending applications. Your email address is intentionally preserved as `jebastinmichealraj@gmail.com`, including its existing spelling.

## Editing

| File | Purpose |
| --- | --- |
| `index.html` | Public content, navigation, projects, contact fields |
| `assets/css/style.css` | Design, breakpoints, and motion styles |
| `assets/js/main.js` | Navigation, animation, validation, and form submission |
| `assets/js/config.js` | Optional public backend origin; no secrets |
| `server/server.mjs` | Static server and contact API |
| `server/mail.mjs` | Private Gmail SMTP integration |
| `.env.example` | Configuration template |
| `tests/contact.test.mjs` | Contact validation, abuse limits, and local SMTP tests |

## Verification

Run `npm test` for automated backend checks. These tests use only local fixtures and never send external email. See `REVIEW.md` for the completed browser and document checks and the remaining live-delivery step.

## Portrait production note

The new portrait was created with built-in image generation using the uploaded portrait as the identity reference. It was copied into this project and converted to WebP for the website.

Prompt: “Use case: identity-preserve. Asset type: cinematic hero photograph for the attached person's personal software developer portfolio. Edit target and sole identity reference: the provided portrait of Jebastin. Preserve exactly his recognizable facial features, hairstyle, beard, skin tone, age, natural proportions and serious but approachable expression. Keep his black suit, white shirt, blue tie. Make a premium photographic studio portrait, waist/upper torso visible, near frontal, subtle three-quarter body angle while looking at camera. Wide landscape composition, subject centered at 65% from left, face unobscured and not cropped, generous dark negative space over the entire left 42% for website text and some breathing room on right. Scene: near-black aubergine studio background fading to deep magenta behind subject, cinematic fuchsia rim lighting from the right, subdued violet fill and natural soft neutral key light on face so identity is still clear. Background minimal with atmospheric red-purple glow, professionally photographed, realistic skin detail, crisp portrait, slightly filmic. Avoid changing his face or inventing another person. No text, letters, logos, UI, geometric objects, watermarks or sunglasses. Landscape aspect ratio approximately 3:2, high resolution. This is a usable photograph asset, not a screenshot or website mockup.”
