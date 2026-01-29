import os
import re

found = False
with open('.env.local', 'r') as f:
    for line in f:
        if 'FIREBASE_SERVICE_ACCOUNT="' in line:
            start = line.find('="') + 2
            val = line[start:].strip()
            # Handle potential ending quote and newline literal
            if val.endswith('"') and not val.endswith('\\"'): 
                val = val[:-1]
            if val.endswith(r'\n'):
                val = val[:-2]
            
            # Heuristic fix for .env JSON format
            # Convert structural \n (followed by space or }) to real breaks
            # Keep data \n (inside private key) as literal \n
            # Regex: Literal \ followed by n, followed by capturing group (space or })
            fixed = re.sub(r'\\n(\s|\})', r'\n\1', val)
            
            print(fixed)
            found = True
            break
            
if not found:
    print("{}")
