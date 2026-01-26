import requests
import json

# Constants
UG_BASE = "https://ug-normal.trae.ai"

def get_user_info(cookies=None, token=None):
    url = f"{UG_BASE}/cloudide/api/v3/trae/GetUserInfo"
    
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

    data = {"IfWebPage": True}

    print(f"[*] Requesting User Info...")
    resp = requests.post(url, headers=headers, json=data)
    
    if resp.status_code != 200:
        print(f"[!] Request failed: {resp.status_code}")
        print(resp.text)
        return None

    return resp.json().get("Result")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Get Trae User Info")
    parser.add_argument("--cookies", help="Cookies string")
    parser.add_argument("--token", help="JWT Token")
    
    args = parser.parse_args()
    
    if not args.cookies and not args.token:
        print("Error: Must provide either --cookies or --token")
        exit(1)
        
    result = get_user_info(cookies=args.cookies, token=args.token)
    if result:
        print(json.dumps(result, indent=2))
