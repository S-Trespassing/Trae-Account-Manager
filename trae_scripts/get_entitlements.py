import requests
import json
import os

# Constants
API_BASE_SG = "https://api-sg-central.trae.ai"
API_BASE_US = "https://api-us-east.trae.ai"
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

def get_entitlements(token, api_base=API_BASE_SG):
    url = f"{api_base}/trae/api/v1/pay/user_current_entitlement_list"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.trae.ai",
        "Referer": "https://www.trae.ai/",
        "Authorization": f"Cloud-IDE-JWT {token}"
    }

    data = {"require_usage": True}

    print(f"[*] Requesting Entitlements from {api_base}...")
    try:
        resp = requests.post(url, headers=headers, json=data)
        
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"[!] Request to {api_base} failed: {resp.status_code}")
    except Exception as e:
        print(f"[!] Exception querying {api_base}: {e}")
        
    return None

def get_entitlements_with_retry(token):
    # Try SG first
    result = get_entitlements(token, API_BASE_SG)
    if result:
        return result
        
    # Fallback to US
    print("[*] Retrying with US endpoint...")
    return get_entitlements(token, API_BASE_US)

if __name__ == "__main__":
    import sys
    
    token = None
    if len(sys.argv) > 1:
        token = sys.argv[1]
    else:
        token = load_token()
        
    if not token:
        print("Error: No token provided and token.json not found or invalid.")
        exit(1)
        
    result = get_entitlements_with_retry(token)
    if result:
        print(json.dumps(result, indent=2))
