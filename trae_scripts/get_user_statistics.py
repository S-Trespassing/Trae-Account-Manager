import requests
import json
import os

# Constants
UG_BASE = "https://ug-normal.trae.ai"
COOKIE_FILE = "cookie.json"
TOKEN_FILE = "token.json"

def load_cookies(file_path=COOKIE_FILE):
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        cookie_parts = []
        for key, value in data.items():
            cookie_parts.append(f"{key}={value}")
        return "; ".join(cookie_parts)
    except:
        return None

def load_token(file_path=TOKEN_FILE):
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("Token")
    except:
        return None

def get_user_statistics(cookies=None, token=None):
    url = f"{UG_BASE}/cloudide/api/v3/trae/GetUserStasticData"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.trae.ai",
        "Referer": "https://www.trae.ai/",
    }

    if cookies:
        headers["Cookie"] = cookies
    
    if token:
        headers["Authorization"] = f"Cloud-IDE-JWT {token}"

    # Calculate time info
    import datetime
    import time
    
    now = datetime.datetime.now(datetime.timezone.utc)
    # Local timezone offset
    offset_seconds = -time.timezone if (time.localtime().tm_isdst == 0) else -time.altzone
    offset_hours = offset_seconds // 3600
    offset_minutes = offset_seconds // 60
    
    # Format: 2026-01-26T16:01:28.853Z
    local_time_iso = now.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

    data = {
        "LocalTime": local_time_iso,
        "Offset": offset_hours,
        "OffsetMinutes": offset_minutes
    }

    print(f"[*] Requesting User Statistics...")
    print(f"[*] Payload: {json.dumps(data)}")
    resp = requests.post(url, headers=headers, json=data)
    
    if resp.status_code != 200:
        print(f"[!] Request failed: {resp.status_code}")
        print(resp.text)
        return None

    return resp.json().get("Result")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Get Trae User Statistics")
    parser.add_argument("--cookies", help="Cookies string")
    parser.add_argument("--token", help="JWT Token")
    
    args = parser.parse_args()
    
    cookies = args.cookies or load_cookies()
    token = args.token or load_token()
    
    if not cookies and not token:
        print("Error: Must provide either --cookies or --token (or have valid cookie.json/token.json)")
        exit(1)
        
    result = get_user_statistics(cookies=cookies, token=token)
    if result:
        print(json.dumps(result, indent=2))
