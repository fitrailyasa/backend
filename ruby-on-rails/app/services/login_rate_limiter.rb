# Sliding-window counter for failed login attempts (see _SECURITY_SPEC.md):
# 3 failures per normalized email and 10 per client IP per 15 minutes by
# default, counted only on failed credential checks. In-process memory is
# enough for a single Puma worker; swap the store if you run multiple
# machines. Call .reset! from test setup so suites stay deterministic.
class LoginRateLimiter
  STORE_LIMIT = 5000

  @failures = {}
  @mutex = Mutex.new

  class << self
    # Seconds (>= 1) until the caller may try again, or nil when not locked.
    def retry_after(email, ip)
      now = (Time.now.to_f * 1000).to_i
      worst = nil

      @mutex.synchronize do
        prune!(now)
        [
          [email_key(email), env_int("LOGIN_RATE_LIMIT_MAX", 3), env_int("LOGIN_RATE_LIMIT_WINDOW_MS", 900_000)],
          [ip_key(ip), env_int("LOGIN_IP_RATE_LIMIT_MAX", 10), env_int("LOGIN_IP_RATE_LIMIT_WINDOW_MS", 900_000)]
        ].each do |key, max, window_ms|
          next if max <= 0

          recent = recent_failures(key, now, window_ms)
          next if recent.size < max

          wait = ((recent.first + window_ms - now) / 1000.0).ceil
          worst = [worst || 0, wait].max
        end
      end

      worst && [worst, 1].max
    end

    def locked?(email, ip)
      !retry_after(email, ip).nil?
    end

    def record_failure!(email, ip)
      now = (Time.now.to_f * 1000).to_i

      @mutex.synchronize do
        prune!(now)
        append(email_key(email), now, env_int("LOGIN_RATE_LIMIT_WINDOW_MS", 900_000))
        append(ip_key(ip), now, env_int("LOGIN_IP_RATE_LIMIT_WINDOW_MS", 900_000))
      end

      nil
    end

    # A successful login clears that email's counter. Without an argument
    # (test setup) the whole store is cleared.
    def reset!(email = nil)
      @mutex.synchronize do
        if email
          @failures.delete(email_key(email))
        else
          @failures.clear
        end
      end

      nil
    end

    private

    def email_key(email)
      "email:#{normalize(email)}"
    end

    def ip_key(ip)
      "ip:#{normalize(ip)}"
    end

    def normalize(value)
      value.to_s.strip.downcase
    end

    def append(key, now, window_ms)
      recent = recent_failures(key, now, window_ms)
      recent << now
      @failures[key] = recent
      prune_store! if @failures.size > STORE_LIMIT
    end

    def recent_failures(key, now, window_ms)
      @failures[key]&.reject { |at| at + window_ms <= now } || []
    end

    def prune!(now)
      longest_window = [
        env_int("LOGIN_RATE_LIMIT_WINDOW_MS", 900_000),
        env_int("LOGIN_IP_RATE_LIMIT_WINDOW_MS", 900_000)
      ].max
      @failures.each do |key, timestamps|
        @failures.delete(key) if timestamps.all? { |at| at + longest_window <= now }
      end
    end

    def prune_store!
      @failures.shift while @failures.size > STORE_LIMIT
    end

    def env_int(key, default)
      raw = ENV[key]
      return default if raw.nil? || raw.strip.empty?

      Integer(raw)
    rescue ArgumentError
      default
    end
  end
end
