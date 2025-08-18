"""
Jamf InlineAgent Implementation - Following AWS Bedrock Agent Samples Pattern

This implementation follows the official pattern from:
https://github.com/awslabs/amazon-bedrock-agent-samples

The agent connects to the Jamf MCP Server to use its tools.
"""

import os
import json
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime

# Official InlineAgent imports from AWS samples
from InlineAgent.agent import InlineAgent
from InlineAgent.action_group import ActionGroup
from InlineAgent.models import InlineAgentConfig

# For MCP integration
import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


class JamfMCPActionGroup:
    """
    Custom ActionGroup that bridges InlineAgent tools to MCP server tools.
    This allows the InlineAgent to use tools exposed by the MCP server.
    """
    
    def __init__(self, mcp_server_url: str):
        self.mcp_server_url = mcp_server_url
        self.mcp_session = None
        self.available_tools = {}
        
    async def initialize(self):
        """Connect to MCP server and discover available tools"""
        # For production, connect to ECS-hosted MCP server
        if os.environ.get("ENVIRONMENT") == "production":
            # Connect via HTTP to ECS service
            self.mcp_session = await self._connect_http_mcp()
        else:
            # Local development with stdio
            self.mcp_session = await self._connect_stdio_mcp()
            
        # Discover available tools from MCP server
        await self._discover_tools()
        
    async def _connect_stdio_mcp(self):
        """Connect to MCP server via stdio (local development)"""
        server_params = StdioServerParameters(
            command="npm",
            args=["run", "serve"],
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            env={
                "JAMF_URL": os.environ.get("JAMF_URL"),
                "JAMF_CLIENT_ID": os.environ.get("JAMF_CLIENT_ID"),
                "JAMF_CLIENT_SECRET": os.environ.get("JAMF_CLIENT_SECRET"),
            }
        )
        
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                return session
                
    async def _connect_http_mcp(self):
        """Connect to MCP server via HTTP (production)"""
        # This would connect to the ECS-hosted MCP server
        # Implementation depends on how MCP protocol works over HTTP
        raise NotImplementedError("HTTP MCP connection not yet implemented")
        
    async def _discover_tools(self):
        """Discover available tools from the MCP server"""
        if self.mcp_session:
            tools_response = await self.mcp_session.list_tools()
            for tool in tools_response.tools:
                self.available_tools[tool.name] = tool
                
    def create_tool_functions(self):
        """
        Create Python functions for each MCP tool that can be used by InlineAgent.
        This is the bridge between MCP tools and InlineAgent tools.
        """
        tool_functions = []
        
        # Create a Python function for each MCP tool
        for tool_name, tool_spec in self.available_tools.items():
            # Create a function dynamically that calls the MCP tool
            async def tool_function(**kwargs):
                """Dynamic function that calls MCP tool"""
                result = await self.mcp_session.call_tool(tool_name, kwargs)
                return result.content[0].text if result.content else ""
                
            # Set function metadata for InlineAgent
            tool_function.__name__ = tool_name
            tool_function.__doc__ = tool_spec.description
            
            tool_functions.append(tool_function)
            
        return tool_functions


# Tool functions that wrap MCP server calls
# These follow the InlineAgent pattern of Python functions with docstrings

async def search_devices(query: str, limit: int = 50) -> dict:
    """
    Search for devices in Jamf Pro by name, serial number, IP address, username, or other criteria.
    
    Args:
        query: Search query to find devices
        limit: Maximum number of results to return (default: 50)
        
    Returns:
        Dictionary containing device search results
    """
    # This will be connected to MCP server's searchDevices tool
    mcp_result = await global_mcp_client.call_tool("searchDevices", {
        "query": query,
        "limit": limit
    })
    return json.loads(mcp_result.content[0].text)


async def get_device_details(device_id: str) -> dict:
    """
    Get detailed information about a specific device including hardware, software, and user details.
    
    Args:
        device_id: The Jamf device ID
        
    Returns:
        Dictionary containing detailed device information
    """
    # This will be connected to MCP server's getDeviceDetails tool
    mcp_result = await global_mcp_client.call_tool("getDeviceDetails", {
        "deviceId": device_id
    })
    return json.loads(mcp_result.content[0].text)


async def execute_policy(policy_id: str, device_ids: List[str], confirm: bool = False) -> dict:
    """
    Execute a Jamf policy on one or more devices (requires confirmation).
    
    Args:
        policy_id: The Jamf policy ID to execute
        device_ids: List of device IDs to execute the policy on
        confirm: Confirmation flag for policy execution (default: False)
        
    Returns:
        Dictionary containing execution results
    """
    # This will be connected to MCP server's executePolicy tool
    mcp_result = await global_mcp_client.call_tool("executePolicy", {
        "policyId": policy_id,
        "deviceIds": device_ids,
        "confirm": confirm
    })
    return json.loads(mcp_result.content[0].text)


async def update_inventory(device_id: str) -> dict:
    """
    Force an inventory update on a specific device.
    
    Args:
        device_id: The device ID to update inventory for
        
    Returns:
        Dictionary containing update status
    """
    # This will be connected to MCP server's updateInventory tool
    mcp_result = await global_mcp_client.call_tool("updateInventory", {
        "deviceId": device_id
    })
    return json.loads(mcp_result.content[0].text)


