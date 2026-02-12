# Dogfood Log

Started: 2026-02-11
Goal: Log 20+ real meals, note everything that feels off.

Format: `- [YYYY-MM-DD] observation`

---

## Bugs
- [2026-02-11] iOS home screen: app requires re-login every time it's reopened. Hypotheses: (1) session token expiring + silent refresh failure, (2) iOS WebKit purging localStorage for standalone PWAs, (3) ProtectedRoute redirecting before async getSession() resolves. Need more data — when does it happen? Every reopen or only after a while?

## Friction
- [2026-02-11] ~~"Restaurant name" label too narrow for non-restaurant meals~~ — FIXED: renamed to "Where did you eat?"


## Missing


## Ideas
- [2026-02-11] Show total spend this week on home page
