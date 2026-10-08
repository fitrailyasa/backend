from datetime import timezone as dt_timezone
from decimal import Decimal

from django.utils import timezone


def iso(value):
    if value is None:
        return None
    if timezone.is_naive(value):
        value = timezone.make_aware(value, dt_timezone.utc)
    value = value.astimezone(dt_timezone.utc)
    return value.isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def money(value):
    if value is None:
        return None
    quantized = Decimal(str(value)).quantize(Decimal('0.01'))
    number = float(quantized)
    if number.is_integer():
        return int(number)
    return number
