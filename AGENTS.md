# Project Rules

## Purpose

This repository publishes the upstream book *The Craft of Selfteaching* as a
non-commercial, read-only VitePress website.

## Directory Structure

- `markdown/`, `images/`, and root-level notebooks/files are upstream content.
  Do not edit them for site presentation.
- `site/` contains authored website pages, VitePress configuration, and styles.
- `scripts/` contains deterministic site-generation and validation scripts.
- `tests/` contains Node.js tests for generated content and site metadata.
- `site/book/` and `site/public/images/` are generated and must not be committed.
- `.github/workflows/` contains deployment automation.

## Naming

- Use lowercase kebab-case for new files and directories.
- Use English for code, configuration keys, commands, and commit messages.
- Preserve upstream filenames exactly in generated chapter routes.

## Content Rules

- Preserve upstream book prose verbatim. Presentation fixes happen only in the
  generated copy and must be limited to paths, links, or renderer compatibility.
- Keep the author, upstream repository, and CC BY-NC-ND notice visible.
- Do not add advertising, payments, tracking, or AI-generated book content.
- Never commit credentials, tokens, passwords, build output, or dependency trees.

## Verification

Run all of the following after changes:

1. `npm run lint`
2. `npm test`
3. `npm run docs:build`

Also confirm that building does not modify tracked upstream content.

## Cleanup

- Generated site sources may be removed with `npm run clean` and recreated with
  `npm run prepare:site`.
- Keep only reproducible source files in Git.
- Remove obsolete generated files and caches rather than maintaining them by hand.
