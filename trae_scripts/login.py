import requests
import json

# Constants
API_BASE_SG = "https://api-sg-central.trae.ai"
UG_BASE = "https://ug-normal.trae.ai"

def encode_xor_hex(input_str: str) -> str:
    """
    XOR encodes a string with 0x05 and returns hex representation.
    Used for email/password encoding in Trae login.
    """
    return "".join(f"{b ^ 0x05:02x}" for b in input_str.encode("utf-8"))

def login(email, password):
    session = requests.Session()
    
    # Common headers
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    session.headers.update(headers)

    print(f"[*] Step 1: Visiting login page to get initial cookies...")
    try:
        session.get("https://www.trae.ai/login")
    except Exception as e:
        print(f"[!] Warning: Initial page load failed: {e}")

    print(f"[*] Step 2: Performing email login...")
    login_url = f"{UG_BASE}/passport/web/email/login/"
    
    params = {
        "aid": "677332",
        "account_sdk_source": "web",
        "sdk_version": "2.1.10-tiktok",
        "language": "en",
    }

    data = {
        "mix_mode": "1",
        "fixed_mix_mode": "1",
        "email": encode_xor_hex(email),
        "password": encode_xor_hex(password),
    }

    # Headers for login request
    login_headers = {
        "Origin": "https://www.trae.ai",
        "Referer": "https://www.trae.ai/",
        "Content-Type": "application/x-www-form-urlencoded"
    }

    resp = session.post(login_url, params=params, data=data, headers=login_headers)
    
    if resp.status_code != 200:
        print(f"[!] Login failed with status code: {resp.status_code}")
        return None

    login_result = resp.json()
    if login_result.get("message") != "success":
        print(f"[!] Login failed: {login_result.get('description') or login_result.get('message')}")
        return None

    print("[+] Email login successful!")

    print(f"[*] Step 3: Performing Trae login...")
    trae_login_url = f"{UG_BASE}/cloudide/api/v3/trae/Login?type=email"
    
    trae_headers = {
        "Origin": "https://www.trae.ai",
        "Referer": "https://www.trae.ai/",
        "Content-Type": "application/json"
    }

    resp = session.post(trae_login_url, headers=trae_headers)
    if resp.status_code != 200:
        print(f"[!] Trae login failed: {resp.status_code}")
        return None
    
    print("[+] Trae login successful!")

    print(f"[*] Step 4: Getting User Token...")
    token_url = f"{API_BASE_SG}/cloudide/api/v3/common/GetUserToken"
    
    resp = session.post(token_url, headers=trae_headers)
    if resp.status_code != 200:
        print(f"[!] Get Token failed: {resp.status_code}")
        return None
    
    token_data = resp.json()
    result = token_data.get("Result", {})
    token = result.get("Token")
    
    # Extract cookies string
    cookies_dict = session.cookies.get_dict()
    cookies_str = "; ".join([f"{k}={v}" for k, v in cookies_dict.items()])
    
    # Ensure region cookie exists
    if "store-idc=" not in cookies_str and "trae-target-idc=" not in cookies_str:
        cookies_str += "; store-idc=alisg"

    print(f"[+] Token acquired: {token[:20]}...")
    
    return {
        "token": token,
        "user_id": result.get("UserID"),
        "tenant_id": result.get("TenantID"),
        "cookies": cookies_str,
        "expired_at": result.get("ExpiredAt")
    }

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python login.py <email> <password>")
    else:
        email = sys.argv[1]
        password = sys.argv[2]
        result = login(email, password)
        if result:
            print(json.dumps(result, indent=2))
            
            # Save to files
            print("[*] Saving to cookie.json and token.json...")
            
            # Save token
            with open("token.json", "w", encoding="utf-8") as f:
                json.dump({"Token": result["token"]}, f, indent=4)
                
            # Parse cookies string back to dict for JSON storage
            cookies_dict = {}
            for item in result["cookies"].split("; "):
                if "=" in item:
                    k, v = item.split("=", 1)
                    cookies_dict[k] = v
            
            with open("cookie.json", "w", encoding="utf-8") as f:
                json.dump(cookies_dict, f, indent=4)
                
            print("[+] Saved credentials to files.")
