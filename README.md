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

From the repository root, you can scaffold a Vite+ application with
`vp create vite:application --directory apps/my-app` (replace `my-app` with your
app's lowercase kebab-case name). Treat the generated files as a starting point
and check them against the requirements below.

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

## PDF to MediaLayer

In the geospatial PDF app, use a PDF layer's **Create MediaLayer** action to add
a raster image of the document. The original PDF is retained but hidden after
successful conversion; both layers can be toggled or removed in the layer list.

Conversion uses the PDF raster engine to bake the embedded page-to-map transform
and reprojection into image pixels in the current view's spatial reference. The
returned raster extent positions the image with `ExtentAndRotationGeoreference`;
the original page image is not simply stretched over the PDF's bounding extent.
The current neatline setting is captured as image transparency and does not
change when the clip switch is subsequently toggled.

The longest image dimension is capped at 2048 pixels for GPU compatibility. The
result is an in-memory canvas, not an encoded or uploaded image, and is not a
durable WebMap asset. Its projection is fixed at conversion time; moving it to a
different view projection can introduce MediaLayer's linear reprojection
limitations. Convert again for that view to preserve the raster reprojection.
The PDF engine's existing reprojection limitations, including unsupported
grid-based datum transformations, still apply.

This prototype depends on internal `GeospatialPDFLayer` hooks:
`getCompatibleFullExtent`, `fetchPixels`, and `createNeatline`. They are guarded
at runtime but may change between SDK builds.

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
