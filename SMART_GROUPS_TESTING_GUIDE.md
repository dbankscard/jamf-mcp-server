# Smart Groups Testing Guide

## Testing Computer Group Management in Claude Desktop

After restarting Claude Desktop with the latest build, test the smart groups functionality with these commands:

### 1. List All Computer Groups
Ask Claude:
```
List all computer groups
```

Expected: Should return a list of all computer groups (both smart and static) with basic info (name, ID, type, member count)

### 2. List Only Smart Groups
Ask Claude:
```
Show me only smart groups
```
or
```
List computer groups of type smart
```

Expected: Should return filtered list showing only smart groups with their criteria

### 3. List Only Static Groups
Ask Claude:
```
Show me static computer groups
```

Expected: Should return only manually managed static groups

### 4. Search for Groups
Ask Claude:
```
Search for computer groups containing "marketing"
```
or
```
Find groups with "test" in the name
```

Expected: Should return filtered list of groups matching the search term

### 5. Get Group Details
Ask Claude:
```
Get details for computer group ID 10
```
(Replace 10 with an actual group ID from the list)

Expected: Should return detailed information including:
- Group name and ID
- Type (smart or static)
- For smart groups: Criteria/rules
- For static groups: Member list
- Site information
- Member count

### 6. Get Group Members
Ask Claude:
```
Show members of computer group ID 10
```

Expected: Should return list of all computers in the group with:
- Computer ID and name
- Serial number
- Last check-in time

### 7. Create a Static Group (Requires Confirmation)
Ask Claude:
```
Create a static computer group named "Test Group" with computer IDs 1,2,3
```

Expected: Should ask for confirmation, then create the group
Note: Requires write permissions and JAMF_READ_ONLY=false

### 8. Update Static Group Membership (Requires Confirmation)
Ask Claude:
```
Update static group ID 20 to include computers 4,5,6
```

Expected: Should ask for confirmation, then update the group membership
Note: Cannot update smart groups (membership is criteria-based)

### 9. Delete a Group (Requires Confirmation)
Ask Claude:
```
Delete computer group ID 30
```

Expected: Should ask for confirmation before deletion
Note: Be careful with this in production!

## What to Look For

### Smart Groups Should Show:
- Group name and ID
- Criteria (rules that define membership)
- Member count
- Site assignment
- Cannot be manually updated (membership is dynamic)

### Static Groups Should Show:
- Group name and ID
- Member list (can be empty)
- Can be created, updated, and deleted
- Manual membership management

## Troubleshooting

### If groups aren't showing up:

1. **Check API permissions**
   Ensure your API user has permissions to:
   - Read Computer Groups
   - Create/Update/Delete Static Computer Groups (for write operations)

2. **Check the API response**
   - Classic API returns groups under `computer_groups`
   - Groups might be paginated if you have many

3. **Enable debug mode** to see API responses:
   ```bash
   export JAMF_DEBUG_MODE=true
   ```

### Common Issues:

1. **Empty group list**
   - Verify groups exist in Jamf Pro
   - Check API permissions
   - Try the Classic API endpoint directly: `/JSSResource/computergroups`

2. **Can't see group criteria**
   - Smart group criteria requires full group details (not just list view)
   - Use getComputerGroupDetails to see criteria

3. **Can't update smart groups**
   - This is expected - smart groups are criteria-based
   - Only static groups can have manual membership updates

4. **Member list is empty**
   - Some groups might have no current members
   - Check if criteria matches any computers (for smart groups)

## API Endpoints Used:

- List groups: `/JSSResource/computergroups`
- Get group details: `/JSSResource/computergroups/id/{id}`
- Create group: POST to `/JSSResource/computergroups/id/0`
- Update group: PUT to `/JSSResource/computergroups/id/{id}`
- Delete group: DELETE to `/JSSResource/computergroups/id/{id}`

## Next Steps:

Once smart groups are working correctly, test:
1. Mobile Device Support
2. Enhanced Error Handling features