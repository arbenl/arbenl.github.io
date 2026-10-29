# Week 7 lecture purpose implementation plan

**Goal:** distinguish conceptual 45-minute lecture from procedural 90-minute lab.

**Architecture:** edit lecture source JSON, reuse both renderers, preserve the native deck and canonical web routes. Align only the lecture description in the live and scheduled builders.

**Tech Stack:** JSON, existing HTML generator, Artifact Tool PPTX renderer.

- [ ] Replace procedural lecture slides with conceptual questions and explicit learning outcomes.
- [ ] Render and validate lecture PPTX, update its hash, regenerate canonical HTML.
- [ ] Verify projector interaction, slide fit and unchanged lab archive hashes.
- [ ] Run material tests and isolated scheduled-release check; publish and verify live lecture.
