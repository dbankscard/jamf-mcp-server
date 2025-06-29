#!/bin/bash

echo "🚀 Preparing Jamf MCP Server for GitHub release..."

# Clean up any remaining company-specific references
echo "✨ Cleaning up any remaining specific references..."

# Remove any backup files
find . -name "*.backup" -type f -delete
find . -name "*.bak" -type f -delete

# Ensure all console.log statements are console.error in non-test files
echo "🔧 Ensuring clean console output..."
find src -name "*.ts" -not -path "*/\__tests__/*" -exec sed -i '' 's/console\.log(/console.error(/g' {} \;

# Build the project
echo "🏗️ Building project..."
npm run build

# Run tests
echo "🧪 Running tests..."
npm test

# Check for any remaining sensitive data
echo "🔍 Checking for sensitive data..."
if grep -r "globalhc\|Global Healing\|GHC-\|GH-" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage --exclude-dir=.git --exclude-dir=test-scripts .; then
  echo "❌ Found potential sensitive data. Please review and clean up."
  exit 1
else
  echo "✅ No sensitive data found"
fi

echo ""
echo "✅ Project is ready for GitHub release!"
echo ""
echo "Next steps:"
echo "1. Update package.json with your GitHub username"
echo "2. Update CONTRIBUTING.md with your repository URL"
echo "3. Initialize git: git init"
echo "4. Add files: git add ."
echo "5. Commit: git commit -m 'Initial commit: Jamf MCP Server v1.0.0'"
echo "6. Create GitHub repository"
echo "7. Add remote: git remote add origin https://github.com/YOUR_USERNAME/jamf-mcp-server.git"
echo "8. Push: git push -u origin main"
echo "9. Create release on GitHub with tag v1.0.0"