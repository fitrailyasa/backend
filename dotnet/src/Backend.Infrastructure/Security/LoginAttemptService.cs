using System.Collections.Concurrent;
using Backend.Application.Abstractions;

namespace Backend.Infrastructure.Security;

public sealed class LoginRateLimitOptions
{
    public const string SectionName = "LoginRateLimit";

    public int MaxAttempts { get; set; } = 3;
    public int WindowSeconds { get; set; } = 900;
    public int IpMaxAttempts { get; set; } = 10;
    public int IpWindowSeconds { get; set; } = 900;
}

// Sliding-window counter for failed logins, keyed on the normalized email and the client IP.
// In-process only: counters are per process and disappear on restart.
public sealed class LoginAttemptService : ILoginAttemptService
{
    private const string IpKeyPrefix = "ip:";
    private const string EmailKeyPrefix = "email:";
    private const int SweepThreshold = 5000;

    private readonly ConcurrentDictionary<string, FailureWindow> _windows = new(StringComparer.Ordinal);
    private readonly LoginRateLimitOptions _options;

    public LoginAttemptService(LoginRateLimitOptions options)
    {
        _options = options;
    }

    public int RetryAfter(string email, string clientIp)
    {
        var now = Now();
        var retry = Math.Max(
            RetryFor(EmailKeyPrefix + Normalize(email), _options.MaxAttempts, _options.WindowSeconds, now),
            RetryFor(IpKeyPrefix + Normalize(clientIp), _options.IpMaxAttempts, _options.IpWindowSeconds, now));
        Sweep(now);
        return retry;
    }

    public void RecordFailure(string email, string clientIp)
    {
        var now = Now();
        Record(EmailKeyPrefix + Normalize(email), now, _options.WindowSeconds);
        Record(IpKeyPrefix + Normalize(clientIp), now, _options.IpWindowSeconds);
        Sweep(now);
    }

    public void Reset(string email)
    {
        _windows.TryRemove(EmailKeyPrefix + Normalize(email), out _);
    }

    public void Reset() => _windows.Clear();

    private int RetryFor(string key, int maxAttempts, int windowSeconds, long now)
    {
        if (maxAttempts <= 0 || !_windows.TryGetValue(key, out var window))
        {
            return 0;
        }

        var retry = window.RetryAfter(now, windowSeconds, maxAttempts);
        if (retry == 0 && window.IsEmpty)
        {
            _windows.TryRemove(new KeyValuePair<string, FailureWindow>(key, window));
        }

        return retry;
    }

    private void Record(string key, long now, int windowSeconds)
    {
        var window = _windows.GetOrAdd(key, _ => new FailureWindow());
        window.Add(now, windowSeconds);
        if (window.IsEmpty)
        {
            _windows.TryRemove(new KeyValuePair<string, FailureWindow>(key, window));
        }
    }

    private void Sweep(long now)
    {
        if (_windows.Count <= SweepThreshold)
        {
            return;
        }

        var horizon = Math.Max(_options.WindowSeconds, _options.IpWindowSeconds);
        foreach (var pair in _windows)
        {
            if (pair.Value.IsExpired(now, horizon))
            {
                _windows.TryRemove(pair);
            }
        }
    }

    private static long Now() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    private static string Normalize(string? value) => (value ?? string.Empty).Trim().ToLowerInvariant();

    private sealed class FailureWindow
    {
        private readonly object _gate = new();
        private readonly List<long> _stamps = new();

        public bool IsEmpty
        {
            get
            {
                lock (_gate)
                {
                    return _stamps.Count == 0;
                }
            }
        }

        public void Add(long now, int windowSeconds)
        {
            lock (_gate)
            {
                Prune(now, windowSeconds);
                _stamps.Add(now);
            }
        }

        public int RetryAfter(long now, int windowSeconds, int maxAttempts)
        {
            lock (_gate)
            {
                Prune(now, windowSeconds);
                if (_stamps.Count < maxAttempts)
                {
                    return 0;
                }

                // Seconds until the oldest failure in the window expires, always >= 1 while locked.
                var remainingMs = _stamps.Min() + (windowSeconds * 1000L) - now;
                return (int)Math.Max(1, (long)Math.Ceiling(remainingMs / 1000d));
            }
        }

        public bool IsExpired(long now, int windowSeconds)
        {
            lock (_gate)
            {
                Prune(now, windowSeconds);
                return _stamps.Count == 0;
            }
        }

        private void Prune(long now, int windowSeconds)
        {
            var cutoff = now - (windowSeconds * 1000L);
            _stamps.RemoveAll(stamp => stamp <= cutoff);
        }
    }
}
