# Genesys Waypoint Tools Roadmap

## Short-Term Goals
- **Performance Enhancements**: Move the database parsing and IndexedDB population logic to a background Web Worker, so the UI stays fully responsive during the 8.5MB load and can show a smooth progress bar.
- **UX & Workflow Enhancements**: Implement Drag-and-Drop file import and GPX export to directly enhance the core workflow of moving data.
- **Modern UI/UX Overhaul**: Completely revamp the visual aesthetics to create a premium, dynamic interface. This includes implementing modern typography (e.g., Inter/Roboto), a sleek and refined dark mode, glassmorphism elements, subtle micro-animations for interactions, and improved layout structure to give the app a state-of-the-art feel.
- **Security Enhancements**: Keep the current public proxy setup for live METARs, but add strict Content Security Policy (CSP) headers and fail-safe logic so that if the proxy injects malicious code or goes down, it fails silently without breaking the app.
- **Offline Map Caching**: Implementing Service Workers to cache map tiles (VFR, IFR Low, IFR High) for offline mission planning in remote locations.

## Medium-Term Goals
- **Enhanced Testing**: Implementing a suite of automated unit tests (using Jest or similar) specifically for `genesys-binary-engine.js` to ensure zero regressions in the `.RTE` and `.DAT` bit-perfect output during future feature additions.
- **Improved Weather Integration**: Expanding the fallback weather APIs to ensure consistent METAR/TAF rendering across different networks.
- **Mobile Responsiveness**: Optimizing the UI for iPad/tablet usage in the cockpit.

## Long-Term Vision
- **Advanced Flight Planning Features**: Introduce Route Elevation Profiles, GeoJSON Airspace overlays (Class B/C/D/SUA), and Shareable Links.
- **Cross-Platform App**: Wrapping the utility in an Electron or Tauri shell to create a standalone desktop application.
- **Database Expansion**: Expanding the core FAA database to include global Navigraph/Jeppesen data sources for international flight planning.
