import requests
import urllib.parse
import os  # 시스템 명령어를 사용하기 위해 추가

def generate_and_play_tts(text, filename="result.mp3", play=True):
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
        print(f"요청 중: {text}")
        response = requests.get(url, headers=headers, stream=True)
        response.raise_for_status()

        # 3. 바이너리 데이터 파일 저장
        with open(filename, "wb") as f:
            f.write(response.content)
        
        print(f"[SUCCESS] '{filename}' created.")

        # 4. 자동 재생 (Windows 환경)
        if play:
            print("[PLAY] Playing audio...")
            os.startfile(filename)
        else:
            print("[DONE] Audio generated (Server Mode - No Playback)")

    except Exception as e:
        print(f"[ERROR] : {e}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 2:
        # Node.js에서 호출 시: python tts_test.py "텍스트" "경로/파일명.mp3"
        text = sys.argv[1]
        filename = sys.argv[2]
        generate_and_play_tts(text, filename, play=False)
    else:
        # 직접 실행 시 테스트
        user_input = input("입력할 텍스트: ")
        if not user_input:
            user_input = "자동 재생 테스트 중입니다. 목소리가 잘 들리시나요?"
        
        generate_and_play_tts(user_input, "result.mp3", play=True)