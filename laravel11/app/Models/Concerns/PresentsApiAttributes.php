<?php

namespace App\Models\Concerns;

trait PresentsApiAttributes
{
    public function toRawObject(): object
    {
        $data = $this->getRawOriginal();
        foreach ($data as $key => $value) {
            if ($value instanceof \DateTimeInterface) {
                $data[$key] = $value->format('Y-m-d H:i:s');
            }
        }
        return (object) $data;
    }

    public function toApi(): array
    {
        $data = (array) $this->toRawObject();
        unset($data['password'], $data['remember_token'], $data['email_verified_at']);
        foreach (array_keys($data) as $key) {
            if (str_starts_with((string) $key, 'pivot_')) {
                unset($data[$key]);
            }
        }
        return $data;
    }
}
