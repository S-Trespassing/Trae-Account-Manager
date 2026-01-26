import requests
import json

# Constants
API_BASE_SG = "https://api-sg-central.trae.ai"

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
    # You can pass cookies as a string argument
    # Example: "sessionid=...; csrf=..."
    if len(sys.argv) < 2:
        print("Usage: python get_user_token.py <cookies_string>")
    else:
        cookies = sys.argv[1]
        result = get_user_token(cookies)
        if result:
            print(json.dumps(result, indent=2))
