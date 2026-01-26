import requests
import json
import time
import os

# Constants
API_BASE_SG = "https://api-sg-central.trae.ai"
TOKEN_FILE = "token.json"

def load_token(file_path=TOKEN_FILE):
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("Token")
    except:
        return None

def query_usage_events(token, start_time, end_time, page_num=1, page_size=20):
    url = f"{API_BASE_SG}/trae/api/v1/pay/list_usage_events"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.trae.ai",
        "Referer": "https://www.trae.ai/",
        "Authorization": f"Cloud-IDE-JWT {token}"
    }

    data = {
        "start_time": start_time,
        "end_time": end_time,
        "page_num": page_num,
        "page_size": page_size
    }

    print(f"[*] Querying Usage Events (Page {page_num})...")
    resp = requests.post(url, headers=headers, json=data)
    
    if resp.status_code != 200:
        print(f"[!] Request failed: {resp.status_code}")
        return None

    return resp.json()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Query Trae Usage Events")
    parser.add_argument("--token", help="JWT Token")
    parser.add_argument("--days", type=int, default=30, help="Number of days to look back")
    
    args = parser.parse_args()
    
    token = args.token or load_token()
    
    if not token:
        print("Error: No token provided and token.json not found or invalid.")
        exit(1)
        
    end_time = int(time.time())
    start_time = end_time - (args.days * 86400)
    
    result = query_usage_events(token, start_time, end_time)
    if result:
        print(json.dumps(result, indent=2))
