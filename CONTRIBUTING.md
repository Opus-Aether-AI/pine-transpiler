# Contributing to Pine Script Transpiler

Thank you for your interest in contributing to the Pine Script Transpiler! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm 8+
- Git

### Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/pine-transpiler.git
cd pine-transpiler
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Build the package**

```bash
pnpm build
```

4. **Run type checking**

```bash
pnpm typecheck
```

5. **Run linting**

```bash
pnpm lint
```

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

- Clear, descriptive title
- Pine Script code that reproduces the issue
- Expected behavior vs actual behavior
- Error messages (if any)
- Your environment (Node version, OS, etc.)

### Suggesting Features

Feature suggestions are welcome! Please:

- Use a clear, descriptive title
- Provide detailed description of the proposed feature
- Explain the use case and benefits
- Consider including example Pine Script code

### Contributing Code

1. **Find or create an issue** - Discuss your changes before starting work
2. **Create a branch** - Use a descriptive name (e.g., `fix/rsi-calculation`, `feat/add-stochastic`)
3. **Make your changes** - Follow our coding standards
4. **Test your changes** - Ensure everything works correctly
5. **Submit a pull request** - Reference the related issue

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Maintain strict type safety
- Avoid `any` types when possible
- Export types for public APIs

### Code Style

We use [Biome](https://biomejs.dev/) for code formatting and linting:

```bash
# Check code style
pnpm lint

# Auto-fix issues
pnpm lint:fix
```

### File Organization

```
src/
├── types/          # Type definitions
├── parser/         # Pine Script parsing logic
├── mappings/       # Function mapping tables
├── generator/      # JavaScript code generation
└── index.ts        # Main API exports
```

### Naming Conventions

- **Files**: kebab-case (e.g., `expression-transpiler.ts`)
- **Functions**: camelCase (e.g., `transpileToPineJS`)
- **Types/Interfaces**: PascalCase (e.g., `TranspileToPineJSResult`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RECURSION_DEPTH`)

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(parser): add support for array operations
fix(generator): correct MACD signal line calculation
docs(readme): update installation instructions
```

## Pull Request Process

1. **Update documentation** - If you change APIs, update README.md
2. **Add tests** - Include tests for new features (when test suite is available)
3. **Update CHANGELOG.md** - Add entry under "Unreleased" section
4. **Ensure CI passes** - All checks must pass
5. **Request review** - Wait for maintainer review
6. **Address feedback** - Make requested changes
7. **Squash commits** - Clean up commit history if needed

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings introduced
- [ ] CHANGELOG.md updated
- [ ] All CI checks passing

## Adding New Pine Script Functions

When adding support for new Pine Script functions:

1. **Add to mappings** - Update appropriate file in `src/mappings/`
2. **Update documentation** - Add to supported functions list
3. **Add examples** - Include usage example in README
4. **Test thoroughly** - Verify output matches Pine Script behavior

Example mapping:

```typescript
export const technicalAnalysisMappings: Record<string, string> = {
  'ta.sma': 'PineJS.Std.sma',
  'ta.ema': 'PineJS.Std.ema',
  // Add new function here
  'ta.newfunction': 'PineJS.Std.newfunction',
};
```

## Questions?

- Open a [Discussion](https://github.com/opusaether/pine-transpiler/discussions) for questions
- Check existing issues and discussions first
- Be respectful and patient

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 License.

---

Thank you for contributing to Pine Script Transpiler! 🎉
