# Automatic aperture variation

All five approved B2 profiles are reused unchanged: center(0,0), left(-3,0), right(3,0), upper(0,1.9), lower(0,-1.9). The hull remains fixed and the real opening shifts internally. Mesh and CCD use the same kind4–8 selection; no recoloring or collision substitute supplies variation.

A seeded shuffled five-bit bag selects a profile for each scheduled wreck. Each bag uses all five, and the next bag excludes the previous profile on its first draw. This limits immediate repetition without a fixed round-robin. Different seeds/cells produce different sequences. The bag records **scheduled** selections; failed/replaced wrecks remain in the logs, so a skipped bag member need not appear in the published sequence.

`ScheduledSection.aperture`, transaction ID/kind, publication events and exported snapshots identify the selection. An ambient replacement is reported as ambient, with no false published-aperture event. The debug display retains the most recent actually published aperture. Current active object counts are separate from lifetime commits.

Precommit main corpus commits228wreck transactions (some centers remain beyond3300):center58,left43,right37,upper54,lower36.202centers are inside matched windows. A commits355identical right-profile wrecks;340centers are inside its windows. New normal mode has no forced default center. Six witness supplements are excluded from those distributions.

Actual seed42 reference flight shows right, then left, lower, upper and center. PNGs capture both horizontal and vertical transitions and successful passage; long native recordings show them in motion. These are illustrative certified flights, supplemented by42ordinary-input pairs, real keyboard/touch tests and failure captures. They are not fabricated human feedback.

`&aperture=NAME` remains a regression override. Its label reads `TEST OVERRIDE NAME`; all five are tested. Omitting the parameter selects automatic variation. The old `experiment=large-structure&mode=isolated|mixed&aperture=NAME` URLs retain explicit repeated profiles and their old defaults.
