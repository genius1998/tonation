import argparse
import os
import requests
import urllib.parse

def generate_tts(text: str, output_path: str):
    # 1. URL 인코딩
    encoded_text = urllib.parse.quote(text)
    url = f"https://cache-a.oddcast.com/tts/genC.php?EID=3&LID=13&VID=2&TXT={encoded_text}&EXT=mp3&FNAME=&ACC=9066743&SceneID=2770702&HTTP_ERR="

    # 2. 요청 헤더
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        "Origin": "https://www.oddcast.com",
        "Referer": "https://www.oddcast.com/",
    }

    try:
        # 출력 디렉토리 생성
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # 요청
        print(f"Requesting TTS for: {text}")
        response = requests.get(url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()

        # 저장
        with open(output_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        print(f"SUCCESS: {output_path}")

    except Exception as e:
        print(f"ERROR: {e}")
        raise e

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    generate_tts(args.text, args.out)