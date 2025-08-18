"""
Simple Jamf Agent Example - Following AWS Bedrock InlineAgent Pattern

This example shows the most basic way to create a Jamf agent using
the official InlineAgent pattern from AWS samples.
"""

from InlineAgent.agent import InlineAgent
from InlineAgent.action_group import ActionGroup
import json


# Define tool functions that will connect to MCP server
def search_devices(query: str, limit: int = 50) -> str:
    """
    Search for devices in Jamf Pro.
    
    Args:
        query: Search term (name, serial, user, etc.)
        limit: Max results to return
    
    Returns:
        JSON string with device list
    """
    # In production, this would call the MCP server
    # For now, return mock data
    mock_devices = [
        {
            "id": "1",
            "name": "John's MacBook Pro",
            "serialNumber": "ABC123",
            "osVersion": "14.1.1",
            "lastContactTime": "2024-01-15T10:30:00Z"
        },
        {
            "id": "2", 
            "name": "Conference Room iPad",
            "serialNumber": "DEF456",
            "osVersion": "17.1",
            "lastContactTime": "2024-01-14T15:45:00Z"
        }
    ]
    
    # Filter by query
    filtered = [d for d in mock_devices if query.lower() in json.dumps(d).lower()]
    
    return json.dumps({
        "count": len(filtered),
        "devices": filtered[:limit]
    }, indent=2)


def get_device_details(device_id: str) -> str:
    """
    Get detailed information about a specific device.
    
    Args:
        device_id: The Jamf device ID
        
    Returns:
        JSON string with device details
    """
    # Mock detailed device data
    mock_details = {
        "id": device_id,
        "name": "John's MacBook Pro",
        "hardware": {
            "model": "MacBook Pro 16-inch 2023",
            "processor": "Apple M3 Pro",
            "totalRamMB": 32768,
            "batteryPercent": 87
        },
        "storage": {
            "bootDriveAvailableMB": 125000,
            "percentUsed": 75
        },
        "userAndLocation": {
            "username": "john.doe",
            "email": "john.doe@company.com",
            "department": "Engineering"
        }
    }
    
    return json.dumps(mock_details, indent=2)


def update_inventory(device_id: str) -> str:
    """
    Update inventory for a specific device.
    
    Args:
        device_id: Device to update
        
    Returns:
        Status message
    """
    return f"Successfully triggered inventory update for device {device_id}"


# Create the action group with our tools
jamf_tools = ActionGroup(
    name="JamfManagementTools",
    description="Tools for managing Apple devices via Jamf Pro",
    tools=[search_devices, get_device_details, update_inventory]
)

# Create the InlineAgent
jamf_agent = InlineAgent(
    foundation_model="anthropic.claude-3-sonnet-20240229-v1:0",
    instruction="""You are a helpful Jamf Pro management assistant. 

Your role is to help IT administrators manage Apple devices using the available tools.

Key responsibilities:
- Search for devices by various criteria
- Provide detailed device information
- Update device inventory when requested
- Format responses clearly and concisely

Always include relevant details like device names and serial numbers in your responses.""",
    agent_name="JamfAssistant",
    action_groups=[jamf_tools],
    enable_trace=True
)


def main():
    """Test the agent with some example queries"""
    
    print("🤖 Jamf Assistant (InlineAgent Pattern)")
    print("=" * 50)
    
    # Test queries
    queries = [
        "Find all MacBook devices",
        "Show me details for device ID 1",
        "Search for devices in the conference room",
        "Update inventory for device ABC123"
    ]
    
    for query in queries:
        print(f"\n💬 User: {query}")
        
        # Invoke the agent
        response = jamf_agent.invoke(query)
        
        # Print the response
        print(f"🤖 Agent: {response['output']}")
        
        # Optionally show trace for debugging
        if response.get('trace') and response['trace'].get('agentActions'):
            print("\n📋 Tools used:")
            for action in response['trace']['agentActions']:
                print(f"  - {action.get('actionName', 'Unknown')}")


if __name__ == "__main__":
    main()