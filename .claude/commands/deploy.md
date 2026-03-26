Run the full deploy sequence:
1. npm test — if any test fails, stop and report
2. npm run lint — if errors, fix them first
3. npm run build — if build fails, stop and report
4. git add -A
5. Generate a descriptive commit message based on the changes
6. git commit
7. git push origin main
8. Confirm Vercel auto-deploy will trigger
9. Report: commit hash, files changed count, deploy status
