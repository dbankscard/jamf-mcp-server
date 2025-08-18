"""
AWS Lambda handler for Slack integration with Jamf InlineAgent

This handler:
1. Receives Slack events via API Gateway
2. Processes requests using the Jamf InlineAgent system
3. Returns responses to Slack in real-time
4. Supports slash commands and interactive components
"""

import os
import json
import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import hashlib
import hmac
import time
from urllib.parse import parse_qs

import boto3
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

# Import our Jamf agent system
import sys
sys.path.append('/opt/python')  # Lambda layer path
from agent.jamf_inline_agent import JamfAgentSystem

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize clients
slack_client = WebClient(token=os.environ.get("SLACK_BOT_TOKEN"))
dynamodb = boto3.resource('dynamodb')
sessions_table = dynamodb.Table(os.environ.get('SESSIONS_TABLE_NAME', 'jamf-agent-sessions'))

# Initialize agent system (singleton)
agent_system = JamfAgentSystem()

# Slack signing secret for verification
SLACK_SIGNING_SECRET = os.environ.get("SLACK_SIGNING_SECRET", "")


def verify_slack_request(event: Dict[str, Any]) -> bool:
    """
    Verify that the request actually came from Slack.
    
    Args:
        event: Lambda event containing headers and body
        
    Returns:
        True if request is valid, False otherwise
    """
    timestamp = event['headers'].get('x-slack-request-timestamp', '')
    signature = event['headers'].get('x-slack-signature', '')
    
    # Check timestamp to prevent replay attacks
    if abs(time.time() - int(timestamp)) > 60 * 5:
        logger.warning("Request timestamp too old")
        return False
    
    # Verify signature
    sig_basestring = f"v0:{timestamp}:{event['body']}"
    my_signature = 'v0=' + hmac.new(
        SLACK_SIGNING_SECRET.encode(),
        sig_basestring.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(my_signature, signature)


def parse_slack_body(body: str) -> Dict[str, Any]:
    """Parse URL-encoded Slack request body"""
    parsed = parse_qs(body)
    # Convert single-item lists to strings
    return {k: v[0] if len(v) == 1 else v for k, v in parsed.items()}


async def get_or_create_session(user_id: str, channel_id: str) -> str:
    """
    Get or create a session for conversation continuity.
    
    Args:
        user_id: Slack user ID
        channel_id: Slack channel ID
        
    Returns:
        Session ID
    """
    session_id = f"{user_id}_{channel_id}"
    
    try:
        # Try to get existing session
        response = sessions_table.get_item(Key={'session_id': session_id})
        
        if 'Item' in response:
            # Update last accessed time
            sessions_table.update_item(
                Key={'session_id': session_id},
                UpdateExpression='SET last_accessed = :time',
                ExpressionAttributeValues={':time': datetime.utcnow().isoformat()}
            )
            return session_id
        else:
            # Create new session
            sessions_table.put_item(
                Item={
                    'session_id': session_id,
                    'user_id': user_id,
                    'channel_id': channel_id,
                    'created_at': datetime.utcnow().isoformat(),
                    'last_accessed': datetime.utcnow().isoformat(),
                }
            )
            return session_id
    except Exception as e:
        logger.error(f"Session management error: {e}")
        # Return a default session ID if DB operations fail
        return session_id


async def process_slash_command(command_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a Slack slash command.
    
    Args:
        command_data: Parsed slash command data
        
    Returns:
        Response for Slack
    """
    user_id = command_data.get('user_id', '')
    channel_id = command_data.get('channel_id', '')
    command = command_data.get('command', '')
    text = command_data.get('text', '').strip()
    
    # Get or create session
    session_id = await get_or_create_session(user_id, channel_id)
    
    # Handle different commands
    if command == '/jamf':
        if not text:
            return {
                'response_type': 'ephemeral',
                'text': (
                    "👋 Hi! I'm your Jamf assistant. Here's how to use me:\n\n"
                    "• `/jamf find devices in conference room` - Search for devices\n"
                    "• `/jamf show device ABC123` - Get device details\n"
                    "• `/jamf update inventory for device 42` - Force inventory update\n"
                    "• `/jamf help` - Show this help message\n\n"
                    "I can help you manage Apple devices through natural language!"
                )
            }
        
        if text.lower() == 'help':
            return {
                'response_type': 'ephemeral',
                'text': (
                    "🔧 *Jamf Assistant Commands*\n\n"
                    "*Device Search:*\n"
                    "• Find devices by name, serial, user, or location\n"
                    "• Example: `/jamf find MacBooks in engineering`\n\n"
                    "*Device Details:*\n"
                    "• Get detailed information about a device\n"
                    "• Example: `/jamf show details for serial ABC123`\n\n"
                    "*Device Management:*\n"
                    "• Update inventory: `/jamf update inventory for device 42`\n"
                    "• Execute policies: `/jamf run policy \"Update Software\" on device 42`\n\n"
                    "*Reports:*\n"
                    "• Storage: `/jamf show devices with low storage`\n"
                    "• Compliance: `/jamf check compliance status`\n"
                    "• OS versions: `/jamf show OS version distribution`"
                )
            }
        
        # Process the request with the agent
        try:
            # Send immediate acknowledgment
            slack_client.chat_postMessage(
                channel=channel_id,
                text=f"🤔 Processing: _{text}_"
            )
            
            # Process with agent
            response = await agent_system.process_request(text, session_id)
            
            # Format the response for Slack
            return {
                'response_type': 'in_channel',
                'text': response['response'],
                'blocks': format_response_blocks(response)
            }
            
        except Exception as e:
            logger.error(f"Error processing command: {e}")
            return {
                'response_type': 'ephemeral',
                'text': f'❌ Error processing request: {str(e)}'
            }
    
    return {
        'response_type': 'ephemeral',
        'text': 'Unknown command'
    }


async def process_event(event_data: Dict[str, Any]) -> None:
    """
    Process Slack events (app mentions, DMs, etc.)
    
    Args:
        event_data: Slack event data
    """
    event = event_data.get('event', {})
    event_type = event.get('type', '')
    
    if event_type == 'app_mention':
        # Handle @mentions
        user_id = event.get('user', '')
        channel_id = event.get('channel', '')
        text = event.get('text', '')
        
        # Remove the bot mention from the text
        bot_user_id = event_data.get('authorizations', [{}])[0].get('user_id', '')
        text = text.replace(f'<@{bot_user_id}>', '').strip()
        
        if text:
            session_id = await get_or_create_session(user_id, channel_id)
            
            try:
                # Send typing indicator
                slack_client.chat_postMessage(
                    channel=channel_id,
                    text="🤔 Thinking..."
                )
                
                # Process with agent
                response = await agent_system.process_request(text, session_id)
                
                # Send response
                slack_client.chat_postMessage(
                    channel=channel_id,
                    text=response['response'],
                    blocks=format_response_blocks(response)
                )
            except Exception as e:
                logger.error(f"Error processing event: {e}")
                slack_client.chat_postMessage(
                    channel=channel_id,
                    text=f"❌ Sorry, I encountered an error: {str(e)}"
                )
    
    elif event_type == 'message' and event.get('channel_type') == 'im':
        # Handle direct messages
        if 'bot_id' not in event:  # Ignore bot messages
            user_id = event.get('user', '')
            channel_id = event.get('channel', '')
            text = event.get('text', '')
            
            if text:
                session_id = await get_or_create_session(user_id, channel_id)
                
                try:
                    # Process with agent using streaming for DMs
                    message_ts = None
                    chunks = []
                    
                    async for chunk in agent_system.process_request_streaming(text, session_id):
                        if chunk.get('type') == 'content':
                            chunks.append(chunk.get('text', ''))
                            
                            # Update message every few chunks
                            if len(chunks) % 5 == 0:
                                full_text = ''.join(chunks)
                                if message_ts:
                                    slack_client.chat_update(
                                        channel=channel_id,
                                        ts=message_ts,
                                        text=full_text
                                    )
                                else:
                                    result = slack_client.chat_postMessage(
                                        channel=channel_id,
                                        text=full_text
                                    )
                                    message_ts = result['ts']
                    
                    # Final update
                    if chunks:
                        full_text = ''.join(chunks)
                        if message_ts:
                            slack_client.chat_update(
                                channel=channel_id,
                                ts=message_ts,
                                text=full_text
                            )
                        else:
                            slack_client.chat_postMessage(
                                channel=channel_id,
                                text=full_text
                            )
                        
                except Exception as e:
                    logger.error(f"Error processing DM: {e}")
                    slack_client.chat_postMessage(
                        channel=channel_id,
                        text=f"❌ Sorry, I encountered an error: {str(e)}"
                    )


def format_response_blocks(response: Dict[str, Any]) -> list:
    """
    Format agent response into Slack blocks for rich formatting.
    
    Args:
        response: Agent response dictionary
        
    Returns:
        List of Slack blocks
    """
    blocks = []
    
    # Main response text
    blocks.append({
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": response['response']
        }
    })
    
    # Add trace information if available (for debugging)
    if response.get('trace') and response['trace'].get('agentActions'):
        tools_used = []
        for action in response['trace']['agentActions']:
            tool_name = action.get('actionName', 'Unknown')
            tools_used.append(f"• {tool_name}")
        
        if tools_used:
            blocks.append({
                "type": "context",
                "elements": [{
                    "type": "mrkdwn",
                    "text": f"_Tools used: {', '.join(tools_used)}_"
                }]
            })
    
    return blocks


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for Slack events.
    
    Args:
        event: Lambda event from API Gateway
        context: Lambda context
        
    Returns:
        Response for API Gateway
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Verify the request is from Slack
    if not verify_slack_request(event):
        return {
            'statusCode': 401,
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    # Parse the body
    body = event.get('body', '')
    content_type = event['headers'].get('content-type', '')
    
    if 'application/json' in content_type:
        # JSON body (Events API)
        body_data = json.loads(body)
        
        # Handle URL verification
        if body_data.get('type') == 'url_verification':
            return {
                'statusCode': 200,
                'body': json.dumps({'challenge': body_data['challenge']})
            }
        
        # Handle events asynchronously
        if body_data.get('type') == 'event_callback':
            # Process in background to return quickly
            asyncio.create_task(process_event(body_data))
            return {
                'statusCode': 200,
                'body': json.dumps({'status': 'ok'})
            }
    
    elif 'application/x-www-form-urlencoded' in content_type:
        # URL-encoded body (slash commands)
        command_data = parse_slack_body(body)
        
        # Process slash command
        loop = asyncio.get_event_loop()
        response = loop.run_until_complete(process_slash_command(command_data))
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(response)
        }
    
    # Unknown request type
    return {
        'statusCode': 400,
        'body': json.dumps({'error': 'Bad request'})
    }


# For async Lambda runtime
def async_lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Async wrapper for Lambda handler"""
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(lambda_handler(event, context))