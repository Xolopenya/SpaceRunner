# Future release checks

The current prototype is standalone and is not ready for Yandex moderation.

- [x] Static Vite output with root `index.html`, relative bundled asset paths, and no external runtime CDN.
- [x] Code/rendering independent of the future platform lifecycle/storage adapter.
- [x] Guest play, touch input, focus/visibility pause, and maximum 2:1 game display aspect.
- [x] Early production output is under 1 MB uncompressed; generated files stay out of Git.
- [x] Replace main ship/hazards with legally acquired real models; retain provenance/license notices.
- [x] Standalone audio unlock, volume/mute persistence and pause/focus silence verified in Chrome; physical-device listening acceptance remains separate.
- [ ] Test physical mobile devices, Safari/Firefox, safe areas, long runs, sustained performance, memory, and many replays.
- [ ] Use current official Yandex documentation to implement and verify SDK initialization, loading-ready, gameplay start/stop, and platform pause/persistence.
- [ ] Inspect the actual release ZIP: `index.html` at root, all paths valid, ASCII production filenames, uncompressed size ≤100 MB.
- [ ] Verify the hosted platform build, SDK failure behavior, focus/audio lifecycle, and moderation requirements.
- [ ] Obtain explicit publication/deployment authorization before uploading or publishing.
