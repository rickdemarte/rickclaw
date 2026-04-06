#!/usr/bin/env python3
"""Send a Telegram message using the pre‑configured bot token.

Environment variables:
  TELEGRAM_BOT_TOKEN            – Bot token from @BotFather
  TELEGRAM_ALLOWED_USER_IDS     – Comma‑separated list of chat/user IDs allowed

CLI usage (called by the skill runtime):
  python3 send_message.py [--chat-id ID] "Message text"

If --chat-id is omitted the first ID from TELEGRAM_ALLOWED_USER_IDS is used.
"""
import os
import sys
import json
import urllib.parse
import urllib.request

def abort(msg: str, code: int = 1) -> None:
    sys.stderr.write(f"Error: {msg}\n")
    sys.exit(code)

def get_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        abort(f"Missing required environment variable {name}")
    return val

def parse_allowed_ids(raw: str):
    return [i.strip() for i in raw.split(',') if i.strip()]

def main() -> None:
    # Load env vars
    token = get_env('TELEGRAM_BOT_TOKEN')
    allowed_raw = get_env('TELEGRAM_ALLOWED_USER_IDS')
    allowed_ids = parse_allowed_ids(allowed_raw)
    if not allowed_ids:
        abort('TELEGRAM_ALLOWED_USER_IDS is empty')

    # Simple CLI parsing – we only support optional --chat-id
    args = sys.argv[1:]
    if not args:
        abort('No message provided')
    chat_id = None
    if args[0] == '--chat-id':
        if len(args) < 3:
            abort('Usage: --chat-id <id> "Message"')
        chat_id = args[1]
        message = ' '.join(args[2:])
    else:
        message = ' '.join(args)
        chat_id = allowed_ids[0]

    if chat_id not in allowed_ids:
        abort(f"Chat ID {chat_id} not in allowed list")

    # Build request
    url = f'https://api.telegram.org/bot{token}/sendMessage'
    payload = {
        'chat_id': chat_id,
        'text': message,
        'parse_mode': 'HTML'
    }
    data = urllib.parse.urlencode(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_data = resp.read().decode('utf-8')
            result = json.loads(resp_data)
    except Exception as e:
        abort(f'HTTP request failed: {e}')

    if result.get('ok'):
        print(json.dumps(result, indent=2))
    else:
        abort(f"Telegram API error: {result.get('description')}")

if __name__ == '__main__':
    main()
