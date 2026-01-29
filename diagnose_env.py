import os

with open('.env.local', 'r') as f:
    for line in f:
        if 'FIREBASE_SERVICE_ACCOUNT="' in line:
            start = line.find('="') + 2
            val = line[start:].strip()
            if val.endswith('"'): val = val[:-1]
            
            print(f"Start: {val[:20]}")
            print(f"Has \\n literals: {r'\n' in val}")
            print(f"Has \\\\n literals: {r'\\n' in val}")
            
            # Locate private key part
            pk_start = val.find("-----BEGIN")
            if pk_start != -1:
                chunk = val[pk_start:pk_start+40]
                print(f"PK Data: {chunk}")
