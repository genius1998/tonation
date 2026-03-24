import sys
import os
import requests
import urllib.parse

# 인코딩 문제 방지를 위해 입출력 인코딩 강제 설정
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def run_safe_tts():
    try:
        # 인자 1: 텍스트가 담긴 파일 경로
        input_txt_path = sys.argv[1]
        # 인자 2: MP3를 저장할 경로
        output_mp3_path = sys.argv[2]

        # 1. 텍스트 파일 읽기 (UTF-8)
        with open(input_txt_path, 'r', encoding='utf-8') as f:
            text = f.read().strip()

        if not text:
            print("ERROR: Empty text")
            return

        # 2. Oddcast TTS 요청 (tts_test copy.py 로직)
        encoded_text = urllib.parse.quote(text)
        url = f"https://cache-a.oddcast.com/tts/genC.php?EID=3&LID=13&VID=2&TXT={encoded_text}&EXT=mp3&FNAME=&ACC=9066743&SceneID=2770702&HTTP_ERR="

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
            "Origin": "https://www.oddcast.com",
            "Referer": "https://www.oddcast.com/",
        }

        print(f"Requesting: {text}")
        response = requests.get(url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()

        # 3. 저장
        with open(output_mp3_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        # 성공 시 특정 메시지 출력
        print("SUCCESS")

    except Exception as e:
        print(f"FAIL: {e}")
        # 실패 시 에러 파일 남기기 (디버깅용)
        with open("tts_error_log.txt", "a", encoding="utf-8") as err_f:
            err_f.write(f"Error: {e}\n")

if __name__ == "__main__":
    run_safe_tts()
