# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-20

Initial public release.

### Added

- `npx skill-pilot` command that detects your project's stack and installs matching AI agent skills in one step.
- Stack detection from package manifests, config files and project layout, including monorepo workspaces.
- Combo detection that recommends extra skills when technologies are used together (e.g. React Hook Form + Zod).
- Interactive picker to choose which skills to install, with already-installed skills marked.
- Installation for multiple agents, including Claude Code, Cline, Kiro and a universal target.
- Curated skill registry bundled with the CLI.
- Skill downloads from GitHub with an automatic jsDelivr fallback, plus local caching.
- Content hashing and a lockfile to track installed skills and their versions.
- Install summary report with per-skill errors, and a `--verbose` flag for full traces.

[Unreleased]: https://github.com/hiyasin/skill-pilot/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/hiyasin/skill-pilot/releases/tag/v0.1.0
