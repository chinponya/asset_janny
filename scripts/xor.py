import sys
from pathlib import Path

XOR_KEY = 73

def decode_file(file_path):
    data = file_path.read_bytes()

    with file_path.open("wb") as out_fh:
        for byte in data:
            out_fh.write(bytes((byte ^ XOR_KEY,)))

path = Path(sys.argv[-1])

if path.is_file():
    print(f"converting {path}")
    decode_file(path)