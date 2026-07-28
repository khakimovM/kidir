---
name: commit
description: O'zgarishlarni conventional commit formatida commit qiladi
disable-model-invocation: true
allowed-tools: Bash(git add *) Bash(git commit *) Bash(git status) Bash(git diff *)
---
## Joriy holat
!`git status --short`
!`git diff HEAD --stat`

## Vazifa
1. O'zgarishlarni tahlil qil, mantiqan bitta commit'mi tekshir (aralash bo'lsa ayt)
2. Format: `type(scope): message` —  scope: web | admin | api | shared. Ingliz tilida, imperativ
3. `git add` + `git commit`. Push QILMA.
