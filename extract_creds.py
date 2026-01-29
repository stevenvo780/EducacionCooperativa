import os
import codecs

with open('.env.local', 'r') as f:
    for line in f:
        if 'FIREBASE_SERVICE_ACCOUNT' in line:
            # Find the first quote
            start = line.find('"')
            if start == -1: continue
            
            # The value might end with a quote followed by newline
            val = line[start+1:].strip()
            if val.endswith('"'):
                val = val[:-1]
            
            # The value contains literal \n like "line1\nline2"
            # We want to convert that to actual newlines for the file?
            # actually serviceAccountKey.json expects real newlines or valid JSON?
            # It expects a valid JSON file.
            # The string is "{\n  \"type\": ... }"
            # So if we resolve escapes, we get real JSON.
            
            try:
                # Just print the value directly. It should be valid JSON escape sequences.
                print(val)
            except Exception as e:
                print(f"Error: {e}")