def create_jamf_agents():
    """
    Create specialized Jamf agents following the InlineAgent pattern.
    Each agent has a specific role and uses appropriate MCP tools.
    """
    
    # Device Management Agent
    device_tools = ActionGroup(
        name="DeviceManagementTools",
        description="Tools for device discovery and inventory management",
        tools=[search_devices, get_device_details, update_inventory]
    )
    
    device_agent = InlineAgent(
        foundation_model="anthropic.claude-3-sonnet-20240229-v1:0",
        instruction="""You are a Jamf device management specialist. Your role is to:
        - Search for devices using various criteria
        - Retrieve detailed device information
        - Update device inventory
        - Provide clear, formatted responses about device status
        
        Always include device names and serial numbers in your responses.""",
        agent_name="JamfDeviceAgent",
        action_groups=[device_tools],
        enable_trace=True,
        max_iterations=5
    )
    
    # Policy Execution Agent
    policy_tools = ActionGroup(
        name="PolicyExecutionTools",
        description="Tools for policy management and execution",
        tools=[execute_policy]
    )
    
    policy_agent = InlineAgent(
        foundation_model="anthropic.claude-3-sonnet-20240229-v1:0",
        instruction="""You are a Jamf policy execution specialist. Your role is to:
        - Execute policies on devices safely
        - Always confirm before executing policies
        - Validate device compatibility before execution
        - Report execution status clearly
        
        IMPORTANT: Always ask for confirmation before executing policies.""",
        agent_name="JamfPolicyAgent",
        action_groups=[policy_tools],
        enable_trace=True,
        max_iterations=3
    )
    
    # Main Orchestrator Agent (follows supervisor pattern)
    all_tools = ActionGroup(
        name="AllJamfTools",
        description="Complete set of Jamf management tools",
        tools=[search_devices, get_device_details, update_inventory, execute_policy]
    )
    
    orchestrator_agent = InlineAgent(
        foundation_model="anthropic.claude-3-5-sonnet-20240620-v1:0",  # Using more capable model
        instruction="""You are the main Jamf management assistant that coordinates all operations.
        
        Your role is to:
        1. Understand user requests about Jamf device management
        2. Use the appropriate tools to fulfill requests
        3. Coordinate complex multi-step operations
        4. Provide clear, well-formatted responses
        
        For complex requests:
        - Break them down into steps
        - Use multiple tools as needed
        - Summarize results clearly
        
        Always prioritize safety - confirm before any destructive operations.""",
        agent_name="JamfOrchestratorAgent",
        action_groups=[all_tools],
        enable_trace=True,
        max_iterations=10
    )
    
    return {
        "orchestrator": orchestrator_agent,
        "device_agent": device_agent,
        "policy_agent": policy_agent
    }


class JamfAgentSystem:
    """
    Main class that manages the Jamf agent system with MCP integration.
    This follows the pattern from AWS Bedrock Agent samples.
    """
    
    def __init__(self):
        self.agents = {}
        self.mcp_action_group = None
        self.initialized = False
        
    async def initialize(self):
        """Initialize the agent system and MCP connection"""
        if self.initialized:
            return
            
        # Initialize MCP connection
        mcp_server_url = os.environ.get("MCP_SERVER_URL", "http://localhost:3000")
        self.mcp_action_group = JamfMCPActionGroup(mcp_server_url)
        await self.mcp_action_group.initialize()
        
        # Create agents
        self.agents = create_jamf_agents()
        self.initialized = True
        
    async def process_request(self, user_message: str, session_id: str = None) -> Dict[str, Any]:
        """
        Process a user request using the appropriate agent.
        
        Args:
            user_message: The user's natural language request
            session_id: Optional session ID for conversation continuity
            
        Returns:
            Dictionary containing the agent's response
        """
        if not self.initialized:
            await self.initialize()
            
        # Use the orchestrator agent for all requests
        orchestrator = self.agents["orchestrator"]
        
        # Invoke the agent
        response = orchestrator.invoke(
            prompt=user_message,
            session_id=session_id or f"session_{datetime.now().isoformat()}",
            enable_trace=True
        )
        
        return {
            "response": response.get("output", ""),
            "trace": response.get("trace", {}),
            "session_id": response.get("session_id", session_id)
        }
        
    async def process_request_streaming(self, user_message: str, session_id: str = None):
        """
        Process a user request with streaming response.
        
        Yields chunks of the response as they become available.
        """
        if not self.initialized:
            await self.initialize()
            
        orchestrator = self.agents["orchestrator"]
        
        # Invoke with streaming
        async for chunk in orchestrator.invoke_stream(
            prompt=user_message,
            session_id=session_id or f"session_{datetime.now().isoformat()}",
            enable_trace=True
        ):
            yield chunk


# Global MCP client instance (will be initialized on first use)
global_mcp_client = None


async def main():
    """Test the Jamf agent system"""
    
    # Initialize the system
    agent_system = JamfAgentSystem()
    await agent_system.initialize()
    
    # Test queries
    test_queries = [
        "Find all Macs that haven't checked in for 30 days",
        "Show me devices with less than 20GB storage",
        "Update inventory for device with serial ABC123",
        "What's the status of device JAMF-001?"
    ]
    
    for query in test_queries:
        print(f"\n💬 User: {query}")
        response = await agent_system.process_request(query)
        print(f"🤖 Agent: {response['response']}")
        
    # Test streaming
    print("\n\n📡 Testing streaming response:")
    query = "Give me a detailed report of all Mac devices"
    print(f"💬 User: {query}")
    print("🤖 Agent: ", end="", flush=True)
    
    async for chunk in agent_system.process_request_streaming(query):
        if chunk.get("type") == "content":
            print(chunk.get("text", ""), end="", flush=True)
    print()


if __name__ == "__main__":
    asyncio.run(main())