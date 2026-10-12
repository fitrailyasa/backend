module Middleware
  # Rejects oversized request bodies (default 100kb, env BODY_LIMIT) before
  # any parameter parsing happens. The 413 uses the standard error envelope.
  class BodySizeLimit
    UNITS = { "b" => 1, "kb" => 1024, "mb" => 1024**2, "gb" => 1024**3 }.freeze
    SIZE_RE = /\A(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?\z/i.freeze

    def initialize(app)
      @app = app
    end

    def call(env)
      limit = self.class.limit_bytes
      if limit.positive? && env["CONTENT_LENGTH"].to_i > limit
        body = { success: false, message: "Request body too large" }.to_json
        return [413, { "content-type" => "application/json" }, [body]]
      end

      @app.call(env)
    end

    def self.limit_bytes
      parse(ENV["BODY_LIMIT"])
    end

    def self.parse(raw)
      match = raw.to_s.strip.match(SIZE_RE)
      return 100 * 1024 unless match

      (match[1].to_f * UNITS.fetch((match[2] || "b").downcase, 1)).to_i
    end
  end
end
