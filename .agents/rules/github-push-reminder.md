# GitHub Push Reminder Rule

Whenever the user asks to push code, commit, or push to GitHub, you MUST first remind them of the following steps before doing anything:

```
🚦 GitHub Workflow Checklist — Before Pushing:

1. Are you on a feature branch? (NOT on main or dev)
   git branch   ← check current branch

2. If not, create one first:
   git checkout dev
   git pull origin dev
   git checkout -b feat/your-feature-name

3. Stage and commit:
   git add .
   git commit -m "feat/fix/db/chore: short description"

4. Push to your feature branch (NOT main):
   git push origin feat/your-feature-name

5. Go to GitHub → open a Pull Request → base: dev

⚠️ NEVER push directly to main or dev.
```

Only after confirming the user is on a feature branch, proceed with the push-related task.
