<!--
Thanks for contributing to pine-transpiler!
Please fill in the sections below. The checklist at the bottom helps reviewers
move quickly.
-->

## Summary

<!-- 1–3 sentences. What does this PR do, and why? -->

## Type of change

<!-- Check all that apply -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing usage to change)
- [ ] Documentation only
- [ ] CI / build / tooling
- [ ] Refactor (no behavior change)

## Pine Script coverage impact

<!-- Skip this section for non-transpiler PRs. -->

<!-- If this PR changes lexer/parser/generator/factory behavior, describe the
     Pine Script construct(s) involved. Link to the official Pine docs page if
     relevant. -->

- Construct(s):
- Pine version(s) affected: v5 / v6 / both / N/A
- New or updated `tests/corpus/` fixture(s):

## Test plan

<!-- How did you verify this? Reviewers should be able to run these checks. -->

- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun test` passes
- [ ] `bun run check-coverage` still meets the 95% gate
- [ ] (If user-facing) `CHANGELOG.md` updated under the `[Unreleased]` heading
- [ ] (If behavior change) `docs/SUPPORTED_FEATURES.md` updated

## Screenshots / output (if applicable)

<!-- For generator output changes, paste a small before/after diff. -->

## Related issues

<!-- Closes #N, Refs #M -->
