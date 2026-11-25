# Credits and third-party obligations

The in-game Credits & Licenses panel lists Next.js, React/React DOM, Three.js and OrbitControls with upstream attribution and license links. Direct libraries are MIT licensed, but they may include separately licensed components. Node.js is a separately installed runtime. This source archive does not redistribute node_modules or commercial assets.

Run `npm install`, then `npm run licenses`. The script collects top-level license/notice files and package metadata for installed direct and transitive dependencies into `public/third-party-notices.txt`, which is accessible from the Credits screen. Review the report, inspect packages marked missing/unknown, check nested bundled dependencies and preserve all required notices before selling or distributing compiled builds. This is a starting point, not a legal opinion, license audit, or copyright guarantee. The app uses only procedural character geometry, environments, CSS effects and original synthesized tones; no third-party images, sounds, models, font files or music. If you add assets, record creator, source URL, license, modifications, and any required attribution here and in the in-game credits. Do not assume an attribution alone grants permission. Verify your game name and branding separately before commercial launch.

## V3 additions
- **qrcode.react** — ISC, Zachary Pao and contributors; https://github.com/zpao/qrcode.react (see installed LICENSE). QR codes are generated locally. No third-party QR images are fetched.
- **Node.js built-in SQLite / crypto / HTTP** — supplied by the Node runtime; see https://github.com/nodejs/node/blob/main/LICENSE and https://www.sqlite.org/copyright.html. Node runtime is not bundled in this ZIP.
- **WebRTC** — browser native APIs; no external voice SDK or media service bundled. Any self-hosted STUN/TURN software requires its own notices.
- **Stripe Checkout** — optional external service, REST API, no SDK bundled; subject to merchant agreement. No Stripe branding assets included.
- V3 procedural animation and cosmetic geometry are authored in source; no third-party character rigs or audio packs added.

## V3.2 cloud update
No new third-party libraries or media assets. The proxy uses built-in Fetch, Request and Response APIs; Next.js supplies route handlers. Vercel and Railway are optional hosting services subject to their respective terms.

## V3.3 split
No new libraries or media assets. Frontend retains existing npm notices generation; backend uses only Node.js built-ins.
