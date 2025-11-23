# CLAUDE.md - AI Assistant Guide for where-money-go

## Project Overview

**where-money-go** is a financial tracking application designed to help users understand and manage their spending patterns.

> **Note**: This is a new repository. Update this document as the project structure evolves.

## Repository Structure

```
where-money-go/
├── CLAUDE.md          # This file - AI assistant guidelines
└── .git/              # Git repository
```

*Structure will be updated as development progresses.*

## Development Setup

### Prerequisites
- To be determined based on chosen tech stack

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd where-money-go

# Install dependencies (update based on package manager)
# npm install / yarn / pnpm install
```

## Development Workflows

### Branch Naming
- Feature branches: `feature/<description>`
- Bug fixes: `fix/<description>`
- AI-assisted: `claude/<session-id>`

### Commit Messages
- Use conventional commits format
- Examples: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

### Testing
- Run tests before committing
- Ensure all tests pass before pushing

## Code Conventions

### General Guidelines
- Keep functions small and focused
- Use meaningful variable and function names
- Add comments only for non-obvious logic
- Follow DRY (Don't Repeat Yourself) principle

### Security
- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive configuration
- Validate all user inputs
- Sanitize data before database operations

## AI Assistant Instructions

### When Working on This Project
1. Read existing code before making changes
2. Follow established patterns in the codebase
3. Keep changes minimal and focused on the task
4. Don't over-engineer solutions
5. Update this CLAUDE.md when significant patterns emerge

### File Operations
- Prefer editing existing files over creating new ones
- Don't add unnecessary documentation files
- Keep the codebase clean and organized

### Testing Requirements
- Add tests for new functionality
- Ensure existing tests pass after changes
- Test edge cases and error conditions

## Common Tasks

### Starting Development
```bash
# Check current status
git status

# Create feature branch
git checkout -b feature/<name>
```

### Making Changes
```bash
# Stage changes
git add .

# Commit with message
git commit -m "type: description"

# Push to remote
git push -u origin <branch-name>
```

## Project-Specific Notes

*Add project-specific conventions, API patterns, database schemas, and other important details here as the project develops.*

---

**Last Updated**: 2025-11-23
