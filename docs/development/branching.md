# Branching and Delivery

- Default branch: `main`
- Sprint branches: `feat/sprint-N-short-name`
- Commit style: Conventional Commits
- Direct pushes to `main` are prohibited after the one-time empty-repository bootstrap.
- Force pushes to `main` are prohibited.
- A sprint branch may be pushed only after automated gates pass, secrets are scanned, the diff is reviewed, and manual verification is recorded.
- Merging, tagging, and publishing remain explicit release decisions.
