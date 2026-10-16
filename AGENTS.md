# GAIN workflow

- After implementing a requested change, run the required checks, commit the changes, create a pull request against `main`, and merge it once CI passes. Then update the local `main` and verify the working tree is clean.
- The user has authorized this commit-and-merge workflow by default. Do not ask again unless they explicitly request a different workflow or a concrete blocker requires their input.
- Never bypass failing checks, branch protection, or unresolved conflicts to complete a merge.
