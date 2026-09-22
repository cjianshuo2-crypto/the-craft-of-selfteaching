# Reading Site Maintenance

The website is a generated presentation layer for the upstream book. The source
chapters in `markdown/` and assets in `images/` remain untouched.

## Local development

```sh
npm ci
npm run docs:dev
```

The production site uses `/the-craft-of-selfteaching/` as its base path. The
development server prints the complete local URL after it starts.

## Verification

```sh
npm run lint
npm test
npm run docs:build
```

`npm run prepare:site` reads `markdown/TOC.md`, creates the generated chapter
copies under `site/book/`, and copies local assets to `site/public/images/`.
Generated content is ignored by Git and can be recreated at any time.

## Upstream updates

```sh
git fetch upstream master
git merge --ff-only upstream/master
npm ci
npm run lint
npm test
npm run docs:build
```

If the site branch has local commits, use a normal reviewed merge instead of
forcing an update. Never overwrite or rewrite the upstream book content merely
to satisfy the website renderer.
