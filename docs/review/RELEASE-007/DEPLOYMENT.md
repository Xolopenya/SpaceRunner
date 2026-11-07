# Pages deployment

Before publication this is a release candidate;no successful deployment is inferred from localhost or a queued workflow. The existing deploy.yml triggers on main only. Release preparation is pushed to release/007-integrated-gameplay;latest main must be fetched again and incorporated before a fast-forward promotion.

The first successful public deployment,its actual date and run link are added after Actions concludes success. Final deployed identity is independently recorded in logs/deployment-final.json and the package manifest:Actions head SHA,served release.json commit/tree and all served asset hashes must agree. Reports can describe the first successful deployment while a later report-only main commit is promoted;the final receipt is authoritative for that final HEAD.

Canonical production source is unchanged from approved a5906ef. CI builds from Linux checkout with base /SpaceRunner/,then writes dist/release.json using GITHUB_SHA. Local release-build uses the same committed LF bytes in a cache project. This avoids attributing CRLF shader/HTML hashes to a gameplay change and does not replace the existing hosting infrastructure.

Required live smoke:ordinary public URL,menu/audio/settings,normal Launch,Hybrid,C-only field,seamless reveal,Mixed Flow,station,mine,body/wing pickup and damage,Phase2,pause/resume,game over and restart. Public screenshots come from the HTTPS site,not localhost. Public captures and request/console receipts are kept separately from local production evidence.
