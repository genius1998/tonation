import requests
import urllib.parse
import os  # 시스템 명령어를 사용하기 위해 추가

def generate_and_play_tts(text, filename="result.mp3"):
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
        
        print(f"✅ 성공! '{filename}' 파일이 생성되었습니다.")

        # 4. 자동 재생 (Windows 환경)
        print("🎵 음성을 재생합니다...")
        # os.startfile은 윈도우에서 해당 파일을 기본 프로그램으로 실행합니다.
        os.startfile(filename)

    except Exception as e:
        print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    user_input = "안녕하세요."
    if not user_input:
        user_input = "자동 재생 테스트 중입니다. 목소리가 잘 들리시나요?"
        
    generate_and_play_tts(user_input, "result.mp3")