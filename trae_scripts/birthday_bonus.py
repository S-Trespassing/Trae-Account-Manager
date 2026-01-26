import requests
import json
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

def claim_birthday_bonus(token):
    url = f"{API_BASE_SG}/trae/api/v1/pay/receive_birthday_gift"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.trae.ai",
        "Referer": "https://www.trae.ai/",
        "Authorization": f"Cloud-IDE-JWT {token}"
    }

    print(f"[*] Claiming Birthday Bonus...")
    resp = requests.post(url, headers=headers, json={})
    
    if resp.status_code != 200:
        print(f"[!] Request failed: {resp.status_code}")
        print(resp.text)
        return None

    return resp.json()

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
        
    result = claim_birthday_bonus(token)
    if result:
        print(json.dumps(result, indent=2))
