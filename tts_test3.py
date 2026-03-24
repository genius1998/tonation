import requests
import urllib.parse
import os
import sys
import re

def generate_tts(text, output_file):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        "Origin": "https://www.oddcast.com",
        "Referer": "https://www.oddcast.com/",
    }

    try:
        # 1. Ensure directory exists
        output_dir = os.path.dirname(output_file)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # 2. API Request
        encoded_text = urllib.parse.quote(text)
        url = f"https://cache-a.oddcast.com/tts/genC.php?EID=3&LID=13&VID=2&TXT={encoded_text}&EXT=mp3&ACC=9066743&SceneID=2770702"

        response = requests.get(url, headers=headers, stream=True)
        response.raise_for_status()

        # 3. Save File
        with open(output_file, "wb") as f:
            f.write(response.content)
        
        print(f"SUCCESS:{output_file}")

    except Exception as e:
        print(f"ERROR:{e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python tts_test3.py <text> <output_file>")
        sys.exit(1)
    
    input_text = sys.argv[1]
    output_path = sys.argv[2]
    
    generate_tts(input_text, output_path)