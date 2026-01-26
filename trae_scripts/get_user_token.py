import requests
import json
import os

# Constants
API_BASE_SG = "https://api-sg-central.trae.ai"
COOKIE_FILE = "cookie.json"

def load_cookies(file_path=COOKIE_FILE):
    """Load cookies from a JSON file and return as a string header."""
    if not os.path.exists(file_path):
        return None
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Convert dictionary to cookie string
        cookie_parts = []
        for key, value in data.items():
            cookie_parts.append(f"{key}={value}")
        return "; ".join(cookie_parts)
    except Exception as e:
        print(f"[!] Error loading cookies: {e}")
        return None

def get_user_token(cookies):
    url = f"{API_BASE_SG}/cloudide/api/v3/common/GetUserToken"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.trae.ai",
        "Referer": "https://www.trae.ai/",
        "Cookie": cookies
    }

    print(f"[*] Requesting User Token...")
    resp = requests.post(url, headers=headers)
    
    if resp.status_code != 200:
        print(f"[!] Request failed: {resp.status_code}")
        return None

    return resp.json().get("Result")

if __name__ == "__main__":
    import sys
    
    cookies = None
    if len(sys.argv) > 1:
        cookies = sys.argv[1]
    else:
        cookies = load_cookies()
        
    if not cookies:
        print("Error: No cookies provided and cookie.json not found or invalid.")
        exit(1)
        
    result = get_user_token(cookies)
    if result:
        print(json.dumps(result, indent=2))
