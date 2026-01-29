import pty
import os
import sys
import time
import select

def ssh_command(host, user, password, command):
    pid, master_fd = pty.fork()
    if pid == 0:
        # Child process: run ssh
        # -tt forces tty allocation, necessary for sudo
        os.execvp('ssh', ['ssh', '-tt', '-o', 'StrictHostKeyChecking=no', f'{user}@{host}', command])
    else:
        # Parent process: handle password
        output = b""
        password_sent = False
        last_password_time = 0
        
        while True:
            r, w, e = select.select([master_fd], [], [], 10) # 10s timeout
            if master_fd in r:
                try:
                    data = os.read(master_fd, 1024)
                except OSError:
                    break # Child likely exited
                
                if not data:
                    break
                
                output += data
                # Check for password prompt
                if not password_sent and (b"password:" in data.lower() or b"passphrase" in data.lower()):
                    os.write(master_fd, (password + "\n").encode())
                    password_sent = True
                    last_password_time = time.time()
                
                # Also handle sudo re-prompting or secondary password requests
                if password_sent and (time.time() - last_password_time > 2):
                    if b"password" in data.lower() or b"[sudo]" in data.lower():
                         os.write(master_fd, (password + "\n").encode())
                         last_password_time = time.time()
            else:
                 # Timeout or no data
                 if not password_sent:
                     # Maybe connected without password or something else?
                     pass
                 else:
                     # Assuming command finished if no more output for a while? 
                     # Actually ssh might keep running.
                     # We should wait for EOF.
                     pass

        return output.decode('utf-8', errors='ignore')

# Run a simple check command
if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
    else:
        cmd = "ls -la"
        
    print(ssh_command('148.230.88.162', 'humanizar', 'zxcvFDSA90', cmd))
