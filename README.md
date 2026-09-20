# PRism

PRism is a pull request impact analysis tool for public GitHub repositories. It goes beyond the diff to show which components changed, how they connect, and what may be affected downstream.

**Live application:** [prism-nine-sage.vercel.app](https://prism-nine-sage.vercel.app/)

## Features

- Interactive impact maps for GitHub pull requests
- Verified reference tracing across the repository
- Clear separation between verified findings and model-inferred relationships
- Plain-language change summaries
- Manual QA checklists to review before merging
- GitHub App integration for analysis links directly on pull requests

## How It Works

1. Submit a public GitHub pull request URL.
2. PRism reads the diff and inspects a shallow clone of the repository.
3. It traces references to changed functions, classes, and exports.
4. It combines verified repository evidence with AI-assisted analysis.
5. The results are presented as an impact map and merge checklist.

## Technology

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- React Flow
- NVIDIA Nemotron
- GitHub API
- Vercel

## Local Development

### Prerequisites

- Node.js 20 or later
- npm
- A GitHub access token
- Access to an OpenAI-compatible Nemotron endpoint

### Setup

```bash
git clone https://github.com/kiermurrdev/PRism.git
cd PRism
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

| Variable | Description |
| --- | --- |
| `GITHUB_TOKEN` | Token used to read public repository and pull request data |
| `NEMOTRON_BASE_URL` | Base URL of the Nemotron-compatible API |
| `NEMOTRON_MODEL` | Model identifier used for analysis |
| `NVIDIA_API_KEY` | API key for the configured model endpoint |
| `NEMOTRON_TIMEOUT_MS` | Optional analysis timeout in milliseconds |

Do not commit real credentials or private keys.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run the test suite |
