# Portfolio review and verification

Completed on September 22, 2026.

## Changes

- Rebuilt the page with a cinematic portrait based on the supplied photo and video direction.
- Added portrait parallax, perspective project surfaces, a rotating 3D Canvas sculpture, floating labels, scroll reveals, and a motion toggle.
- Removed dependencies on external Bootstrap, jQuery, icon, and font CDNs; all front-end assets are local.
- Repaired malformed markup and implemented responsive navigation, readable content, and stable image containers.
- Replaced the mailto-only form with a server-side Gmail SMTP integration, validation, honest success/error states, and message preservation after errors.
- Created a corrected one-page US-style résumé in PDF and editable Word formats.

## Browser verification

Chromium 153.0.8010.0. Automated viewport checks covered:

| Width | Height | Horizontal overflow | Page/console/resource errors |
| --- | --- | --- | --- |
| 320 | 760 | None | None |
| 375 | 812 | None | None |
| 390 | 844 | None | None |
| 768 | 1024 | None | None |
| 844 | 390 | None | None |
| 1024 | 768 | None | None |
| 1366 | 768 | None | None |
| 1440 | 1000 | None | None |
| 1920 | 1080 | None | None |
| 2560 | 1440 | None | None |
| 3440 | 1440 | None | None |

The browser checks exercised mobile menu opening and Escape dismissal, lazy images, scrolling, and every section. Desktop and mobile screenshots were visually inspected. These are emulated viewport checks, not physical-device certification or Safari/Firefox testing.

Interaction checks:

- Empty form blocks submission and focuses name.
- Successful API submission shows success and resets fields.
- Failed delivery retains input and offers a populated email link.
- Pause motion persists after reload.
- Device reduced-motion setting is respected.
- Résumé download resolves.
- Direct-file preview works without API errors and never claims a send.
- Content and direct contact remain accessible without JavaScript.

## Email verification

All 10 backend tests passed. They cover validation, malformed data, header injection, honeypots, fixed recipient/sender addresses, rate limiting, production origin checks, CORS, private-file protection, SMTP rejection, and a real Nodemailer send to a loopback-only SMTP fixture.

Browser success handling was tested using a local mail transport. No message was sent through Gmail. Live Gmail authentication and receipt must be checked after the owner adds the private settings described in README.md. Gmail SMTP acceptance is not a guarantee of inbox placement.

## Résumé verification

The Word document was rendered to PDF and its single page was visually inspected. The website's PDF download resolves correctly. The résumé has selectable text, a single column, US Letter page size, and no photo or personal demographic details.

Job title and employment dates were retained from the supplied résumé. The offshore employer context came from the supplied website. Confirm the exact employer/title wording before using the résumé in an application. No achievements or numerical impact claims were invented.

## Included previews

The previews folder contains desktop and mobile screenshots of the completed site. Open index.html to review the design and README.md to run the complete site with contact sending.
