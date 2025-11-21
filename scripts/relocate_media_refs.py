from pathlib import Path
root = Path(__file__).resolve().parents[0].parent
replacements = {
    'assets/media/griga-logo-animated.gif': 'assets/media/logos/griga-logo-animated.gif',
    'assets/media/griga-logo.jpg': 'assets/media/logos/griga-logo.jpg',
    'assets/media/murima-night-flyer.jpg': 'assets/media/images/murima-night-flyer.jpg',
    'https://grigaeventsfze.com/assets/media/griga-logo-animated.gif': 'https://grigaeventsfze.com/assets/media/logos/griga-logo-animated.gif',
    'https://grigaeventsfze.com/assets/media/griga-logo.jpg': 'https://grigaeventsfze.com/assets/media/logos/griga-logo.jpg',
    'https://grigaeventsfze.com/assets/media/murima-night-flyer.jpg': 'https://grigaeventsfze.com/assets/media/images/murima-night-flyer.jpg'
}
for path in root.rglob('*'):
    if path.is_file() and path.suffix in {'.html', '.md', '.js', '.css'}:
        text = path.read_text(encoding='utf-8')
        new_text = text
        for old, new_val in replacements.items():
            new_text = new_text.replace(old, new_val)
        if new_text != text:
            path.write_text(new_text, encoding='utf-8')
