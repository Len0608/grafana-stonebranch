# Stonebranch UAC Grafana Datasource

A Grafana datasource plugin for [Stonebranch Universal Controller (UAC)](https://docs.stonebranch.com). Queries the UAC Prometheus metrics endpoint directly — no separate Prometheus server required.

Includes four pre-built dashboards: **UAC Overview**, **UAC Task Execution**, **UAC License**, and **UAC JVM Health**.

## Development

### Prerequisites

- Node.js (see `.nvmrc` for the required version)
- Grafana 10.0.0 or newer

### Setup

```bash
npm install
```

### Build

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build
```

### Lint

```bash
npm run lint
npm run lint:fix
```

### E2E Tests

```bash
npm run server   # start a Grafana instance via Docker
npm run e2e      # run Playwright tests against it
```

## Provisioning

The `provisioning/` directory contains ready-to-use Grafana provisioning config:

- `provisioning/datasources/datasources.yml` — datasource definition
- `provisioning/dashboards/` — UAC Overview, Task Execution, and License dashboards

Point your Grafana instance at this directory with `paths.provisioning` in `grafana.ini`.

## Publishing

See the [Grafana plugin packaging guide](https://grafana.com/developers/plugin-tools/publish-a-plugin/package-a-plugin) for signing and distribution steps.

The GitHub Actions release workflow in `.github/workflows/release.yml` automates signing and packaging on version tags. Add your `GRAFANA_API_KEY` as a repository secret, then:

```bash
npm version <major|minor|patch>
git push origin main --follow-tags
```
