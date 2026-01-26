import requests
import json
import time

# Constants
API_BASE_SG = "https://api-sg-central.trae.ai"

def query_usage(token, start_time, end_time, page_size=20, page_num=1):
    url = f"{API_BASE_SG}/trae/api/v1/pay/query_user_usage_group_by_session"
    
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
        "page_size": page_size,
        "page_num": page_num
    }

    print(f"[*] Querying usage records...")
    resp = requests.post(url, headers=headers, json=data)
    
    if resp.status_code != 200:
        print(f"[!] Request failed: {resp.status_code}")
        return None

    return resp.json()

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python query_usage.py <token> [days_ago]")
    else:
        token = sys.argv[1]
        days = int(sys.argv[2]) if len(sys.argv) > 2 else 7
        
        end_time = int(time.time())
        start_time = end_time - (days * 86400)
        
        result = query_usage(token, start_time, end_time)
        if result:
            print(json.dumps(result, indent=2))
