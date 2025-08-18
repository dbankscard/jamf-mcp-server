"""
Test script to verify MCP server connection for the Jamf InlineAgent

This helps validate that the agent can connect to and use the MCP server tools.
"""

import asyncio
import os
import json
from datetime import datetime
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import httpx


async def test_stdio_connection():
    """Test connection to MCP server via stdio (local development)"""
    print("🔌 Testing STDIO connection to MCP server...")
    
    # Get the MCP server directory (parent of jamf-bedrock-agent)
    mcp_server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    server_params = StdioServerParameters(
        command="npm",
        args=["run", "serve"],
        cwd=mcp_server_dir,
        env={
            "JAMF_URL": os.environ.get("JAMF_URL", ""),
            "JAMF_CLIENT_ID": os.environ.get("JAMF_CLIENT_ID", ""),
            "JAMF_CLIENT_SECRET": os.environ.get("JAMF_CLIENT_SECRET", ""),
        }
    )
    
    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                # Initialize the session
                await session.initialize()
                print("✅ Connected to MCP server")
                
                # List available tools
                print("\n📋 Available tools:")
                tools_response = await session.list_tools()
                for tool in tools_response.tools:
                    print(f"  - {tool.name}: {tool.description}")
                
                # List available resources
                print("\n📊 Available resources:")
                resources_response = await session.list_resources()
                for resource in resources_response.resources:
                    print(f"  - {resource.name}: {resource.description}")
                
                # Test a simple tool call
                print("\n🧪 Testing searchDevices tool...")
                result = await session.call_tool("searchDevices", {
                    "query": "test",
                    "limit": 5
                })
                
                if result.content:
                    response_data = json.loads(result.content[0].text)
                    print(f"✅ Tool call successful. Found {response_data.get('count', 0)} devices")
                else:
                    print("❌ No response from tool")
                    
                return True
                
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False


async def test_http_connection():
    """Test connection to MCP server via HTTP (production)"""
    print("\n🔌 Testing HTTP connection to MCP server...")
    
    mcp_url = os.environ.get("MCP_SERVER_URL", "http://localhost:3000")
    
    try:
        async with httpx.AsyncClient() as client:
            # Test health endpoint (if available)
            response = await client.get(f"{mcp_url}/health")
            if response.status_code == 200:
                print(f"✅ MCP server is healthy at {mcp_url}")
                return True
            else:
                print(f"❌ MCP server returned status {response.status_code}")
                return False
    except Exception as e:
        print(f"❌ HTTP connection failed: {e}")
        print("   This is expected if MCP doesn't support HTTP yet")
        return False


async def test_agent_tool_wrapper():
    """Test the tool wrapper functions that InlineAgent will use"""
    print("\n🧪 Testing agent tool wrapper functions...")
    
    # Import the tool functions
    from agent.jamf_inline_agent import search_devices, get_device_details
    
    # Note: These will fail without a proper MCP connection
    # This just tests that the functions are importable and have correct signatures
    print("✅ Tool functions imported successfully")
    print(f"  - search_devices: {search_devices.__doc__.strip()}")
    print(f"  - get_device_details: {get_device_details.__doc__.strip()}")
    
    return True


async def main():
    """Run all connection tests"""
    print("🚀 Jamf MCP Connection Test")
    print("=" * 50)
    
    # Check environment
    print("\n🔍 Environment check:")
    env_vars = ["JAMF_URL", "JAMF_CLIENT_ID", "JAMF_CLIENT_SECRET", "MCP_SERVER_URL"]
    for var in env_vars:
        value = os.environ.get(var, "NOT SET")
        if var in ["JAMF_CLIENT_SECRET"]:
            value = "***" if value != "NOT SET" else value
        print(f"  {var}: {value}")
    
    # Load .env if it exists
    env_file = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_file):
        print("\n📄 Loading .env file...")
        from dotenv import load_dotenv
        load_dotenv(env_file)
    
    # Run tests
    tests_passed = 0
    total_tests = 0
    
    # Test STDIO connection
    total_tests += 1
    if await test_stdio_connection():
        tests_passed += 1
    
    # Test HTTP connection (optional)
    total_tests += 1
    if await test_http_connection():
        tests_passed += 1
    
    # Test tool wrappers
    total_tests += 1
    if await test_agent_tool_wrapper():
        tests_passed += 1
    
    # Summary
    print("\n" + "=" * 50)
    print(f"📊 Test Summary: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        print("✅ All tests passed! MCP connection is working.")
    elif tests_passed > 0:
        print("⚠️  Some tests failed. Check the errors above.")
    else:
        print("❌ All tests failed. Please check your configuration.")


if __name__ == "__main__":
    asyncio.run(main())