import re
import unicodedata


def slugify(value, max_length=120):
    text = unicodedata.normalize('NFKD', '' if value is None else str(value))
    text = ''.join(character for character in text if not unicodedata.combining(character))
    text = text.lower().strip()
    text = re.sub(r"[\'\"`]", '', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = re.sub(r'^-+|-+$', '', text)
    text = re.sub(r'-{2,}', '-', text)
    return text[:max_length]
