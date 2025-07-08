# Package Management Testing Guide

## Testing Package Tools in Claude Desktop

After restarting Claude Desktop with the latest build, test the package management functionality with these commands:

### 1. List All Packages
Ask Claude:
```
List all packages in Jamf
```

Expected: Should return a list of all packages with basic info (name, ID, category, size)

### 2. Search for Packages
Ask Claude:
```
Search for packages containing "chrome"
```
or
```
Find packages with "office" in the name
```

Expected: Should return filtered list of packages matching the search term

### 3. Get Package Details
Ask Claude:
```
Get details for package ID 123
```
(Replace 123 with an actual package ID from the list)

Expected: Should return detailed information including:
- Package name, version, category
- File size and fill settings
- Notes and requirements
- Install/uninstall settings

### 4. Get Package Deployment History
Ask Claude:
```
Show deployment history for package ID 123
```

Expected: Should return:
- Total number of policies using the package
- List of policies with names and IDs
- Deployment statistics

### 5. Find Policies Using a Package
Ask Claude:
```
Which policies use package ID 123?
```

Expected: Should return list of all policies that include this package

## Troubleshooting

### If packages aren't showing up:

1. **Check the API response structure**
   The Classic API might return packages under different field names:
   - Could be `packages`
   - Could be `package_list`
   - Could be wrapped in another object

2. **Enable debug mode** to see API responses:
   ```bash
   export JAMF_DEBUG_MODE=true
   ```

3. **Check permissions**
   Ensure your API user has permissions to:
   - Read packages
   - Read policies (for deployment history)

### Common Issues:

1. **Empty package list**
   - Verify packages exist in Jamf Pro
   - Check API permissions
   - Try the Classic API endpoint directly: `/JSSResource/packages`

2. **Package details not loading**
   - The response structure might be different
   - Check if it's wrapped in a `package` object
   - Field names might vary (e.g., `filename` vs `file_name`)

3. **Deployment history errors**
   - This requires policy read permissions
   - Large environments might timeout (lots of policies to check)

## What Package Data Should Include:

### List Response Fields:
- id
- name
- category
- filename
- size

### Detail Response Fields:
- All list fields plus:
- notes
- priority
- reboot_required
- fill_user_template
- fill_existing_users
- boot_volume_required
- allow_uninstalled
- os_requirements
- required_processor
- info
- switch_with_package

## Next Steps:

Once packages are working correctly, test:
1. Smart Groups functionality
2. Mobile Device Support
3. Enhanced Error Handling features