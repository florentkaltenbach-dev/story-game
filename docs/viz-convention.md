# Visualization Page Convention

All visualization pages in `web/public/` are autodiscovered by the rigging server. To be included in the gallery and manifest, a page must follow this convention.

## VIZ-META Block

Place an HTML comment at the **top of the file** (before `<!DOCTYPE html>` or as the first child of `<html>`) containing a `VIZ-META` JSON object:

```html
<!-- VIZ-META {"title":"Page Title","description":"One-line description","category":"visualization"} -->
<!DOCTYPE html>
...
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Display name shown in gallery and hub |
| `description` | string | One-line summary of what the page shows |
| `category` | string | One of: `visualization`, `dashboard`, `art`, `debug` |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `audience` | string | Who this is for, e.g. `"MC"`, `"players"`, `"dev"` |
| `dataSources` | string[] | Config/memory files this page reads |
| `tags` | string[] | Freeform tags for filtering |
| `added` | string | ISO date when page was created |

### Example

```html
<!-- VIZ-META {"title":"Knowledge Fog Matrix","description":"Player × secrets revelation heatmap","category":"visualization","audience":"MC","added":"2026-03-10"} -->
<!DOCTYPE html>
<html lang="en">
...
```

## File Naming

- **Slug** is derived from the filename: `fog-matrix.html` → slug `fog-matrix`
- URL served at `/viz/{slug}` (rigging) and linked from hub as `/sandbox/rigging/viz/{filename}`
- Use lowercase kebab-case filenames

## Exclusions

The scanner ignores:
- Files starting with `_` (e.g. `_template.html`)
- `index.html`
- Non-HTML files (SVG, JSON, etc.)

## Style Conventions

All viz pages in this project share:
- **Fonts:** Crimson Text (headings) + JetBrains Mono (body) via Google Fonts
- **Palette:** Dark navy background (`#0a0e17`), gold accent (`#c4a35a`), green (`#6b9e7a`)
- **D3 v7** from CDN: `https://d3js.org/d3.v7.min.js`
- Full-viewport SVG with zoom/pan where applicable
- Data embedded inline (no fetch calls to external endpoints)

## Adding a New Visualization

1. Create `web/public/my-viz.html` with VIZ-META block
2. Restart rigging (`pm2 restart rigging`) or wait 60s for rescan
3. Page appears automatically in `/viz` gallery, `/api/viz-manifest`, and the hub
