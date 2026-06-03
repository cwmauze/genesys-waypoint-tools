# Contributing to Genesys Waypoint Tools

First off, thank you for considering contributing to this project! It's people like you that make the aviation open-source community robust and safe.

## The Golden Rule: The Math Engine
The most critical part of this application is `js/genesys-binary-engine.js`. This file handles the bit-perfect encoding of `.RTE` and `.DAT` files for the Genesys IDU avionics.
**DO NOT modify the offsets, magic bytes, CRC calculations, or padding logic in this file without explicit, hardware-tested validation.** 
A single byte error can cause the avionics to reject the flight plan in the cockpit. If you submit a PR that alters the binary engine, you must provide verifiable proof that the output was successfully loaded into a physical IDU unit or the EFIS Training Tool.

## Development Workflow
1. **Fork the Repository**: Create your own fork and clone it locally.
2. **Create a Branch**: Create a feature branch (`git checkout -b feature/amazing-feature`).
3. **Make Changes**:
   - UI/DOM changes should go in `js/app.js` and `css/style.css`.
   - Ensure the UI logic does not inadvertently leak into the binary engine.
4. **Test**: Verify that your changes work and haven't broken the `.RTE` export.
5. **Submit a Pull Request**: Provide a clear description of the changes.

## Code of Conduct
Please be respectful and professional. Aviation is a safety-critical field, and we prioritize stability, accuracy, and clear communication above all else.
