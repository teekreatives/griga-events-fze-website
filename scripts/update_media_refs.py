import pathlib

root = pathlib.Path(__file__).resolve().parents[0]
root = root.parent
suffixes = {'.html', '.md', '.js', '.css'}
for path in root.rglob('*'):
    if path.is_file() and path.suffix in suffixes:
        text = path.read_text(encoding='utf-8')
        if 'assets/img/' in text or 'https://grigaeventsfze.com/assets/img/' in text:
            text = text.replace('https://grigaeventsfze.com/assets/img/', 'https://grigaeventsfze.com/assets/media/')
            text = text.replace('assets/img/', 'assets/media/')
            path.write_text(text, encoding='utf-8')
