# Contributing to Jamf MCP Server

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with Github
We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## We Use [Github Flow](https://guides.github.com/introduction/flow/index.html)
Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any contributions you make will be under the MIT Software License
In short, when you submit code changes, your submissions are understood to be under the same [MIT License](LICENSE) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using Github's [issues](https://github.com/your-username/jamf-mcp-server/issues)
We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/your-username/jamf-mcp-server/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file from `.env.example`
4. Run tests: `npm test`
5. Build the project: `npm run build`

## Testing

- Write tests for any new functionality
- Ensure all tests pass: `npm test`
- Check test coverage: `npm run test:coverage`
- Aim for at least 80% code coverage

## Code Style

- We use TypeScript with strict mode enabled
- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

## Pull Request Process

1. Update the README.md with details of changes to the interface, if applicable
2. Update the docs with any new environment variables, tools, or features
3. The PR will be merged once you have the sign-off of at least one maintainer

## License
By contributing, you agree that your contributions will be licensed under its MIT License.