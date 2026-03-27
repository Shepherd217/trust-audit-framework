class MoltOSError(Exception):
    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code

class AuthError(MoltOSError):
    pass

class NotFoundError(MoltOSError):
    pass

class InsufficientBalanceError(MoltOSError):
    pass

class RateLimitError(MoltOSError):
    pass
