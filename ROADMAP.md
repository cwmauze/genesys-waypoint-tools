# Genesys Waypoint Tools Roadmap

## Short-Term Goals
- **Automated CI/CD**: Deploying automatically to GitHub Pages to eliminate manual deployment errors. (Completed)
- **Modularization**: Splitting the monolithic `index.html` into a scalable frontend architecture while protecting the brittle binary engine. (Completed)
- **Offline Map Caching**: Implementing Service Workers to cache map tiles (VFR, IFR Low, IFR High) for offline mission planning in remote locations.

## Medium-Term Goals
- **Enhanced Testing**: Implementing a suite of automated unit tests (using Jest or similar) specifically for `genesys-binary-engine.js` to ensure zero regressions in the `.RTE` and `.DAT` bit-perfect output during future feature additions.
- **Improved Weather Integration**: Expanding the fallback weather APIs to ensure consistent METAR/TAF rendering across different networks.
- **Mobile Responsiveness**: Optimizing the UI for iPad/tablet usage in the cockpit.

## Long-Term Vision
- **Cross-Platform App**: Wrapping the utility in an Electron or Tauri shell to create a standalone desktop application.
- **Database Expansion**: Expanding the core FAA database to include global Navigraph/Jeppesen data sources for international flight planning.
