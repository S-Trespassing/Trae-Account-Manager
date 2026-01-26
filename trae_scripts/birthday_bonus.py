import requests
import json

# Constants
API_BASE_SG = "https://api-sg-central.trae.ai"

def query_bonus(token):
    url = f"{API_BASE_SG}/trae/api/v1/pay/query_birthday_bonus"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.trae.ai",
        "Referer": "https://www.trae.ai/",
        "Authorization": f"Cloud-IDE-JWT {token}"
    }

    print(f"[*] Querying birthday bonus status...")
    resp = requests.post(url, headers=headers)
    
    if resp.status_code != 200:
        print(f"[!] Query failed: {resp.status_code}")
        return None

    return resp.json()

def claim_bonus(token):
    url = f"{API_BASE_SG}/trae/api/v1/pay/claim_birthday_bonus"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.trae.ai",
        "Referer": "https://www.trae.ai/",
        "Authorization": f"Cloud-IDE-JWT {token}"
    }

    print(f"[*] Claiming birthday bonus...")
    resp = requests.post(url, headers=headers)
    
    if resp.status_code != 200:
        print(f"[!] Claim failed: {resp.status_code}")
        return False

    return True

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python birthday_bonus.py <token> [claim]")
    else:
        token = sys.argv[1]
        should_claim = len(sys.argv) > 2 and sys.argv[2] == "claim"
        
        status = query_bonus(token)
        if status:
            print(f"Status: {json.dumps(status, indent=2)}")
            
            claimed = status.get("bonus_claimed", False)
            if not claimed and should_claim:
                if claim_bonus(token):
                    print("[+] Successfully claimed bonus!")
                else:
                    print("[-] Failed to claim bonus.")
            elif claimed:
                print("[-] Bonus already claimed.")
