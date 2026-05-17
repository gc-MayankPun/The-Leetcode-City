# GSSoC 2026 Project Application

## Project Admin
- **Project Name***: LeetCode City
- **Repository URL***: https://github.com/Ixotic27/The-Leetcode-City
- **Describe your project***: LeetCode City is a 3D interactive visualization tool that transforms every LeetCode profile into a unique pixel art building. The more problems a user solves, the taller their building grows. Built using Next.js and React Three Fiber, it provides a gamified experience to explore developer profiles, compare stats, and socialize in a virtual city environment. It solves the problem of boring 2D statistics by providing an immersive, visual representation of a developer's coding journey.
- **Tech Stack***: 
  - [x] JavaScript
  - [x] TypeScript
  - [x] React
  - [x] Next.js
  - [x] Node.js
  - [ ] Python
  - [ ] Go
  - [ ] Rust
  - [ ] Java
  - [ ] Flutter
  - [ ] AI/ML
  - [ ] DevOps
  - [x] Other (Three.js, Supabase, Tailwind CSS)

## Contributor Readiness
- **Do you have good first issues ready?**: Yes
- **Good-first-issue labels prepared?**: Yes
- **README quality self-assessment**: High / Excellent
- **Expected number of contributors**: 10 - 20
- **How will you support contributors?***: We provide a detailed CONTRIBUTING.md, clear issue labels (including `good first issue`), and comprehensive pull request templates. Mentors and maintainers will actively review PRs within 48 hours and provide constructive feedback. We've also integrated an automated AI PR reviewer to assist with initial code quality checks. Communication will be handled via GitHub Discussions and Issues to ensure everyone has a supportive environment to learn and grow.
- **Prior open source program experience**: (Optional - Leave blank or specify if you have prior experience)

---

## Identified Good First Issues (For your reference)
Here are some issues you can create and label as `good first issue` in your repository:

1. **Add Screenshots to README**
   - **Description**: The `README.md` has a TODO to add screenshots. Contributors can take nice screenshots of the 3D city, profile page, and compare mode, and add them to the README.
2. **Translate Portuguese strings to English in Share Card API**
   - **Description**: There are some hardcoded Portuguese strings like `"TODO ARRANHA-CEU COMEÇA EM ALGUM LUGAR"` in `src/app/api/share-card/[username]/route.tsx` that need to be translated to English for internationalization.
3. **Implement actual Push Notifications**
   - **Description**: There is a TODO in `src/lib/notifications.ts` to replace placeholder push notification code with actual FCM/APNs/Web Push integration.
4. **Create a new Weather Effect**
   - **Description**: Add a new weather effect (like snow or rain) to the 3D scene in `src/components/CityScene.tsx`.
5. **Add Unit Tests for utility functions**
   - **Description**: Add Jest or Vitest unit tests for the helper functions located in the `src/lib/` directory.
