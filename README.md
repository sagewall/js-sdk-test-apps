# JS SDK Test Apps

A Vite+ monorepo with a shared application directory and GitHub Pages deployment.

## GitHub Pages

The Pages workflow deploys on pushes to `main` and can also be run manually from
the Actions tab. It builds shared packages first, then every eligible app, and
uploads a single `dist/` artifact:

- `apps/website` becomes the site root (`https://<owner>.github.io/<repo>/`).
- Other apps use their folder names (`https://<owner>.github.io/<repo>/<app>/`).
- The website lists those apps automatically, using the same discovery as the build.

After pushing this repository to GitHub, open **Settings > Pages** and select
**GitHub Actions** as the build source. If the default branch is not `main`, update
the workflow's branch filter. GitHub supplies the site's base path, including an
empty prefix for user/organization sites or custom domains.

### Adding an application

1. Create a workspace package under `apps/<lowercase-kebab-case-name>/` with a unique
   package `name` and a `build` script. Restart the website dev server after adding it.
2. Use a Vite-compatible build that accepts `--base <path>` and writes a static
   `dist/index.html`. For example: `"build": "tsc && vp build"`.
3. Set `description` in the app's package manifest for the directory listing.
   Optionally add `"pages": { "title": "Readable app title" }` to override its name.
4. Push to `main`. The app is built, listed, and deployed without workflow edits.

Set `"pages": false` in an app's package manifest to exclude it from both the
deployment and the directory. Shared libraries remain under `packages/` and are
not published as applications. App paths must not conflict with files or folders
emitted by the website, such as `assets/`.

Use Vite imports and `import.meta.env.BASE_URL` for asset and navigation URLs;
hard-coded root paths like `/assets/image.png` bypass the repository prefix.
Client-side routers should use hash routing, or pre-render each URL: GitHub Pages
does not provide SPA history fallback or server-side rendering.

### Local deployment build

```bash
vp run --no-cache build:pages /js-sdk-test-apps/
```

Replace the argument with your repository's Pages base path, or `/` for a domain
root. Deployment builds disable task caching to avoid reusing another base path's
assets. The assembled static site is in `dist/`.

## Development

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp test
```

- Build the monorepo:

```bash
vp run -r build
```

- Run the development server:

```bash
vp run dev
```
