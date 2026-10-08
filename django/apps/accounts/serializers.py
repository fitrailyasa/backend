from apps.core.formatting import iso


def serialize_user(user):
    return {
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'role': user.role,
        'created_at': iso(user.created_at),
        'updated_at': iso(user.updated_at),
    }
