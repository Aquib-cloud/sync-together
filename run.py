import subprocess
import os
import socket

# Optional local development helper script. Not required for production deployment.

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# get local LAN IP

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "0.0.0.0"

# build client once

def build_client():
    print("➡️ Building client...")

    result = subprocess.run(
        "cd client && npm run build",
        shell=True,
        cwd=BASE_DIR
    )

    if result.returncode != 0:
        print("❌ Client build failed")
        exit(1)

# watch client changes and rebuild automatically

def watch_client():
    print("➡️ Watching client files for changes...")

    return subprocess.Popen(
        "cd client && npm run build -- --watch",
        shell=True,
        cwd=BASE_DIR
    )

# start server with nodemon

def start_server():
    print("➡️ Starting Node server with auto-restart...")

    return subprocess.Popen(
        "cd server && npx nodemon server.js",
        shell=True,
        cwd=BASE_DIR
    )

# show LAN URL

def print_url():
    PORT = os.environ.get("PORT", "3000")
    ip = get_local_ip()

    print("\n✅ App accessible on:")
    print(f"🌐 http://{ip}:{PORT}/\n")


if __name__ == "__main__":

    print_url()

    build_client()

    client_watch = watch_client()
    server_process = start_server()

    try:
        client_watch.wait()
        server_process.wait()

    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
        client_watch.terminate()
        server_process.terminate()
