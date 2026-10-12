from rest_framework.exceptions import APIException


class ApiError(APIException):
    status_code = 400

    def __init__(self, status_code, message, errors=None, headers=None):
        self.message = message
        self.errors = errors
        super().__init__(detail=message)
        self.status_code = status_code
        if headers:
            self.headers = headers

    @classmethod
    def bad_request(cls, message='Bad request'):
        return cls(400, message)

    @classmethod
    def unauthorized(cls, message='Unauthenticated'):
        return cls(401, message)

    @classmethod
    def forbidden(cls, message='This action is unauthorized'):
        return cls(403, message)

    @classmethod
    def not_found(cls, message='Resource not found'):
        return cls(404, message)

    @classmethod
    def conflict(cls, message='Resource already exists'):
        return cls(409, message)

    @classmethod
    def unprocessable(cls, message='Validation failed', errors=None):
        return cls(422, message, errors)

    @classmethod
    def too_many(cls, message='Too many requests, please try again later', headers=None):
        return cls(429, message, headers=headers)

    @classmethod
    def payload_too_large(cls, message='Request body too large'):
        return cls(413, message)
