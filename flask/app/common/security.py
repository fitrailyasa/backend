"""Password hashing."""

import bcrypt
from flask import current_app


def hash_password(plain):
    rounds = int(current_app.config["BCRYPT_ROUNDS"])
    hashed = bcrypt.hashpw(str(plain).encode("utf-8"), bcrypt.gensalt(rounds=rounds))
    return hashed.decode("utf-8")


def verify_password(plain, hashed):
    if not isinstance(hashed, str) or not hashed:
        return False
    if hashed.startswith("bcrypt$"):
        hashed = hashed[len("bcrypt$"):]
    try:
        return bcrypt.checkpw(str(plain).encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False
