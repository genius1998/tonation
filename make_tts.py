import subprocess
from pathlib import Path

# ✅ 너 폴더에 맞게 경로만 수정해줘
PIPER_BIN = Path("./piper/piper.exe")        # 리눅스/맥이면 ./piper/piper
MODEL = Path("./models/ko.onnx")             # ko 모델 onnx
OUT_WAV = Path("./out.wav")

TEXT = "유니버스레이블님 80캐시 후원 감사합니다!"

def synthesize(text: str, out_wav: Path):
    if not PIPER_BIN.exists():
        raise FileNotFoundError(f"Piper 실행파일 없음: {PIPER_BIN.resolve()}")
    if not MODEL.exists():
        raise FileNotFoundError(f"모델 파일 없음: {MODEL.resolve()}")

    # piper는 stdin으로 텍스트를 받음
    cmd = [str(PIPER_BIN), "-m", str(MODEL), "-f", str(out_wav)]
    subprocess.run(cmd, input=text.encode("utf-8"), check=True)
    print("✅ saved:", out_wav.resolve())

if __name__ == "__main__":
    synthesize(TEXT, OUT_WAV)
